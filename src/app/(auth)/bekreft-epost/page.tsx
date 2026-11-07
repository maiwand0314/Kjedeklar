import { VerifyEmailClient as VerifyEmail } from "@/modules/auth/components/client-only";

/** Bekreftelseslenke: /bekreft-epost#token=... (token sendes bare i POST-body). */
export default function VerifyEmailPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-6 py-24">
      <h1 className="text-2xl font-semibold">Bekreft e-postadresse</h1>
      <VerifyEmail />
    </main>
  );
}
