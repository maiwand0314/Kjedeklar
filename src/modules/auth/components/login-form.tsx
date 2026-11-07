"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function LoginForm({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { error: signInError } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (signInError) {
      setError(
        signInError.status === 429
          ? "For mange forsøk. Vent litt og prøv igjen."
          : signInError.status === 403
            ? // Vises bare når passordet var riktig, så det røper ikke kontoer.
              "E-postadressen er ikke bekreftet. Vi har sendt deg en ny bekreftelseslenke."
            : "Feil e-post eller passord.",
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      <Field
        id="email"
        label="E-post"
        name="email"
        type="email"
        autoComplete="username"
        required
      />
      <Field
        id="password"
        label="Passord"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Logger inn …" : "Logg inn"}
      </Button>
      <Link href="/glemt-passord" className="text-sm underline">
        Glemt passord?
      </Link>
    </form>
  );
}
