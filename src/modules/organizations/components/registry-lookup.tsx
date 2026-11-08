"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { confirmRegistryAction, lookupRegistryAction } from "../actions";
import { RegistryProfileView } from "./registry-profile";

type LookupResult = Awaited<ReturnType<typeof lookupRegistryAction>>;

const MESSAGES: Record<Exclude<LookupResult["kind"], "found">, string> = {
  invalid_org_number: "Ugyldig organisasjonsnummer. Det må være 9 siffer med gyldig kontrollsiffer.",
  not_found:
    "Fant ingen enhet med dette organisasjonsnummeret i Enhetsregisteret. Bruk hovedenheten, ikke en avdeling (underenhet).",
  removed: "Enheten er fjernet fra Enhetsregisteret og kan ikke brukes.",
  invalid: "Enhetsregisteret avviste organisasjonsnummeret.",
  unavailable: "Enhetsregisteret svarer ikke akkurat nå. Prøv igjen om litt.",
  contract_changed:
    "Svaret fra Enhetsregisteret hadde et uventet format, så det ble ikke brukt. Prøv igjen senere, eller kontakt oss.",
};

type Props = {
  organizationId: string;
  currentName: string;
  currentSnapshotId: string | null;
  currentOrgNumber: string | null;
};

export function RegistryLookup({ organizationId, currentName, currentSnapshotId, currentOrgNumber }: Props) {
  const router = useRouter();
  const [result, setResult] = useState<LookupResult | null>(null);
  const [useRegistryName, setUseRegistryName] = useState(false);
  const [message, setMessage] = useState<{ status: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const orgNumber = String(new FormData(event.currentTarget).get("orgNumber") ?? "");
    setMessage(null);
    setUseRegistryName(false);
    startTransition(async () => {
      try {
        setResult(await lookupRegistryAction(organizationId, orgNumber));
      } catch {
        setResult(null);
        setMessage({ status: "error", text: "Oppslaget feilet. Prøv igjen." });
      }
    });
  }

  function onConfirm() {
    if (result?.kind !== "found") return;
    startTransition(async () => {
      const outcome = await confirmRegistryAction({
        organizationId,
        snapshotId: result.snapshotId,
        expectedCurrentSnapshotId: currentSnapshotId,
        useRegistryName,
      });
      setMessage({ status: outcome.status === "ok" ? "ok" : "error", text: outcome.message ?? "" });
      if (outcome.status === "ok") {
        setResult(null);
        router.refresh();
      }
    });
  }

  const found = result?.kind === "found" ? result : null;
  const nameDiffers = found && found.profile.name !== currentName;
  const orgNumberChanges = found && currentOrgNumber && found.profile.orgNumber !== currentOrgNumber;

  return (
    <div>
      <form onSubmit={onLookup} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field
          id="org-number"
          label="Organisasjonsnummer"
          name="orgNumber"
          inputMode="numeric"
          autoComplete="off"
          required
          className="flex-1"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Henter …" : "Hent fra Enhetsregisteret"}
        </Button>
      </form>

      {result && result.kind !== "found" && (
        <p role="alert" className="mt-4 text-danger">
          {MESSAGES[result.kind]}
        </p>
      )}

      {found && (
        <section aria-labelledby="preview-heading" className="mt-6 rounded border border-border p-4">
          <h3 id="preview-heading" className="font-semibold">
            Kontroller opplysningene før du lagrer
          </h3>
          <div className="mt-3">
            <RegistryProfileView profile={found.profile} fetchedAt={found.fetchedAt} gaps={found.gaps} />
          </div>
          {orgNumberChanges && (
            <p role="note" className="mt-4 font-medium">
              Dette erstatter tidligere bekreftet organisasjonsnummer {currentOrgNumber}.
            </p>
          )}
          {nameDiffers && (
            <label className="mt-4 flex items-start gap-2">
              <input
                type="checkbox"
                checked={useRegistryName}
                onChange={(e) => setUseRegistryName(e.target.checked)}
                className="mt-1"
              />
              <span>
                Bruk registernavnet «{found.profile.name}» som visningsnavn i Kjedeklar (nå: «{currentName}»).
              </span>
            </label>
          )}
          <Button className="mt-4" onClick={onConfirm} disabled={pending}>
            Bekreft og lagre
          </Button>
        </section>
      )}

      {message && (
        <p role={message.status === "error" ? "alert" : "status"} className="mt-4">
          {message.text}
        </p>
      )}
    </div>
  );
}
