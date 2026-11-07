import { v } from "convex/values";
import { z } from "zod";
import { internal } from "../_generated/api";
import { authUserIdByEmail, normalizeEmail } from "../auth";
import { appError } from "../lib/errors";
import { invitationMutation } from "../lib/invitation";
import { getOwned, tenantMutation } from "../lib/tenant";
import { consumeInvitation, INVITATION_TTL_MS } from "./model";

const emailSchema = z.email().max(254);

/**
 * Admin inviterer en ny administrator til valgt organisasjon. En ventende
 * invitasjon til samme adresse fornyes (nytt token, gammel lenke slutter å
 * virke) i stedet for å dupliseres. Tokenet lages i e-postjobben.
 */
export const create = tenantMutation({
  args: { email: v.string() },
  returns: v.object({ invitationId: v.id("invitations") }),
  handler: async (ctx, args) => {
    const parsed = emailSchema.safeParse(normalizeEmail(args.email));
    if (!parsed.success) throw appError("INVALID_INPUT");
    const email = parsed.data;
    const organizationId = ctx.tenant.organizationId;

    const existingUserId = await authUserIdByEmail(ctx, email);
    if (existingUserId) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_organizationId_and_userId", (q) =>
          q.eq("organizationId", organizationId).eq("userId", existingUserId),
        )
        .unique();
      if (membership?.status === "active") throw appError("ALREADY_MEMBER");
    }

    const now = Date.now();
    const expiresAt = now + INVITATION_TTL_MS;
    const pending = (
      await ctx.db
        .query("invitations")
        .withIndex("by_organizationId_and_email", (q) =>
          q.eq("organizationId", organizationId).eq("email", email),
        )
        .take(50)
    ).find((i) => i.status === "pending");

    let invitationId;
    if (pending) {
      invitationId = pending._id;
      await ctx.db.patch("invitations", pending._id, {
        expiresAt,
        tokenHash: undefined,
        invitedBy: ctx.tenant.userId,
      });
    } else {
      invitationId = await ctx.db.insert("invitations", {
        organizationId,
        email,
        status: "pending",
        expiresAt,
        invitedBy: ctx.tenant.userId,
      });
    }
    await ctx.scheduler.runAfter(0, internal.email.actions.sendInvitation, { invitationId });
    return { invitationId };
  },
});

/** Tilbakekaller en ventende invitasjon i valgt organisasjon. */
export const revoke = tenantMutation({
  args: { invitationId: v.string() },
  returns: v.null(),
  handler: async (ctx, { invitationId }) => {
    const invitation = await getOwned(ctx, "invitations", invitationId);
    if (invitation.status === "pending") {
      await ctx.db.patch("invitations", invitation._id, {
        status: "revoked",
        revokedAt: Date.now(),
        tokenHash: undefined,
      });
    }
    return null;
  },
});

/** Innlogget bruker med riktig, verifisert e-post godtar invitasjonen. */
export const acceptAsCurrentUser = invitationMutation({
  args: {},
  returns: v.object({ organizationId: v.id("organizations") }),
  handler: async (ctx) => ({
    organizationId: await consumeInvitation(ctx.db, ctx.invitation, ctx.user.id, Date.now()),
  }),
});
