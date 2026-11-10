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
