import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { getOwned, tenantQuery } from "../lib/tenant";

const jobView = v.object({
  id: v.id("jobs"),
  type: v.string(),
  status: v.union(v.literal("queued"), v.literal("running"), v.literal("succeeded"), v.literal("failed")),
  attempts: v.number(),
  maxAttempts: v.number(),
  runAfter: v.number(),
  errorCode: v.optional(v.string()),
  createdAt: v.number(),
  finishedAt: v.optional(v.number()),
});

const view = (job: Doc<"jobs">) => ({
  id: job._id,
  type: job.type,
  status: job.status,
  attempts: job.attempts,
  maxAttempts: job.maxAttempts,
  runAfter: job.runAfter,
  errorCode: job.errorCode,
  createdAt: job.createdAt,
  finishedAt: job.finishedAt,
});

/** Status for én jobb i egen organisasjon. */
export const get = tenantQuery({
  args: { jobId: v.string() },
  returns: jobView,
  handler: async (ctx, { jobId }) => view(await getOwned(ctx, "jobs", jobId)),
});

/** De siste jobbene i organisasjonen, nyeste først. */
export const list = tenantQuery({
  args: {},
  returns: v.array(jobView),
  handler: async (ctx) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", ctx.tenant.organizationId))
      .order("desc")
      .take(20);
    return jobs.map(view);
  },
});
