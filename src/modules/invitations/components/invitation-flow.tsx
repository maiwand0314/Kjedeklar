"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { takeFragmentToken } from "@/lib/fragment-token";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import {
  acceptAsCurrentUserAction,
  lookupInvitationAction,
  type InvitationPreview,
} from "../actions";
import { AcceptNewAccountForm } from "./accept-new-account-form";

const STORAGE_KEY = "kjedeklar.invitasjon";

/**
 * Tokenet leses fra fragmentet (#token=...). Hvis brukeren må logge inn først,
 * holdes det i sessionStorage for denne fanen, så det ikke må i URL-en.
 */
function readToken(): string | null {
  const fromLink = takeFragmentToken();
  try {
    if (fromLink) sessionStorage.setItem(STORAGE_KEY, fromLink);
    return fromLink ?? sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return fromLink;
  }
}

function forgetToken() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ingen lagring tilgjengelig; ingenting å rydde.
  }
}

type Props = { signedInEmail: string | null };

export function InvitationFlow({ signedInEmail }: Props) {
  const router = useRouter();
  const [token] = useState(readToken);
  const [preview, setPreview] = useState<InvitationPreview | "loading">(token ? "loading" : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!token) return;
    void lookupInvitationAction(token).then((result) => {
      setPreview(result);
      if (!result) forgetToken();
    });
  }, [token]);

  if (preview === "loading") return <p className="mt-6">Henter invitasjonen …</p>;

  if (!preview || !token) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Invitasjonen er ugyldig eller utløpt</h1>
        <p className="mt-3 text-muted">Be den som inviterte deg om å sende en ny invitasjon.</p>
      </>
    );
  }

  const heading = <h1 className="text-2xl font-semibold">Invitasjon til {preview.organizationName}</h1>;

  if (!signedInEmail) {
    return (
      <>
        {heading}
        {preview.accountExists ? (
          <p className="mt-4">
            Du har allerede en konto.{" "}
            <Link href="/logg-inn?neste=/invitasjon" className="underline">
              Logg inn som {preview.email}
            </Link>{" "}
            for å godta invitasjonen.
          </p>
        ) : (
          <AcceptNewAccountForm token={token} email={preview.email} onDone={forgetToken} />
        )}
      </>
    );
  }

  if (signedInEmail.toLowerCase() !== preview.email) {
    return (
      <>
        {heading}
        <div className="mt-4 flex flex-col gap-4">
          <p>
            Du er logget inn med en annen e-postadresse enn invitasjonen gjelder. Logg ut og logg
            inn som mottakeren.
          </p>
          <LogoutButton />
        </div>
      </>
    );
  }

  return (
    <>
      {heading}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptAsCurrentUserAction(token);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            forgetToken();
            router.replace(`/o/${result.organizationId}`);
            router.refresh();
          })
        }
        className="mt-6 rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Godtar …" : "Godta invitasjonen"}
      </button>
      {error && (
        <p role="alert" className="mt-4 text-danger">
          {error}
        </p>
      )}
    </>
  );
}
