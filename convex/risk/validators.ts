import { v } from "convex/values";
import { industryCodeSystemValidator } from "../suppliers/validators";

/** Livsløpet er `imported` → `active` → `retired` (src/domain/risk/datasets/lifecycle.ts). */
export const datasetStatusValidator = v.union(v.literal("imported"), v.literal("active"), v.literal("retired"));
export const environmentValidator = v.union(v.literal("demo"), v.literal("production"));
export const screeningLevelValidator = v.union(v.literal("low"), v.literal("moderate"), v.literal("high"));
export const reviewValidator = v.object({ reviewer: v.string(), reviewedAt: v.string(), reviewDueAt: v.string() });
export const approvalValidator = v.object({ approvedBy: v.string(), approvedAt: v.string() });

/** Felles for alle versjoner: hvem som importerte og aktiverte, og når. Innholdet endres aldri. */
export const lifecycleFields = {
  status: datasetStatusValidator,
  environment: environmentValidator,
  schemaVersion: v.string(),
  review: v.optional(reviewValidator),
  approval: v.optional(approvalValidator),
  checksum: v.string(),
  importedAt: v.number(),
  importedBy: v.string(),
  activatedAt: v.optional(v.number()),
  activatedBy: v.optional(v.string()),
  retiredAt: v.optional(v.number()),
};

export const datasetVersionFields = {
  kind: v.union(v.literal("country"), v.literal("industry")),
  version: v.string(),
  sourceTitle: v.string(),
  sourceUrl: v.string(),
  sourceEdition: v.string(),
  retrievedAt: v.string(),
  licenseStatus: v.union(v.literal("cleared"), v.literal("unclear"), v.literal("restricted")),
  licenseNote: v.optional(v.string()),
  /** Bare for bransjedata: kodeverket (med versjon) alle kodene følger. */
  codeSystem: v.optional(industryCodeSystemValidator),
  entryCount: v.number(),
  ...lifecycleFields,
};

export const methodDefinitionValidator = v.object({
  scope: v.literal("kjedeklar_screening"),
  requiresProfessionalReview: v.literal(true),
  levels: v.array(v.string()),
  aggregation: v.literal("ordinal_max"),
  unknownPolicy: v.object({
    knownHighWins: v.literal(true),
    materialGaps: v.array(v.string()),
    resultWhenMaterialGap: v.literal("unknown"),
  }),
  priorityOrder: v.array(v.string()),
  amountAffectsLevel: v.literal(false),
  amountSortsWithinLevel: v.literal(true),
  ruleDefinitions: v.array(
    v.object({ ruleId: v.string(), kind: v.string(), factor: v.string(), description: v.string() }),
  ),
});

export const methodVersionFields = {
  version: v.string(),
  description: v.string(),
  definition: methodDefinitionValidator,
  ...lifecycleFields,
};

export const countryEntryFields = {
  iso2: v.string(),
  originalIndicator: v.string(),
  screeningLevel: screeningLevelValidator,
  transformationNote: v.string(),
  sourceReference: v.string(),
};

export const industryEntryFields = {
  codeExact: v.optional(v.string()),
  codePrefix: v.optional(v.string()),
  productCategory: v.optional(v.string()),
  screeningLevel: screeningLevelValidator,
  sourceReference: v.string(),
  rationale: v.string(),
};

/** Det en kunde får se om en versjon: metadata og datakvalitet, ikke selve innholdet. */
export const versionViewValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal("country"), v.literal("industry"), v.literal("method")),
  version: v.string(),
  status: datasetStatusValidator,
  environment: environmentValidator,
  sourceTitle: v.union(v.string(), v.null()),
  sourceEdition: v.union(v.string(), v.null()),
  retrievedAt: v.union(v.string(), v.null()),
  licenseStatus: v.union(v.literal("cleared"), v.literal("unclear"), v.literal("restricted"), v.null()),
  codeSystem: v.union(industryCodeSystemValidator, v.null()),
  reviewedAt: v.union(v.string(), v.null()),
  reviewDueAt: v.union(v.string(), v.null()),
  freshness: v.union(v.literal("current"), v.literal("review_overdue"), v.literal("unreviewed")),
  entryCount: v.union(v.number(), v.null()),
  activatedAt: v.union(v.number(), v.null()),
});
