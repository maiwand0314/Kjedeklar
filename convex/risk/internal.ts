/**
 * Operatørfunksjoner for risikodata: import og aktivering av dataversjoner og
 * metodeversjoner. Alle er interne: de kan bare kalles med deploy/admin key
 * (`pnpm risk-data:import`/`risk-data:activate`) eller fra annen Convex-kode,
 * aldri fra appen, og det finnes ingen kunde-API for å skrive. Se beslutning 0012.
 *
 * Innholdet endres aldri etter import. Aktivering endrer bare status og
 * tidsstempler, og pensjonerer forrige aktive versjon (som forblir lesbar).
 * Revisjonsloggen er per kunde og har ikke noe sted for globale endringer, så
 * hvem og når står på selve versjonsdokumentet (`importedBy`, `activatedBy`).
 */
import { v } from "convex/values";
import { activationBlockers, datasetFreshness, todayUtc } from "../../src/domain/risk/datasets/lifecycle.ts";
import { validateManifest } from "../../src/domain/risk/datasets/validate.ts";
import { methodDefinitionSchema } from "../../src/domain/risk/datasets/schema.ts";
import { internalMutation, internalQuery } from "../_generated/server";
import { isLocalEnv } from "../ops/guard";
import { activeDocs, checksumMatches, datasetManifest, methodManifest, riskDataError } from "./model";
import { engineDataValidator } from "./validators";

const operator = v.string();
const kindValidator = v.union(v.literal("country"), v.literal("industry"), v.literal("method"));
const operatorName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) throw riskDataError("RISK_DATA_INVALID", ["operator må være et navn på 1–100 tegn"]);
  return trimmed;
};

/**
 * Importerer en versjon i status `imported`. Skjema og semantikk valideres på
 * nytt her (filen er ubetrodd input fra et skript), checksum regnes ut på nytt,
 * og demo avvises utenfor lokale miljøer. Samme (type, versjon) kan aldri
 * importeres to ganger, heller ikke med likt innhold.
 */
export const importVersion = internalMutation({
  args: { operator, payload: v.any() },
  returns: v.object({ kind: kindValidator, version: v.string(), status: v.literal("imported"), entryCount: v.number() }),
  handler: async (ctx, args) => {
    const importedBy = operatorName(args.operator);
    const checked = validateManifest(args.payload);
    if (!checked.ok) throw riskDataError("RISK_DATA_INVALID", checked.errors);
    const manifest = checked.manifest;
    if (!(await checksumMatches(manifest))) throw riskDataError("RISK_DATA_INVALID", ["checksum stemmer ikke med innholdet"]);
    if (manifest.environment === "demo" && !isLocalEnv()) throw riskDataError("RISK_DATA_INVALID", ["demo-data kan bare importeres i lokale miljøer"]);

    const importedAt = Date.now();
    const lifecycle = {
      status: "imported" as const,
      environment: manifest.environment,
      schemaVersion: manifest.schemaVersion,
      review: manifest.review,
      approval: manifest.approval,
      checksum: manifest.checksum,
      importedAt,
      importedBy,
    };

    if (manifest.kind === "method") {
      const existing = await ctx.db.query("riskMethodVersions").withIndex("by_version", (q) => q.eq("version", manifest.version)).first();
      if (existing) throw riskDataError("RISK_VERSION_EXISTS", []);
      await ctx.db.insert("riskMethodVersions", {
        version: manifest.version,
        description: manifest.description,
        definition: { ...manifest.definition, levels: [...manifest.definition.levels] },
        ...lifecycle,
      });
      return { kind: "method" as const, version: manifest.version, status: "imported" as const, entryCount: manifest.definition.ruleDefinitions.length };
    }

    const existing = await ctx.db
      .query("riskDatasetVersions")
      .withIndex("by_kind_and_version", (q) => q.eq("kind", manifest.kind).eq("version", manifest.version))
      .first();
    if (existing) throw riskDataError("RISK_VERSION_EXISTS", []);
    const versionId = await ctx.db.insert("riskDatasetVersions", {
      kind: manifest.kind,
      version: manifest.version,
      sourceTitle: manifest.sourceTitle,
      sourceUrl: manifest.sourceUrl,
      sourceEdition: manifest.sourceEdition,
      retrievedAt: manifest.retrievedAt,
      licenseStatus: manifest.licenseStatus,
      licenseNote: manifest.licenseNote,
      codeSystem: manifest.kind === "industry" ? manifest.codeSystem : undefined,
      entryCount: manifest.entries.length,
      ...lifecycle,
    });
    if (manifest.kind === "country") {
      for (const entry of manifest.entries) await ctx.db.insert("countryRiskEntries", { datasetVersionId: versionId, ...entry });
    } else {
      for (const entry of manifest.entries) await ctx.db.insert("industryRiskEntries", { datasetVersionId: versionId, ...entry });
    }
    return { kind: manifest.kind, version: manifest.version, status: "imported" as const, entryCount: manifest.entries.length };
  },
});

/**
 * Aktiverer en importert versjon. Gjør alle kontrollene på nytt mot det som
 * er lagret: checksum, mapping, og for produksjon lisens, gjennomgang,
 * godkjenning og review-dato. Forrige aktive versjon av samme type og miljø
 * pensjoneres i samme transaksjon og forblir lesbar. Ett hinder avviser alt.
 */
export const activateVersion = internalMutation({
  args: { operator, kind: kindValidator, version: v.string() },
  returns: v.object({ kind: kindValidator, version: v.string(), retiredVersion: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const activatedBy = operatorName(args.operator);
    const now = Date.now();
    const check = { today: todayUtc(now), localEnvironment: isLocalEnv() };

    if (args.kind === "method") {
      const doc = await ctx.db.query("riskMethodVersions").withIndex("by_version", (q) => q.eq("version", args.version)).first();
      if (!doc) throw riskDataError("RISK_DATA_INVALID", ["versjonen finnes ikke"]);
      const manifest = methodManifest(doc);
      const blockers = activationBlockers(doc, {
        ...check,
        checksumMatches: await checksumMatches(manifest),
        mappingValid: validateManifest(manifest).ok,
      });
      if (blockers.length) throw riskDataError("RISK_ACTIVATION_BLOCKED", blockers);
      const current = await ctx.db
        .query("riskMethodVersions")
        .withIndex("by_environment_and_status", (q) => q.eq("environment", doc.environment).eq("status", "active"))
        .first();
      if (current) await ctx.db.patch("riskMethodVersions", current._id, { status: "retired", retiredAt: now });
      await ctx.db.patch("riskMethodVersions", doc._id, { status: "active", activatedAt: now, activatedBy });
      return { kind: "method" as const, version: doc.version, retiredVersion: current?.version ?? null };
    }

    const kind = args.kind;
    const doc = await ctx.db.query("riskDatasetVersions").withIndex("by_kind_and_version", (q) => q.eq("kind", kind).eq("version", args.version)).first();
    if (!doc) throw riskDataError("RISK_DATA_INVALID", ["versjonen finnes ikke"]);
    const manifest = await datasetManifest(ctx, doc);
    const blockers = activationBlockers(doc, {
      ...check,
      checksumMatches: await checksumMatches(manifest),
      mappingValid: validateManifest(manifest).ok && manifest.entries.length === doc.entryCount,
    });
    if (blockers.length) throw riskDataError("RISK_ACTIVATION_BLOCKED", blockers);
    const current = await ctx.db
      .query("riskDatasetVersions")
      .withIndex("by_kind_and_environment_and_status", (q) => q.eq("kind", kind).eq("environment", doc.environment).eq("status", "active"))
      .first();
    if (current) await ctx.db.patch("riskDatasetVersions", current._id, { status: "retired", retiredAt: now });
    await ctx.db.patch("riskDatasetVersions", doc._id, { status: "active", activatedAt: now, activatedBy });
    return { kind, version: doc.version, retiredVersion: current?.version ?? null };
  },
});

/**
 * De aktive versjonene med innhold, til vurderingsmutasjonen. Kundefunksjoner kan
 * ikke lese innholdstabellene direkte (rls.ts), så innholdet går via denne interne
 * queryen, som bare kalles fra annen Convex-kode. Metodedefinisjonen valideres på
 * nytt (den ble validert ved aktivering).
 */
export const engineData = internalQuery({
  args: {},
  returns: engineDataValidator,
  handler: async (ctx) => {
    const today = todayUtc(Date.now());
    const active = await activeDocs(ctx);
    const country = active.country
      ? {
          id: active.country._id,
          version: active.country.version,
          freshness: datasetFreshness(active.country, today),
          entries: (
            await ctx.db.query("countryRiskEntries").withIndex("by_datasetVersionId_and_iso2", (q) => q.eq("datasetVersionId", active.country!._id)).take(1001)
          ).map(({ iso2, screeningLevel, sourceReference }) => ({ iso2, screeningLevel, sourceReference })),
        }
      : null;
    const industry = active.industry
      ? {
          id: active.industry._id,
          version: active.industry.version,
          codeSystem: active.industry.codeSystem ?? "",
          freshness: datasetFreshness(active.industry, today),
          entries: (
            await ctx.db.query("industryRiskEntries").withIndex("by_datasetVersionId", (q) => q.eq("datasetVersionId", active.industry!._id)).take(1001)
          ).map(({ codeExact, codePrefix, productCategory, screeningLevel, sourceReference }) => ({ codeExact, codePrefix, productCategory, screeningLevel, sourceReference })),
        }
      : null;
    const method = active.method
      ? { id: active.method._id, version: active.method.version, freshness: datasetFreshness(active.method, today), definition: methodDefinitionSchema.parse(active.method.definition) }
      : null;
    return { method, country, industry };
  },
});
