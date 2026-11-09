import { v } from "convex/values";
import { normalizeAnswers, PROFILE_TOPICS, type ProfileAnswers } from "../../src/domain/reporting/profile";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { writeAudit } from "../lib/audit";
import { appError } from "../lib/errors";
import { getOwned, tenantMutation, tenantQuery } from "../lib/tenant";
import { periodSummaryValidator, profileAnswersValidator } from "./profileValidators";

type Revision = Pick<Doc<"businessProfileRevisions">, "revision" | "confirmedAt"> & ProfileAnswers;

const answersOf = (doc: ProfileAnswers): ProfileAnswers =>
  Object.fromEntries(PROFILE_TOPICS.map((t) => [t.key, doc[t.key]])) as ProfileAnswers;

/** Det som kan stå i revisjonsloggen: versjon, bekreftelse og status per tema. Aldri fritekst. */
const auditSnapshot = (doc: Revision) => ({
  revision: doc.revision,
  confirmed: doc.confirmedAt !== undefined,
  ...Object.fromEntries(PROFILE_TOPICS.map((t) => [t.key, doc[t.key].status])),
});

function revisionsFor(ctx: { db: QueryCtx["db"] }, organizationId: Id<"organizations">, periodId: Id<"reportingPeriods">) {
  return ctx.db
    .query("businessProfileRevisions")
    .withIndex("by_organizationId_and_reportingPeriodId_and_revision", (q) =>
      q.eq("organizationId", organizationId).eq("reportingPeriodId", periodId),
    )
    .order("desc");
}

/**
 * Lagrer en ny versjon av virksomhetsprofilen for en egen rapportperiode. Gamle
 * versjoner endres aldri. `expectedRevision` er versjonen brukeren så (0 når
 * ingen finnes); er den utdatert, avvises lagringen så ingen overskriver en
 * annens arbeid uten å ha sett det.
 */
export const save = tenantMutation({
  args: {
    reportingPeriodId: v.string(),
    answers: profileAnswersValidator,
    confirmed: v.boolean(),
    expectedRevision: v.number(),
  },
  returns: v.object({ revisionId: v.id("businessProfileRevisions"), revision: v.number() }),
  handler: async (ctx, args) => {
    const { organizationId, userId } = ctx.tenant;
    const period = await getOwned(ctx, "reportingPeriods", args.reportingPeriodId);
    const answers = normalizeAnswers(args.answers);
    if (!answers) throw appError("INVALID_INPUT");
    const latest = await revisionsFor(ctx, organizationId, period._id).first();
    if ((latest?.revision ?? 0) !== args.expectedRevision) throw appError("CONFLICT");
    const now = Date.now();
    const doc = {
      organizationId,
      reportingPeriodId: period._id,
      revision: args.expectedRevision + 1,
      ...answers,
      createdAt: now,
      createdBy: userId,
      ...(args.confirmed && { confirmedBy: userId, confirmedAt: now }),
    };
    const revisionId = await ctx.db.insert("businessProfileRevisions", doc);
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "user", id: userId },
      eventType: "business_profile.saved",
      entityType: "businessProfile",
      entityId: revisionId,
      before: latest && auditSnapshot(latest),
      after: auditSnapshot(doc),
    });
    return { revisionId, revision: doc.revision };
  },
});

/** Perioden, siste versjon av profilen (eller ingen) og versjonshistorikken. */
export const current = tenantQuery({
  args: { reportingPeriodId: v.string() },
  returns: v.object({
    period: periodSummaryValidator,
    latest: v.union(
      v.null(),
      v.object({
        revision: v.number(),
        answers: profileAnswersValidator,
        savedAt: v.number(),
        confirmedAt: v.union(v.number(), v.null()),
      }),
    ),
    history: v.array(v.object({ revision: v.number(), savedAt: v.number(), confirmed: v.boolean() })),
  }),
  handler: async (ctx, { reportingPeriodId }) => {
    const period = await getOwned(ctx, "reportingPeriods", reportingPeriodId);
    const revisions = await revisionsFor(ctx, ctx.tenant.organizationId, period._id).take(20);
    const latest = revisions[0];
    return {
      period: { id: period._id, startDate: period.startDate, endDate: period.endDate, publicationDueDate: period.publicationDueDate },
      latest: latest
        ? { revision: latest.revision, answers: answersOf(latest), savedAt: latest.createdAt, confirmedAt: latest.confirmedAt ?? null }
        : null,
      history: revisions.map((r) => ({ revision: r.revision, savedAt: r.createdAt, confirmed: r.confirmedAt !== undefined })),
    };
  },
});
