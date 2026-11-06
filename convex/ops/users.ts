import type { ActionCtx } from "../_generated/server";
import { createAuth } from "../auth";

/**
 * Oppretter (eller finner) en e-post/passord-bruker via Better Auths interne
 * adapter. Åpen registrering er av, så dette er eneste vei inn utenom
 * kontrollert invitasjon. Kun for interne funksjoner.
 */
export async function ensurePasswordUser(
  ctx: ActionCtx,
  input: { email: string; name: string; password: string },
): Promise<string> {
  if (input.password.length < 12) {
    throw new Error("Passordet må ha minst 12 tegn.");
  }
  const auth = createAuth(ctx);
  const context = await auth.$context;
  const email = input.email.toLowerCase();
  const existing = await context.internalAdapter.findUserByEmail(email);
  if (existing) return existing.user.id;
  const user = await context.internalAdapter.createUser(
    { email, name: input.name, emailVerified: true },
    { method: "admin" },
  );
  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await context.password.hash(input.password),
  });
  return user.id;
}
