import { v } from "convex/values";

/** Samme form som `RegistryProfile` i src/domain/brreg/enhet.ts. */
export const registryProfileValidator = v.object({
  orgNumber: v.string(),
  name: v.string(),
  legalForm: v.union(v.string(), v.null()),
  legalFormDescription: v.union(v.string(), v.null()),
  address: v.union(
    v.null(),
    v.object({
      lines: v.array(v.string()),
      postalCode: v.union(v.string(), v.null()),
      city: v.union(v.string(), v.null()),
      municipality: v.union(v.string(), v.null()),
      countryCode: v.union(v.string(), v.null()),
    }),
  ),
  addressKind: v.union(v.literal("forretningsadresse"), v.literal("postadresse"), v.null()),
  industryCode: v.union(v.string(), v.null()),
  industryDescription: v.union(v.string(), v.null()),
  industryCodeSystem: v.literal("SN"),
  bankrupt: v.union(v.boolean(), v.null()),
  underLiquidation: v.union(v.boolean(), v.null()),
  underForcedLiquidation: v.union(v.boolean(), v.null()),
  deletedOn: v.union(v.string(), v.null()),
});
