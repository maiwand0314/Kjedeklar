import { v } from "convex/values";

/** Kodeverk med versjon. Samme nøkler som INDUSTRY_CODE_SYSTEMS i src/domain/suppliers/supplier.ts. */
export const industryCodeSystemValidator = v.union(
  v.literal("SN2007"),
  v.literal("SN2025"),
  v.literal("NACE2"),
  v.literal("NACE2.1"),
);

/** Leverandørprofilen. Felt som mangler, er ukjente. Land er ISO 3166-1 alfa-2. */
export const supplierProfileFields = {
  name: v.string(),
  registryOrgNumber: v.optional(v.string()),
  externalKey: v.optional(v.string()),
  registeredCountry: v.optional(v.string()),
  industryCodeSystem: v.optional(industryCodeSystemValidator),
  industryCode: v.optional(v.string()),
};

/** Innkjøpsdata for én periode. `spendOre` er øre i NOK; mangler det, er beløpet ukjent. */
export const supplierPeriodFields = {
  spendOre: v.optional(v.int64()),
  purchaseCategory: v.optional(v.string()),
  purchaseDescription: v.optional(v.string()),
  productionCountries: v.array(v.string()),
  upstreamUnknown: v.boolean(),
};

/**
 * Status for Brreg-beriking, per leverandør. `sequence` teller forespørslene
 * (og gir jobbens idempotensnøkkel), `jobId` er siste forespørsel, og
 * `orgNumber` er nummeret den gjaldt: endres org.nr., gjelder ikke statusen
 * lenger. `snapshotId`/`fetchedAt` er siste vellykkede henting og beholdes når
 * en senere henting feiler. `errorCode` er en kort kode, aldri en feilmelding.
 */
export const registryEnrichmentValidator = v.object({
  sequence: v.number(),
  jobId: v.id("jobs"),
  orgNumber: v.string(),
  state: v.union(v.literal("queued"), v.literal("succeeded"), v.literal("not_found"), v.literal("removed"), v.literal("failed")),
  requestedAt: v.number(),
  finishedAt: v.optional(v.number()),
  snapshotId: v.optional(v.id("registrySnapshots")),
  fetchedAt: v.optional(v.number()),
  errorCode: v.optional(v.string()),
});

/** Næringskode som brukeren har tatt fra et registersvar: hvilket snapshot og når det ble hentet. Fjernes når koden endres for hånd. */
export const industryCodeSourceValidator = v.object({ snapshotId: v.id("registrySnapshots"), fetchedAt: v.number() });

/** Det brukeren ser per leverandør (src/domain/suppliers/registry.ts). */
export const registryStateValidator = v.union(
  v.literal("not_applicable"),
  v.literal("not_fetched"),
  v.literal("queued"),
  v.literal("succeeded"),
  v.literal("not_found"),
  v.literal("removed"),
  v.literal("failed"),
);
