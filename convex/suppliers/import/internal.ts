import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/**
 * Organisasjonens leverandører med bare feltene som trengs for å foreslå
 * matching i en importforhåndsvisning. Kalles bare fra preview-actionen, med
 * `organizationId` fra verifisert tenant.
 */
export const suppliersForMatching = internalQuery({
  args: { organizationId: v.id("organizations"), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        registryOrgNumber: v.optional(v.string()),
        externalKey: v.optional(v.string()),
        archived: v.boolean(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { organizationId, paginationOpts }) => {
    const result = await ctx.db
      .query("suppliers")
      .withIndex("by_organizationId_and_status_and_nameKey", (q) => q.eq("organizationId", organizationId))
      .paginate(paginationOpts);
    return {
      page: result.page.map((s) => ({
        id: s._id,
        name: s.name,
        registryOrgNumber: s.registryOrgNumber,
        externalKey: s.externalKey,
        archived: s.status === "archived",
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
