import { ResetPasswordFromLinkClient as ResetPasswordFromLink } from "@/modules/auth/components/client-only";

/** Reset-lenke: /tilbakestill-passord#token=... (token sendes bare i POST-body). */
export default function ResetPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-6 py-24">
      <h1 className="text-2xl font-semibold">Velg nytt passord</h1>
      <ResetPasswordFromLink />
    </main>
  );
}
