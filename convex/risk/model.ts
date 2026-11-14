import { ConvexError } from "convex/values";
import { manifestChecksum } from "../../src/domain/risk/datasets/checksum.ts";
import { datasetFreshness, todayUtc } from "../../src/domain/risk/datasets/lifecycle.ts";
import { MAX_ENTRIES, type CountryManifest, type IndustryManifest, type MethodManifest } from "../../src/domain/risk/datasets/schema.ts";
import type { GenericDatabaseReader } from "convex/server";
import { ENGINE_VERSION, inputHash, normalizeInput, type EngineInput } from "../../src/domain/risk/engine.ts";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isLocalEnv } from "../ops/guard";

export type RiskDataErrorCode = "RISK_DATA_INVALID" | "RISK_VERSION_EXISTS" | "RISK_ACTIVATION_BLOCKED";

/** Feil fra operatørfunksjonene. `details` er feilene i filen eller hindrene for aktivering; aldri kundedata. */
export const riskDataError = (code: RiskDataErrorCode, details: string[]) =>
  new ConvexError({ code, message: code === "RISK_VERSION_EXISTS" ? "Versjonen finnes allerede og kan ikke endres." : details.join("; "), details });

type Ctx = Pick<QueryCtx, "db">;

/** Manifestet slik det ble importert, bygget opp fra det lagrede innholdet. Brukes til å kontrollere checksum på nytt. */
export async function datasetManifest(ctx: Ctx, version: Doc<"riskDatasetVersions">): Promise<CountryManifest | IndustryManifest> {
  const base = {
    schemaVersion: version.schemaVersion,
    version: version.version,
    environment: version.environment,
    sourceTitle: version.sourceTitle,
    sourceUrl: version.sourceUrl,
    sourceEdition: version.sourceEdition,
    retrievedAt: version.retrievedAt,
    licenseStatus: version.licenseStatus,
    licenseNote: version.licenseNote,
    review: version.review,
    approval: version.approval,
    checksum: version.checksum,
  };
  if (version.kind === "country") {
    const rows = await ctx.db
      .query("countryRiskEntries")
      .withIndex("by_datasetVersionId_and_iso2", (q) => q.eq("datasetVersionId", version._id))
      .take(MAX_ENTRIES + 1);
    const entries = rows.map(({ iso2, originalIndicator, screeningLevel, transformationNote, sourceReference }) => ({
      iso2, originalIndicator, screeningLevel, transformationNote, sourceReference,
    }));
    return { ...base, kind: "country", entries } as CountryManifest;
  }
  const rows = await ctx.db
    .query("industryRiskEntries")
    .withIndex("by_datasetVersionId", (q) => q.eq("datasetVersionId", version._id))
    .take(MAX_ENTRIES + 1);
  const entries = rows.map(({ codeExact, codePrefix, productCategory, screeningLevel, sourceReference, rationale }) => ({
    codeExact, codePrefix, productCategory, screeningLevel, sourceReference, rationale,
  }));
  return { ...base, kind: "industry", codeSystem: version.codeSystem, entries } as IndustryManifest;
}

export const methodManifest = (version: Doc<"riskMethodVersions">): MethodManifest =>
  ({
    schemaVersion: version.schemaVersion,
    kind: "method",
    version: version.version,
    environment: version.environment,
    description: version.description,
    review: version.review,
    approval: version.approval,
    checksum: version.checksum,
    definition: version.definition,
  }) as MethodManifest;

export const checksumMatches = async (manifest: CountryManifest | IndustryManifest | MethodManifest) =>
  (await manifestChecksum(manifest)) === manifest.checksum;

/** Det en kunde får se om en versjon. Aldri innholdet. */
export function versionView(
  kind: "country" | "industry" | "method",
  doc: Doc<"riskDatasetVersions"> | Doc<"riskMethodVersions">,
  now: number,
) {
  const dataset = "sourceTitle" in doc ? doc : null;
  return {
    id: doc._id as string,
    kind,
    version: doc.version,
    status: doc.status,
    environment: doc.environment,
    sourceTitle: dataset?.sourceTitle ?? null,
    sourceEdition: dataset?.sourceEdition ?? null,
    retrievedAt: dataset?.retrievedAt ?? null,
    licenseStatus: dataset?.licenseStatus ?? null,
    codeSystem: dataset?.codeSystem ?? null,
    reviewedAt: doc.review?.reviewedAt ?? null,
    reviewDueAt: doc.review?.reviewDueAt ?? null,
    freshness: datasetFreshness(doc, todayUtc(now)),
    entryCount: dataset?.entryCount ?? null,
    activatedAt: doc.activatedAt ?? null,
  };
}

type Reader = { db: GenericDatabaseReader<DataModel> };

/**
 * De aktive versjonene som gjelder nå: produksjon, eller demo i lokale miljøer når
 * ingen produksjonsversjon er aktiv. Samme valg for kundevisning og for motoren.
 */
export async function activeDocs(ctx: Reader) {
  const environments = isLocalEnv() ? (["production", "demo"] as const) : (["production"] as const);
  const dataset = async (kind: "country" | "industry") => {
    for (const environment of environments) {
      const doc = await ctx.db
        .query("riskDatasetVersions")
        .withIndex("by_kind_and_environment_and_status", (q) => q.eq("kind", kind).eq("environment", environment).eq("status", "active"))
        .first();
      if (doc) return doc;
    }
    return null;
  };
  const method = async () => {
    for (const environment of environments) {
      const doc = await ctx.db
        .query("riskMethodVersions")
        .withIndex("by_environment_and_status", (q) => q.eq("environment", environment).eq("status", "active"))
        .first();
      if (doc) return doc;
    }
    return null;
  };
  return { country: await dataset("country"), industry: await dataset("industry"), method: await method() };
}

/** Motorens input for én leverandør i én periode, fra leverandøren, periodens innkjøpsdata og siste hentede registersvar. Beløpet leses ikke. */
export async function assessmentInput(ctx: Reader, supplier: Doc<"suppliers">, reportingPeriodId: Id<"reportingPeriods">) {
  const row = await ctx.db
    .query("supplierPeriods")
    .withIndex("by_organizationId_and_supplierId_and_reportingPeriodId", (q) =>
      q.eq("organizationId", supplier.organizationId).eq("supplierId", supplier._id).eq("reportingPeriodId", reportingPeriodId),
    )
    .unique();
  const enrichment = supplier.registryEnrichment;
  // Et registersvar for et annet org.nr. sier ingenting om denne leverandøren.
  const snapshot = enrichment?.snapshotId && enrichment.orgNumber === supplier.registryOrgNumber ? await ctx.db.get("registrySnapshots", enrichment.snapshotId) : null;
  const input = normalizeInput({
    industryCodeSystem: supplier.industryCodeSystem,
    industryCode: supplier.industryCode,
    productionCountries: row?.productionCountries ?? [],
    // Uten innkjøpsdata for perioden er leddene bak leverandøren ukjente.
    upstreamUnknown: row?.upstreamUnknown ?? true,
    purchaseCategory: row?.purchaseCategory,
    registry: snapshot && snapshot.organizationId === supplier.organizationId ? snapshot.selectedFields : null,
  });
  return { input, supplierPeriodId: row?._id, spendOre: row?.spendOre ?? null };
}

export type Basis = {
  inputHash: string;
  methodId: Id<"riskMethodVersions"> | null;
  countryId: Id<"riskDatasetVersions"> | null;
  industryId: Id<"riskDatasetVersions"> | null;
  /** Utdaterte kilder akkurat nå (samme form som `staleSources` i en vurdering), sortert. */
  staleSources: string;
};

const staleKey = (list: readonly { source: string; version: string; freshness: string }[]) =>
  list.map((s) => `${s.source}:${s.version}:${s.freshness}`).sort().join("|");

export const basisOf = async (input: EngineInput, active: Awaited<ReturnType<typeof activeDocs>>, now: number): Promise<Basis> => {
  const today = todayUtc(now);
  const stale = [
    ...(active.country ? [{ source: "country", doc: active.country }] : []),
    ...(active.industry ? [{ source: "industry", doc: active.industry }] : []),
    ...(active.method ? [{ source: "method", doc: active.method }] : []),
  ].flatMap(({ source, doc }) => {
    const freshness = datasetFreshness(doc, today);
    return freshness === "current" ? [] : [{ source, version: doc.version, freshness }];
  });
  return {
    inputHash: await inputHash(input),
    methodId: active.method?._id ?? null,
    countryId: active.country?._id ?? null,
    industryId: active.industry?._id ?? null,
    staleSources: staleKey(stale),
  };
};

/** Hvorfor en lagret vurdering ikke lenger gjelder. Tom liste betyr at den er gjeldende. */
export function staleReasons(a: Doc<"riskAssessments">, basis: Basis): string[] {
  const reasons: string[] = [];
  if (a.inputHash !== basis.inputHash) reasons.push("input_changed");
  if (a.methodVersionId !== basis.methodId) reasons.push("method_changed");
  if ((a.countryDatasetVersionId ?? null) !== basis.countryId) reasons.push("country_data_changed");
  if ((a.industryDatasetVersionId ?? null) !== basis.industryId) reasons.push("industry_data_changed");
  if (a.engineVersion !== ENGINE_VERSION) reasons.push("engine_changed");
  // En kilde som har passert forfallsdatoen (eller er gjennomgått på nytt) etter vurderingen.
  if (staleKey(a.staleSources) !== basis.staleSources) reasons.push("source_freshness_changed");
  return reasons;
}

/**
 * Siste screening for en leverandør i en periode, med årsaker til at den er utdatert (tom liste = gjeldende) og
 * periodens innkjøpsbeløp. Beløpet er aldri motorinput; det brukes bare til sortering.
 */
export async function latestAssessment(ctx: Reader, supplier: Doc<"suppliers">, reportingPeriodId: Id<"reportingPeriods">, active?: Awaited<ReturnType<typeof activeDocs>>) {
  const assessment = await ctx.db
    .query("riskAssessments")
    .withIndex("by_organizationId_and_period_and_supplier_and_assessedAt", (q) =>
      q.eq("organizationId", supplier.organizationId).eq("reportingPeriodId", reportingPeriodId).eq("supplierId", supplier._id),
    )
    .order("desc")
    .first();
  const { input, spendOre } = await assessmentInput(ctx, supplier, reportingPeriodId);
  if (!assessment) return { assessment: null, reasons: [] as string[], spendOre };
  const reasons = staleReasons(assessment, await basisOf(input, active ?? (await activeDocs(ctx)), Date.now()));
  return { assessment, reasons, spendOre };
}

/** Kundens gjeldende vurdering: den siste for leverandøren i perioden (append-only, så siste rad gjelder). */
export const latestReview = (ctx: Reader, organizationId: Id<"organizations">, reportingPeriodId: Id<"reportingPeriods">, supplierId: Id<"suppliers">) =>
  ctx.db
    .query("assessmentReviews")
    .withIndex("by_organizationId_and_period_and_supplier_and_reviewedAt", (q) =>
      q.eq("organizationId", organizationId).eq("reportingPeriodId", reportingPeriodId).eq("supplierId", supplierId),
    )
    .order("desc")
    .first();
