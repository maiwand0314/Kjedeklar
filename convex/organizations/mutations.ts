import { v } from "convex/values";
import { writeAudit } from "../lib/audit";
import { appError, notFound } from "../lib/errors";
import { tenantMutation } from "../lib/tenant";

/** Admin endrer visningsnavnet på egen organisasjon. Logges med før/etter. */
export const rename = tenantMutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (name.length < 1 || name.length > 200) throw appError("INVALID_INPUT");
    const organization = await ctx.db.get("organizations", ctx.tenant.organizationId);
    if (!organization) throw notFound();
    if (organization.name === name) return null;
    await ctx.db.patch("organizations", organization._id, { name });
    await writeAudit(ctx, {
      organizationId: organization._id,
      actor: { type: "user", id: ctx.tenant.userId },
      eventType: "organization.renamed",
      entityType: "organization",
      entityId: organization._id,
      before: organization,
      after: { ...organization, name },
    });
    return null;
  },
});
