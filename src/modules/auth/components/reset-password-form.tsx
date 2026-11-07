"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { takeFragmentToken } from "@/lib/fragment-token";

const MIN = 12;

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < MIN) return setError(`Passordet må ha minst ${MIN} tegn.`);
    if (password !== String(form.get("confirm") ?? "")) return setError("Passordene er ikke like.");
    setState("pending");
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
    if (resetError) {
      setState("idle");
      setError(
        resetError.status === 429
          ? "For mange forsøk. Vent litt og prøv igjen."
          : "Lenken er ugyldig eller utløpt. Be om en ny.",
      );
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="mt-8">
        <p role="status">Passordet er endret, og du er logget ut på alle enheter.</p>
        <Link href="/logg-inn" className="mt-4 inline-block underline">
          Logg inn
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="font-medium">
          Nytt passord (minst {MIN} tegn)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN}
          className="rounded border border-input px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirm" className="font-medium">
          Gjenta passord
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="rounded border border-input px-3 py-2"
        />
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "pending"}
        className="rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        Lagre nytt passord
      </button>
    </form>
  );
}

/** Leser tokenet fra lenkens fragment og viser skjemaet, eller en feilmelding. */
export function ResetPasswordFromLink() {
  const [token] = useState(takeFragmentToken);
  if (!token) {
    return (
      <div className="mt-6">
        <p role="alert">Lenken er ugyldig eller utløpt.</p>
        <Link href="/glemt-passord" className="mt-4 inline-block underline">
          Be om en ny lenke
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
