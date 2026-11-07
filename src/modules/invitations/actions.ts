"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/convex/_generated/api";
import { fetchAuthAction, fetchAuthMutation, fetchAuthQuery } from "@/lib/auth-server";
import { errorMessage } from "@/lib/convex-errors";

/**
 * Server actions er tynne: all validering og autorisasjon skjer i Convex.
 * Next.js har innebygd origin-kontroll for server actions (CSRF).
 */
export type FormState = { status: "idle" | "ok" | "error"; message?: string };

export async function createInvitationAction(
  organizationId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await fetchAuthMutation(api.invitations.mutations.create, {
      organizationId,
      email: String(formData.get("email") ?? ""),
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath(`/o/${organizationId}`);
  return { status: "ok", message: "Invitasjonen er sendt." };
}

export async function revokeInvitationAction(organizationId: string, invitationId: string) {
  await fetchAuthMutation(api.invitations.mutations.revoke, { organizationId, invitationId });
  revalidatePath(`/o/${organizationId}`);
}

export type AcceptNewAccountState =
  | { status: "idle" | "error"; message?: string }
  | { status: "ok"; email: string; organizationId: string };

export async function acceptWithNewAccountAction(
  token: string,
  _previous: AcceptNewAccountState,
  formData: FormData,
): Promise<AcceptNewAccountState> {
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) {
    return { status: "error", message: "Passordene er ikke like." };
  }
  try {
    const result = await fetchAuthAction(api.invitations.actions.acceptWithNewAccount, {
      token,
      name: String(formData.get("name") ?? ""),
      password,
    });
    return { status: "ok", email: result.email, organizationId: result.organizationId };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export type InvitationPreview = {
  organizationName: string;
  email: string;
  accountExists: boolean;
} | null;

/** Tokenet kommer i POST-body (server action), aldri i URL. */
export async function lookupInvitationAction(token: string): Promise<InvitationPreview> {
  try {
    const result = await fetchAuthQuery(api.invitations.queries.lookup, { token });
    return {
      organizationName: result.organizationName,
      email: result.email,
      accountExists: result.accountExists,
    };
  } catch {
    return null;
  }
}

export async function acceptAsCurrentUserAction(
  token: string,
): Promise<{ ok: true; organizationId: string } | { ok: false; message: string }> {
  try {
    const { organizationId } = await fetchAuthMutation(
      api.invitations.mutations.acceptAsCurrentUser,
      { token },
    );
    return { ok: true, organizationId };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function verifyEmailAction(token: string): Promise<boolean> {
  try {
    return (await fetchAuthAction(api.account.actions.verifyEmail, { token })).ok;
  } catch {
    return false;
  }
}
