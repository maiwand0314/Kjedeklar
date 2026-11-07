/**
 * Byggekloss for e-postverifisering uten token i URL. Better Auths
 * `/verify-email` tar tokenet som query-parameter (GET), som havner i
 * tilgangslogger. Denne offentlige actionen tar tokenet som argument (i
 * POST-body) og kaller Better Auths eget API i samme prosess.
 *
 * Tokenet er et signert, kortlivet engangstoken fra Better Auth; det er hele
 * tilgangsbeviset. Ingen sesjon kreves og ingen data returneres utover ok/ikke ok.
 */
import { customAction } from "convex-helpers/server/customFunctions";
import { v } from "convex/values";
import { action, type ActionCtx } from "../_generated/server";

const TOKEN_PATTERN = /^[A-Za-z0-9._-]{20,4096}$/;

async function verificationInput(
  _ctx: ActionCtx,
  { token }: { token: string },
): Promise<{ ctx: { verificationToken: string | null }; args: Record<string, never> }> {
  return { ctx: { verificationToken: TOKEN_PATTERN.test(token) ? token : null }, args: {} };
}

export const verificationAction = customAction(action, {
  args: { token: v.string() },
  input: verificationInput,
});
