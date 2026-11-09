import { v } from "convex/values";
import { assess as assessApplicability, type YearFigures } from "../../src/domain/applicability/assess";
import { writeAudit } from "../lib/audit";
import { appError } from "../lib/errors";
import { tenantMutation, tenantQuery } from "../lib/tenant";
import {
  applicabilityInputValidator,
  applicabilityResultValidator,
  reasonsValidator,
} from "./applicabilityValidators";

/** Gyldige tall: helt regnskapsår i et rimelig spenn, ingen negative beløp eller årsverk. */
function validYear(year: YearFigures): boolean {
  return (
    Number.isInteger(year.fiscalYear) &&
    year.fiscalYear >= 2000 &&
    year.fiscalYear <= 2100 &&
    (year.salesRevenueOre === null || year.salesRevenueOre >= 0n) &&
    (year.balanceSheetTotalOre === null || year.balanceSheetTotalOre >= 0n) &&
    (year.averageFte === null || (Number.isFinite(year.averageFte) && year.averageFte >= 0))
  );
}

/**
 * Lagrer en ny veiledende pliktvurdering for valgt organisasjon. Kunden må ha
 * bekreftet grunnlaget. Resultatet regnes ut her fra input, aldri tatt fra
 * klienten. Vurdering og revisjonslogg skrives i samme mutasjon.
 */
export const assess = tenantMutation({
  args: { inputs: applicabilityInputValidator, confirmed: v.literal(true) },
  returns: v.object({ assessmentId: v.id("applicabilityAssessments"), result: applicabilityResultValidator }),
  handler: async (ctx, { inputs }) => {
    if (!validYear(inputs.currentYear) || !validYear(inputs.previousYear)) throw appError("INVALID_INPUT");
    const assessment = assessApplicability(inputs);
    const now = Date.now();
    const doc = {
      organizationId: ctx.tenant.organizationId,
      assessedAt: now,
      assessedBy: ctx.tenant.userId,
      ruleVersion: assessment.ruleVersion,
      inputs,
      result: assessment.result,
      rationale: assessment.reasons,
      userConfirmedAt: now,
    };
    const assessmentId = await ctx.db.insert("applicabilityAssessments", doc);
    await writeAudit(ctx, {
      organizationId: ctx.tenant.organizationId,
      actor: { type: "user", id: ctx.tenant.userId },
      eventType: "applicability.assessed",
      entityType: "applicability",
      entityId: assessmentId,
      after: doc,
    });
    return { assessmentId, result: assessment.result };
  },
});

/** De siste vurderingene for valgt organisasjon, nyeste først. */
export const history = tenantQuery({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("applicabilityAssessments"),
      assessedAt: v.number(),
      ruleVersion: v.string(),
      inputs: applicabilityInputValidator,
      result: applicabilityResultValidator,
      rationale: reasonsValidator,
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("applicabilityAssessments")
      .withIndex("by_organizationId_and_assessedAt", (q) => q.eq("organizationId", ctx.tenant.organizationId))
      .order("desc")
      .take(10);
    return rows.map((r) => ({
      id: r._id,
      assessedAt: r.assessedAt,
      ruleVersion: r.ruleVersion,
      inputs: r.inputs,
      result: r.result,
      rationale: r.rationale,
    }));
  },
});
