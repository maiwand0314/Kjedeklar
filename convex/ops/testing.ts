import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { assertLocalEnv } from "./guard";
import { ensurePasswordUser } from "./users";

/**
 * Testfixture for to tenants. Finnes bare på test-backend (KJEDEKLAR_ENV=test og
 * lokal URL). Unik suffix per testkjøring gjør reset unødvendig.
 *
 * - Bruker A: aktivt medlem av org A, inaktivt medlem av org C.
 * - Bruker B: aktivt medlem av org B.
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
    const ensure = internal.ops.organizations.ensureOrganizationWithMember;
    const orgA: Id<"organizations"> = await ctx.runMutation(ensure, {
      name: `Org A ${suffix}`, country: "NO", userId: userA, membershipStatus: "active",
    });
    const orgB: Id<"organizations"> = await ctx.runMutation(ensure, {
      name: `Org B ${suffix}`, country: "NO", userId: userB, membershipStatus: "active",
    });
    const orgC: Id<"organizations"> = await ctx.runMutation(ensure, {
      name: `Org C ${suffix}`, country: "NO", userId: userA, membershipStatus: "inactive",
    });
    return {
      userA: { email: emailA, userId: userA },
      userB: { email: emailB, userId: userB },
      orgA, orgB, orgC,
    };
  },
});
