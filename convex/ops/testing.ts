import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";
import { assertLocalEnv } from "./guard";
import { ensurePasswordUser } from "./users";

/**
 * Testfixture for to tenants. Finnes bare på test-backend (KJEDEKLAR_ENV=test og
 * lokal URL). Unik suffix per testkjøring gjør reset unødvendig.
 *
 * - Bruker A: aktivt medlem av org A, inaktivt medlem av org C.
 * - Bruker B: aktivt medlem av org B og org C.
 */
export const createTenantFixture = internalAction({
  args: { suffix: v.string(), password: v.string() },
  returns: v.object({
    userA: v.object({ email: v.string(), userId: v.string() }),
    userB: v.object({ email: v.string(), userId: v.string() }),
    orgA: v.id("organizations"),
    orgB: v.id("organizations"),
    orgC: v.id("organizations"),
  }),
  handler: async (ctx, { suffix, password }) => {
    assertLocalEnv(["test"]);
    const emailA = `a-${suffix}@tenant-a.example`;
    const emailB = `b-${suffix}@tenant-b.example`;
    const userA = await ensurePasswordUser(ctx, { email: emailA, name: "Test A", password });
    const userB = await ensurePasswordUser(ctx, { email: emailB, name: "Test B", password });
    const { createWorkspace, setMembership } = internal.ops.organizations;
    const orgA: Id<"organizations"> = await ctx.runMutation(createWorkspace, {
      name: `Org A ${suffix}`, country: "NO", userId: userA,
    });
    const orgB: Id<"organizations"> = await ctx.runMutation(createWorkspace, {
      name: `Org B ${suffix}`, country: "NO", userId: userB,
    });
    // Org C eies av B; A får et inaktivt medlemskap der.
    const orgC: Id<"organizations"> = await ctx.runMutation(createWorkspace, {
      name: `Org C ${suffix}`, country: "NO", userId: userB,
    });
    await ctx.runMutation(setMembership, {
      organizationId: orgC, userId: userA, status: "inactive",
    });
    return {
      userA: { email: emailA, userId: userA },
      userB: { email: emailB, userId: userB },
      orgA, orgB, orgC,
    };
  },
});

/** Test: setter en invitasjon som utløpt. Bare på test-backend. */
export const expireInvitation = internalMutation({
  args: { invitationId: v.id("invitations") },
  returns: v.null(),
  handler: async (ctx, { invitationId }) => {
    assertLocalEnv(["test"]);
    await ctx.db.patch("invitations", invitationId, { expiresAt: Date.now() - 1000 });
    return null;
  },
});

/** Test: bruker med ubekreftet e-post (for å prøve Better Auths verifisering). */
export const createUnverifiedUser = internalAction({
  args: { email: v.string(), password: v.string() },
  returns: v.string(),
  handler: async (ctx, { email, password }) => {
    assertLocalEnv(["test"]);
    return await ensurePasswordUser(ctx, { email, name: "Ubekreftet", password, emailVerified: false });
  },
});
