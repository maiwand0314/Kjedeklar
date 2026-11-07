import type { ActionCtx } from "../_generated/server";
import { createAuth, createPasswordUser, normalizeEmail } from "../auth";

/**
 * Oppretter (eller finner) en verifisert e-post/passord-bruker. Kun for interne
 * funksjoner (seed og testfixtures).
 */
export async function ensurePasswordUser(
  ctx: ActionCtx,
  input: { email: string; name: string; password: string; emailVerified?: boolean },
): Promise<string> {
  const email = normalizeEmail(input.email);
  const context = await createAuth(ctx).$context;
  const existing = await context.internalAdapter.findUserByEmail(email);
  if (existing) return existing.user.id;
  return await createPasswordUser(ctx, {
    email,
    name: input.name,
    password: input.password,
    emailVerified: input.emailVerified ?? true,
  });
}
