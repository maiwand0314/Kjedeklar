import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Kontrollert bootstrap av workspace og medlemskap. Alle funksjonene er interne:
 * de kan bare kalles fra annen Convex-kode eller med admin/deploy key, aldri fra
 * klient eller Next.js.
 *
 * Navn er ikke en identitet. En organisasjon identifiseres bare med sin id, og
 * medlemskap legges alltid til en eksplisitt organizationId.
 */

const membershipStatus = v.union(v.literal("active"), v.literal("inactive"));

/** Oppretter alltid en ny organisasjon med brukeren som aktiv admin. */
export const createWorkspace = internalMutation({
  args: { name: v.string(), country: v.string(), userId: v.string() },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      country: args.country,
      status: "active",
    });
    await ctx.db.insert("memberships", {
      organizationId,
      userId: args.userId,
      role: "admin",
      status: "active",
    });
    return organizationId;
  },
});

/** Setter medlemskap i en eksplisitt, eksisterende organisasjon. Idempotent. */
export const setMembership = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
    status: membershipStatus,
  },
  returns: v.id("memberships"),
  handler: async (ctx, args) => {
    const organization = await ctx.db.get("organizations", args.organizationId);
    if (!organization) throw new Error("Organisasjonen finnes ikke.");
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .unique();
    if (existing) {
      if (existing.status !== args.status) {
        await ctx.db.patch("memberships", existing._id, { status: args.status });
      }
      return existing._id;
    }
    return await ctx.db.insert("memberships", {
      organizationId: args.organizationId,
      userId: args.userId,
      role: "admin",
      status: args.status,
    });
  },
});

/** Organisasjoner der brukeren har medlemskap (alle statuser). For seed-idempotens. */
export const organizationIdsForUser = internalQuery({
  args: { userId: v.string() },
  returns: v.array(v.id("organizations")),
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(100);
    return memberships.map((m) => m.organizationId);
  },
});
