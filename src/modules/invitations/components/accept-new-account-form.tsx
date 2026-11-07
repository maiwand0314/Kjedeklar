"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { acceptWithNewAccountAction, type AcceptNewAccountState } from "../actions";

const MIN = 12;

export function AcceptNewAccountForm({
  token,
  email,
  onDone,
}: {
  token: string;
  email: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  // React nullstiller skjemaet etter en form action; passordet tas vare på før
  // innsending, så vi kan logge inn med det etterpå.
  const submittedPassword = useRef("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<AcceptNewAccountState, FormData>(
    acceptWithNewAccountAction.bind(null, token),
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status !== "ok") return;
    onDone?.();
    const password = submittedPassword.current;
    void authClient.signIn.email({ email: state.email, password }).then(({ error }) => {
      if (error) {
        setSignInError("Kontoen er opprettet. Logg inn for å fortsette.");
        router.replace("/logg-inn");
        return;
      }
      submittedPassword.current = "";
      router.replace(`/o/${state.organizationId}`);
      router.refresh();
    });
  }, [state, router, onDone]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submittedPassword.current = passwordRef.current?.value ?? "";
      }}
      className="mt-8 flex flex-col gap-4"
    >
      <p>
        Kontoen opprettes for <strong>{email}</strong>.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="font-medium">
          Navn
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          required
          maxLength={100}
          className="rounded border border-input px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="font-medium">
          Velg passord (minst {MIN} tegn)
        </label>
        <input
          ref={passwordRef}
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
      {(state.status === "error" || signInError) && (
        <p role="alert" className="text-danger">
          {state.status === "error" ? state.message : signInError}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || state.status === "ok"}
        className="rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Oppretter konto …" : "Godta og opprett konto"}
      </button>
    </form>
  );
}
