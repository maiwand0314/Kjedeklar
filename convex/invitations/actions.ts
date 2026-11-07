import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  authUserIdByEmail,
  createPasswordUser,
  deleteAuthUser,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../auth";
import { appError } from "../lib/errors";
import { invitationAction, invitationInvalid } from "../lib/invitation";

/**
 * Ny bruker godtar invitasjonen og velger passord. E-postadressen tas fra
 * invitasjonen, aldri fra brukeren, og regnes som verifisert fordi lenken med
 * tokenet ble sendt dit. Kontoen opprettes, så forbrukes invitasjonen i en egen
 * mutasjon som validerer på nytt; feiler den, slettes kontoen igjen.
 */
export const acceptWithNewAccount = invitationAction({
  args: { name: v.string(), password: v.string() },
  returns: v.object({ organizationId: v.id("organizations"), email: v.string() }),
  handler: async (ctx, args): Promise<{ organizationId: Id<"organizations">; email: string }> => {
    const name = args.name.trim();
    if (
      name.length < 1 ||
      name.length > 100 ||
      args.password.length < PASSWORD_MIN_LENGTH ||
      args.password.length > PASSWORD_MAX_LENGTH
    ) {
      throw appError("INVALID_INPUT");
    }
    const { invitation } = ctx;
    if (await authUserIdByEmail(ctx, invitation.email)) throw appError("ACCOUNT_EXISTS");

    let userId: string;
    try {
      userId = await createPasswordUser(ctx, {
        email: invitation.email,
        name,
        password: args.password,
        emailVerified: true,
      });
    } catch {
      // Typisk et samtidig forsøk som opprettet kontoen først.
      throw invitationInvalid();
    }
    try {
      const organizationId = await ctx.runMutation(internal.invitations.internal.consumeForUser, {
        invitationId: invitation.invitationId,
        tokenHash: invitation.tokenHash,
        userId,
      });
      return { organizationId, email: invitation.email };
    } catch {
      await deleteAuthUser(ctx, userId);
      throw invitationInvalid();
    }
  },
});
