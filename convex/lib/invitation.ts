/**
 * Byggeklosser for invitasjonsaksept. Tokenet i invitasjonslenken er
 * tilgangsbeviset: det gir tilgang til én ventende invitasjon, dens
 * organisasjon og den aksepterende brukerens eget medlemskap der, og ingenting
 * annet (se `invitationRules` i ./rls.ts, default-deny).
 *
 * Ukjent, brukt, utløpt, tilbakekalt token og feil mottaker gir alle samme
 * INVITATION_INVALID, så tokenet eller e-postadressen ikke kan prøves ut.
 */
import {
  customAction,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  wrapDatabaseReader,
  wrapDatabaseWriter,
} from "convex-helpers/server/rowLevelSecurity";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  action,
  type ActionCtx,
  mutation,
  query,
  type QueryCtx,
} from "../_generated/server";
import { currentAuthUser, normalizeEmail } from "../auth";
import { sha256Hex } from "../email/seal";
import { appError, unauthenticated } from "./errors";
import { invitationRules, RLS_CONFIG } from "./rls";

export const invitationInvalid = () => appError("INVITATION_INVALID");

/** Tokenet er 32 tilfeldige byte i base64url (43 tegn). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export type ValidInvitation = {
  invitation: Doc<"invitations">;
  organization: Doc<"organizations">;
};

/** Slår opp en ventende, ikke-utløpt invitasjon i en aktiv organisasjon via tokenhash. */
export async function findValidInvitation(ctx: QueryCtx, token: string): Promise<ValidInvitation> {
  if (!TOKEN_PATTERN.test(token)) throw invitationInvalid();
  const tokenHash = await sha256Hex(token);
  const invitation = await ctx.db
    .query("invitations")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!invitation || invitation.status !== "pending" || invitation.expiresAt <= Date.now()) {
    throw invitationInvalid();
  }
  const organization = await ctx.db.get("organizations", invitation.organizationId);
  if (!organization || organization.status !== "active") throw invitationInvalid();
  return { invitation, organization };
}

const tokenArgs = { token: v.string() };

/** Forhåndsvisning uten innlogging. Leser bare invitasjonen og organisasjonen. */
export const invitationQuery = customQuery(query, {
  args: tokenArgs,
  input: async (ctx, { token }) => {
    const { invitation, organization } = await findValidInvitation(ctx, token);
    const db = wrapDatabaseReader(
      {},
      ctx.db,
      invitationRules({ invitationId: invitation._id, organizationId: invitation.organizationId }),
      RLS_CONFIG,
    );
    return { ctx: { invitation, organization, db }, args: {} };
  },
});

/**
 * Aksept for innlogget bruker. Krever verifisert e-post som er lik
 * invitasjonens mottaker; ellers samme INVITATION_INVALID.
 */
export const invitationMutation = customMutation(mutation, {
  args: tokenArgs,
  input: async (ctx, { token }) => {
    const user = await currentAuthUser(ctx);
    if (!user) throw unauthenticated();
    const { invitation, organization } = await findValidInvitation(ctx, token);
    if (!user.emailVerified || normalizeEmail(user.email) !== invitation.email) {
      throw invitationInvalid();
    }
    const db = wrapDatabaseWriter(
      {},
      ctx.db,
      invitationRules({
        invitationId: invitation._id,
        organizationId: invitation.organizationId,
        userId: user.id,
      }),
      RLS_CONFIG,
    );
    return { ctx: { invitation, organization, user, db }, args: {} };
  },
});

export type InvitationForAction = {
  invitationId: Id<"invitations">;
  organizationId: Id<"organizations">;
  email: string;
  tokenHash: string;
};

/**
 * Aksept med ny konto (uten innlogging). Actions har ingen db; handleren får
 * bare den validerte invitasjonen og må skrive via interne mutasjoner som
 * validerer på nytt.
 */
async function invitationActionInput(
  ctx: ActionCtx,
  { token }: { token: string },
): Promise<{ ctx: { invitation: InvitationForAction }; args: Record<string, never> }> {
  const invitation: InvitationForAction | null = await ctx.runQuery(
    internal.invitations.internal.findValid,
    { token },
  );
  if (!invitation) throw invitationInvalid();
  return { ctx: { invitation }, args: {} };
}

export const invitationAction = customAction(action, {
  args: tokenArgs,
  input: invitationActionInput,
});
