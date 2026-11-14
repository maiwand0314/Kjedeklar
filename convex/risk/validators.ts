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

const industryEntryView = v.object({
  codeExact: v.optional(v.string()),
  codePrefix: v.optional(v.string()),
  productCategory: v.optional(v.string()),
  screeningLevel: screeningLevelValidator,
  sourceReference: v.string(),
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

export const levelWithUnknown = v.union(v.literal("low"), v.literal("moderate"), v.literal("high"), v.literal("unknown"));
const nullableBool = v.union(v.boolean(), v.null());

/** Det motoren så (src/domain/risk/engine.ts `EngineInput`): uten beløp, registreringsland og fritekst. */
export const inputSnapshotValidator = v.object({
  industry: v.union(v.null(), v.object({ codeSystem: v.string(), code: v.string() })),
  productionCountries: v.array(v.string()),
  upstreamUnknown: v.boolean(),
  purchaseCategory: v.union(v.string(), v.null()),
  registry: v.union(
    v.null(),
    v.object({ bankrupt: nullableBool, underLiquidation: nullableBool, underForcedLiquidation: nullableBool, deleted: v.boolean() }),
  ),
});

/** Resultatet av motoren (`Assessment`). */
export const assessmentResultFields = {
  screeningLevel: levelWithUnknown,
  dataQuality: v.union(v.literal("complete"), v.literal("incomplete"), v.literal("insufficient")),
  missingFields: v.array(v.object({ field: v.string(), reason: v.string(), detail: v.optional(v.string()) })),
  triggeredRules: v.array(
    v.object({
      ruleId: v.string(),
      factor: v.string(),
      level: screeningLevelValidator,
      input: v.string(),
      sourceRef: v.object({ dataset: v.string(), version: v.string(), entry: v.string(), sourceReference: v.string() }),
    }),
  ),
  controlSignals: v.array(v.object({ ruleId: v.string(), factor: v.string(), detail: v.string() })),
  staleSources: v.array(v.object({ source: v.string(), version: v.string(), freshness: v.string() })),
};

/** Uforanderlig vurdering av én leverandør i én periode. Ny rad per beregning. */
export const riskAssessmentFields = {
  supplierId: v.id("suppliers"),
  reportingPeriodId: v.id("reportingPeriods"),
  supplierPeriodId: v.optional(v.id("supplierPeriods")),
  methodVersionId: v.id("riskMethodVersions"),
  countryDatasetVersionId: v.optional(v.id("riskDatasetVersions")),
  industryDatasetVersionId: v.optional(v.id("riskDatasetVersions")),
  engineVersion: v.string(),
  inputSnapshot: inputSnapshotValidator,
  inputHash: v.string(),
  ...assessmentResultFields,
  assessedAt: v.number(),
  assessedBy: v.string(),
};

const freshnessValidator = v.union(v.literal("current"), v.literal("review_overdue"), v.literal("unreviewed"));

/** Aktive versjoner med innhold, bare til interne funksjoner. */
export const engineDataValidator = v.object({
  method: v.union(v.null(), v.object({ id: v.id("riskMethodVersions"), version: v.string(), freshness: freshnessValidator, definition: methodDefinitionValidator })),
  country: v.union(
    v.null(),
    v.object({
      id: v.id("riskDatasetVersions"),
      version: v.string(),
      freshness: freshnessValidator,
      entries: v.array(v.object({ iso2: v.string(), screeningLevel: screeningLevelValidator, sourceReference: v.string() })),
    }),
  ),
  industry: v.union(
    v.null(),
    v.object({
      id: v.id("riskDatasetVersions"),
      version: v.string(),
      codeSystem: v.string(),
      freshness: freshnessValidator,
      entries: v.array(industryEntryView),
    }),
  ),
});

export const reviewDecisionValidator = v.union(v.literal("confirm"), v.literal("override"), v.literal("revoke"));

/**
 * Kundens bekreftelse, overstyring eller tilbaketrekking av en screening (oppgave 16). Ny rad per beslutning, endres
 * aldri. `originalLevel` er screeningnivået slik det var da kunden valgte; `previousReviewId` er vurderingen som gjaldt.
 * `supplierId` og `reportingPeriodId` følger vurderingen og gir indeksen for «gjeldende».
 */
export const assessmentReviewFields = {
  assessmentId: v.id("riskAssessments"),
  supplierId: v.id("suppliers"),
  reportingPeriodId: v.id("reportingPeriods"),
  decision: reviewDecisionValidator,
  originalLevel: levelWithUnknown,
  chosenLevel: v.optional(screeningLevelValidator),
  previousReviewId: v.optional(v.id("assessmentReviews")),
  rationale: v.string(),
  evidenceNote: v.optional(v.string()),
  actorId: v.string(),
  reviewedAt: v.number(),
};
