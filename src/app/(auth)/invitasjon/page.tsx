import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { InvitationFlowClient as InvitationFlow } from "@/modules/auth/components/client-only";

/**
 * Invitasjonslenke: /invitasjon#token=... Tokenet leses på klienten og sendes
 * bare i POST-body; Convex validerer det i hvert kall.
 */
export default async function InvitationPage() {
  const signedInEmail = (await isAuthenticated())
    ? (await fetchAuthQuery(api.account.queries.me, {})).email
    : null;
  return (
    <main className="mx-auto w-full max-w-md px-6 py-24">
      <InvitationFlow signedInEmail={signedInEmail} />
    </main>
  );
}
