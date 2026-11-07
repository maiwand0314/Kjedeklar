import { v } from "convex/values";
import { authUserIdByEmail } from "../auth";
import { invitationQuery } from "../lib/invitation";
import { tenantQuery } from "../lib/tenant";
import { invitationStatus } from "./model";

/**
 * Forhåndsvisning for den som har lenken: organisasjon, mottaker og om det
 * allerede finnes en konto (for å vise «velg passord» eller «logg inn»).
 * Bare den som har tokenet, får vite dette.
 */
export const lookup = invitationQuery({
  args: {},
  returns: v.object({
    organizationName: v.string(),
    email: v.string(),
    accountExists: v.boolean(),
    expiresAt: v.number(),
  }),
  handler: async (ctx) => ({
    organizationName: ctx.organization.name,
    email: ctx.invitation.email,
    accountExists: (await authUserIdByEmail(ctx, ctx.invitation.email)) !== undefined,
    expiresAt: ctx.invitation.expiresAt,
  }),
});

/** Invitasjoner i valgt organisasjon, nyeste først. */
export const listForOrganization = tenantQuery({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("invitations"),
      email: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("revoked"),
        v.literal("expired"),
      ),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const now = Date.now();
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_organizationId_and_email", (q) =>
        q.eq("organizationId", ctx.tenant.organizationId),
      )
      .take(200);
    return invitations
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((i) => ({
        id: i._id,
        email: i.email,
        status: invitationStatus(i, now),
        expiresAt: i.expiresAt,
      }));
  },
});
