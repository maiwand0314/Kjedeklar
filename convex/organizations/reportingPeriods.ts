import { v } from "convex/values";
import { validatePeriod } from "../../src/domain/reporting/period";
import { writeAudit } from "../lib/audit";
import { appError } from "../lib/errors";
import { tenantMutation, tenantQuery } from "../lib/tenant";
import { periodSummaryValidator } from "./profileValidators";

/**
 * Oppretter en rapportperiode med eksplisitte datoer og frist. Samme start og
 * slutt kan bare finnes én gang per organisasjon. Perioder endres eller slettes
 * ikke fra appen i MVP.
 */
export const create = tenantMutation({
  args: { startDate: v.string(), endDate: v.string(), publicationDueDate: v.string() },
  returns: v.id("reportingPeriods"),
  handler: async (ctx, dates) => {
    if (Object.keys(validatePeriod(dates)).length > 0) throw appError("INVALID_INPUT");
    const { organizationId, userId } = ctx.tenant;
    const existing = await ctx.db
      .query("reportingPeriods")
      .withIndex("by_organizationId_and_startDate_and_endDate", (q) =>
        q.eq("organizationId", organizationId).eq("startDate", dates.startDate).eq("endDate", dates.endDate),
      )
      .first();
    if (existing) throw appError("PERIOD_EXISTS");
    const doc = { organizationId, ...dates, status: "open" as const, createdAt: Date.now(), createdBy: userId };
    const periodId = await ctx.db.insert("reportingPeriods", doc);
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "user", id: userId },
      eventType: "reporting_period.created",
      entityType: "reportingPeriod",
      entityId: periodId,
      after: doc,
    });
    return periodId;
  },
});

/** Organisasjonens rapportperioder, nyeste først. */
export const list = tenantQuery({
  args: {},
  returns: v.array(periodSummaryValidator),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("reportingPeriods")
      .withIndex("by_organizationId_and_startDate_and_endDate", (q) => q.eq("organizationId", ctx.tenant.organizationId))
      .order("desc")
      .take(50);
    return rows.map((p) => ({ id: p._id, startDate: p.startDate, endDate: p.endDate, publicationDueDate: p.publicationDueDate }));
  },
});
