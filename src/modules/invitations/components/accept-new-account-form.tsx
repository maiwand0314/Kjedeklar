"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { acceptWithNewAccountAction, type AcceptNewAccountState } from "../actions";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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
      <Field
        id="name"
        label="Navn"
        name="name"
        autoComplete="name"
        required
        maxLength={100}
      />
      <Field
        id="password"
        label={`Velg passord (minst ${MIN} tegn)`}
        ref={passwordRef}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN}
      />
      <Field
        id="confirm"
        label="Gjenta passord"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      {(state.status === "error" || signInError) && (
        <p role="alert" className="text-danger">
          {state.status === "error" ? state.message : signInError}
        </p>
      )}
      <Button type="submit" disabled={pending || state.status === "ok"}>
        {pending ? "Oppretter konto …" : "Godta og opprett konto"}
      </Button>
    </form>
  );
}
