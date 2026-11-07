"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [state, setState] = useState<"idle" | "pending" | "sent" | "limited">("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    const form = new FormData(event.currentTarget);
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email") ?? ""),
      // Lenken i e-posten bygges i Convex (fragment med token); redirectTo brukes ikke.
      redirectTo: "/tilbakestill-passord",
    });
    // Samme svar uansett om adressen finnes (ingen kontooppslag).
    setState(error?.status === 429 ? "limited" : "sent");
  }

  if (state === "sent") {
    return (
      <p role="status" className="mt-8">
        Hvis adressen hører til en konto, har vi sendt en e-post med en lenke for å velge nytt
        passord. Lenken utløper om én time.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="font-medium">
          E-post
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded border border-input px-3 py-2"
        />
      </div>
      {state === "limited" && (
        <p role="alert" className="text-danger">
          For mange forsøk. Vent litt og prøv igjen.
        </p>
      )}
      <button
        type="submit"
        disabled={state === "pending"}
        className="rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        Send lenke
      </button>
    </form>
  );
}
