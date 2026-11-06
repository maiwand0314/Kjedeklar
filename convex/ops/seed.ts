import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { assertLocalEnv } from "./guard";
import { ensurePasswordUser } from "./users";

/**
 * Syntetiske utviklingsdata: to organisasjoner med hver sin admin.
 * Passord leses fra SEED_USER_PASSWORD på den lokale deploymenten.
 * Kjør: pnpm seed:dev
 */
export const seedDev = internalAction({
  args: {},
  returns: v.array(v.object({ email: v.string(), organization: v.string() })),
  handler: async (ctx) => {
    assertLocalEnv(["development"]);
    const password = process.env.SEED_USER_PASSWORD;
    if (!password) throw new Error("SEED_USER_PASSWORD mangler.");

    const fixtures = [
      {
        email: "anna.admin@nordlys.example",
        name: "Anna Admin",
        organization: "Nordlys Testvarer AS",
      },
      {
        email: "bjorn.admin@fjordlys.example",
        name: "Bjørn Admin",
        organization: "Fjordlys Syntetisk AS",
      },
    ];
    for (const f of fixtures) {
      const userId = await ensurePasswordUser(ctx, {
        email: f.email,
        name: f.name,
        password,
      });
      await ctx.runMutation(internal.ops.organizations.ensureOrganizationWithMember, {
        name: f.organization,
        country: "NO",
        userId,
        membershipStatus: "active",
      });
    }
    return fixtures.map((f) => ({ email: f.email, organization: f.organization }));
  },
});
