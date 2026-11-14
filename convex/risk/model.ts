import { ConvexError } from "convex/values";
import { manifestChecksum } from "../../src/domain/risk/datasets/checksum.ts";
import { datasetFreshness, todayUtc } from "../../src/domain/risk/datasets/lifecycle.ts";
import { MAX_ENTRIES, type CountryManifest, type IndustryManifest, type MethodManifest } from "../../src/domain/risk/datasets/schema.ts";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

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
