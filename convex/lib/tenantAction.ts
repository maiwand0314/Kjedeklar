/**
 * Tenant-byggekloss for actions (nettverkskall, f.eks. Brreg). Actions har ingen
 * `ctx.db`; medlemskap verifiseres i en intern query som får brukerens
 * identitet fra actionen. Skriving skjer bare via interne mutasjoner som får
 * `organizationId` fra den verifiserte konteksten, aldri fra klienten.
 */
import { customAction } from "convex-helpers/server/customFunctions";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalQuery, type ActionCtx } from "../_generated/server";
import { resolveTenant, type Tenant } from "./tenant";

/** Intern: kjeden sesjon → medlemskap → aktiv organisasjon → rolle, for actions. */
export const resolve = internalQuery({
  args: { organizationId: v.string() },
  returns: v.object({
    organizationId: v.id("organizations"),
    userId: v.string(),
    role: v.literal("admin"),
    membershipId: v.id("memberships"),
  }),
  handler: async (ctx, { organizationId }) => await resolveTenant(ctx, organizationId, ["admin"]),
});

async function tenantActionInput(
  ctx: ActionCtx,
  { organizationId }: { organizationId: string },
): Promise<{ ctx: { tenant: Tenant }; args: Record<string, never> }> {
  const tenant: Tenant = await ctx.runQuery(internal.lib.tenantAction.resolve, { organizationId });
  return { ctx: { tenant }, args: {} };
}

/** Action i valgt organisasjon. Kun redigerende roller (kun `admin` i MVP). */
export const tenantAction = customAction(action, {
  args: { organizationId: v.string() },
  input: tenantActionInput,
});
