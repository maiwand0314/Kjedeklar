import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { findValidInvitation, invitationInvalid } from "../lib/invitation";
import { consumeInvitation } from "./model";

/** Validerer token for invitationAction. Null ved ugyldig, uten å røpe årsak. */
export const findValid = internalQuery({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      invitationId: v.id("invitations"),
      organizationId: v.id("organizations"),
      email: v.string(),
      tokenHash: v.string(),
    }),
  ),
  handler: async (ctx, { token }) => {
    try {
      const { invitation } = await findValidInvitation(ctx, token);
      return {
        invitationId: invitation._id,
        organizationId: invitation.organizationId,
        email: invitation.email,
        tokenHash: invitation.tokenHash!,
      };
    } catch {
      return null;
    }
  },
});

/**
 * Lagrer hashen av et nytt token (fra e-postjobben). Et tidligere token blir
 * dermed ugyldig. Returnerer null hvis invitasjonen ikke lenger venter.
 */
export const attachToken = internalMutation({
  args: { invitationId: v.id("invitations"), tokenHash: v.string() },
  returns: v.union(
    v.null(),
    v.object({ email: v.string(), organizationName: v.string(), expiresAt: v.number() }),
  ),
  handler: async (ctx, { invitationId, tokenHash }) => {
    const invitation = await ctx.db.get("invitations", invitationId);
    if (!invitation || invitation.status !== "pending" || invitation.expiresAt <= Date.now()) {
      return null;
    }
    const organization = await ctx.db.get("organizations", invitation.organizationId);
    if (!organization || organization.status !== "active") return null;
    await ctx.db.patch("invitations", invitationId, { tokenHash });
    return {
      email: invitation.email,
      organizationName: organization.name,
      expiresAt: invitation.expiresAt,
    };
  },
});

/** Aksept for ny konto. Validerer på nytt i samme transaksjon som medlemskapet opprettes. */
export const consumeForUser = internalMutation({
  args: { invitationId: v.id("invitations"), tokenHash: v.string(), userId: v.string() },
  returns: v.id("organizations"),
  handler: async (ctx, { invitationId, tokenHash, userId }) => {
    const invitation = await ctx.db.get("invitations", invitationId);
    const now = Date.now();
    if (
      !invitation ||
      invitation.status !== "pending" ||
      invitation.tokenHash !== tokenHash ||
      invitation.expiresAt <= now
    ) {
      throw invitationInvalid();
    }
    const organization = await ctx.db.get("organizations", invitation.organizationId);
    if (!organization || organization.status !== "active") throw invitationInvalid();
    return await consumeInvitation(ctx.db, invitation, userId, now);
  },
});
