import Link from "next/link";
import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-6 py-24">
      <h1 className="text-2xl font-semibold">Glemt passord</h1>
      <p className="mt-2 text-zinc-700">
        Skriv inn e-postadressen din, så sender vi en lenke for å velge nytt passord.
      </p>
      <ForgotPasswordForm />
      <Link href="/logg-inn" className="mt-6 inline-block text-sm underline">
        Tilbake til innlogging
      </Link>
    </main>
  );
}
