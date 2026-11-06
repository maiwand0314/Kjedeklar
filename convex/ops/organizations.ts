import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const statusValidator = v.union(v.literal("active"), v.literal("inactive"));

/**
 * Kontrollert bootstrap av workspace og medlemskap. Intern: kan bare kalles fra
 * annen Convex-kode eller med admin/deploy key, aldri fra klient eller Next.js.
 * Idempotent på organisasjonsnavn + bruker.
 */
export const ensureOrganizationWithMember = internalMutation({
  args: {
    name: v.string(),
    country: v.string(),
    userId: v.string(),
    membershipStatus: statusValidator,
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const organizations = await ctx.db.query("organizations").collect();
    let organization = organizations.find((o) => o.name === args.name);
    const organizationId =
      organization?._id ??
      (await ctx.db.insert("organizations", {
        name: args.name,
        country: args.country,
        status: "active",
      }));
    organization ??= (await ctx.db.get("organizations", organizationId))!;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", organizationId).eq("userId", args.userId),
      )
      .unique();
    if (!membership) {
      await ctx.db.insert("memberships", {
        organizationId,
        userId: args.userId,
        role: "admin",
        status: args.membershipStatus,
      });
    } else if (membership.status !== args.membershipStatus) {
      await ctx.db.patch("memberships", membership._id, {
        status: args.membershipStatus,
      });
    }
    return organizationId;
  },
});
