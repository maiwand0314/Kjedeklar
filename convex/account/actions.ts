import { v } from "convex/values";
import { createAuth } from "../auth";
import { verificationAction } from "../lib/verification";

/**
 * Bekrefter e-postadressen med tokenet fra bekreftelseslenken. Samme svar for
 * ugyldig, utløpt og brukt token.
 */
export const verifyEmail = verificationAction({
  args: {},
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx) => {
    if (!ctx.verificationToken) return { ok: false };
    try {
      await createAuth(ctx).api.verifyEmail({ query: { token: ctx.verificationToken } });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },
});
