import { v } from "convex/values";

/** Samme form som `ApplicabilityInput` i src/domain/applicability/assess.ts. Beløp i øre. */
const yearFigures = v.object({
  fiscalYear: v.number(),
  salesRevenueOre: v.union(v.int64(), v.null()),
  balanceSheetTotalOre: v.union(v.int64(), v.null()),
  averageFte: v.union(v.number(), v.null()),
});

const answer = v.union(v.literal("yes"), v.literal("no"), v.literal("unknown"));

export const applicabilityInputValidator = v.object({
  currentYear: yearFigures,
  previousYear: yearFigures,
  previousStatus: answer,
  isParentCompany: answer,
  publicInterestEntity: answer,
  norwegian: answer,
});

export const applicabilityResultValidator = v.union(
  v.literal("likely_in"),
  v.literal("likely_out"),
  v.literal("manual_review"),
);

export const reasonsValidator = v.array(v.object({ code: v.string(), text: v.string() }));
