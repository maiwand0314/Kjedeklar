import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { writeAudit } from "../lib/audit";

const system = { type: "system" } as const;

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
    const organization = { name: args.name, country: args.country, status: "active" as const };
    const organizationId = await ctx.db.insert("organizations", organization);
    const membership = { organizationId, userId: args.userId, role: "admin" as const, status: "active" as const };
    const membershipId = await ctx.db.insert("memberships", membership);
    await writeAudit(ctx, {
      organizationId, actor: system, eventType: "organization.provisioned", entityType: "organization",
      entityId: organizationId, after: organization,
    });
    await writeAudit(ctx, {
      organizationId, actor: system, eventType: "membership.created", entityType: "membership",
      entityId: membershipId, after: membership,
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
        await writeAudit(ctx, {
          organizationId: args.organizationId, actor: system, eventType: "membership.status_changed",
          entityType: "membership", entityId: existing._id, before: existing,
          after: { ...existing, status: args.status },
        });
      }
      return existing._id;
    }
    const membership = { organizationId: args.organizationId, userId: args.userId, role: "admin" as const, status: args.status };
    const membershipId = await ctx.db.insert("memberships", membership);
    await writeAudit(ctx, {
      organizationId: args.organizationId, actor: system, eventType: "membership.created",
      entityType: "membership", entityId: membershipId, after: membership,
    });
    return membershipId;
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
