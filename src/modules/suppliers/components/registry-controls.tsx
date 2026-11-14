"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { applyRegistrySuggestionAction, requestMissingRegistryAction, requestRegistryAction } from "../actions";

/** Laster siden på nytt hver femte sekund så lenge noe hentes, så status oppdateres uten at brukeren må gjøre noe. */
export function RefreshWhileQueued({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}

/** `reload`: last hele siden på nytt etter en vellykket handling, så skjemaer med egen tilstand får de nye verdiene. */
function useAction({ reload = false }: { reload?: boolean } = {}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<{ status: string; message?: string }>) =>
    startTransition(async () => {
      const outcome = await action();
      setMessage(outcome.message ? { ok: outcome.status === "ok", text: outcome.message } : outcome.status === "error" ? { ok: false, text: "Noe gikk galt. Prøv igjen." } : null);
      if (outcome.status === "ok") {
        if (reload) window.location.reload();
        else router.refresh();
      }
    });
  const note = message && (
    <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm" : "text-danger"}>
      {message.text}
    </p>
  );
  return { run, pending, note };
}

/** Henter fra Enhetsregisteret for én leverandør. */
export function RequestRegistryButton({ organizationId, supplierId, label }: { organizationId: string; supplierId: string; label: string }) {
  const { run, pending, note } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button variant="secondary" disabled={pending} onClick={() => run(() => requestRegistryAction(organizationId, supplierId))}>
          {label}
        </Button>
      </div>
      {note}
    </div>
  );
}

/** Henter for alle leverandører med norsk org.nr. som ikke er hentet ennå. */
export function RequestMissingRegistryButton({ organizationId }: { organizationId: string }) {
  const { run, pending, note } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button variant="secondary" disabled={pending} onClick={() => run(() => requestMissingRegistryAction(organizationId))}>
          Hent fra Enhetsregisteret for alle
        </Button>
      </div>
      {note}
    </div>
  );
}

/** Ett forslag fra registeret. Ingenting endres før brukeren trykker; næringskoden krever at kodeverket velges. */
export function SuggestionRow({
  organizationId,
  supplierId,
  rowVersion,
  field,
  label,
  current,
  proposed,
  expectedValue,
}: {
  organizationId: string;
  supplierId: string;
  rowVersion: number;
  field: "name" | "registeredCountry" | "industryCode";
  label: string;
  current: string;
  proposed: string;
  /** Forslaget slik serveren ga det; Convex avviser godkjenningen hvis det har endret seg. */
  expectedValue: string;
}) {
  // Profilskjemaet på siden holder egen tilstand (beslutning 0007), så siden lastes på nytt når profilen er endret.
  const { run, pending, note } = useAction({ reload: true });
  const [system, setSystem] = useState<"" | "SN2007" | "SN2025">("");
  const needsSystem = field === "industryCode";
  return (
    <li className="rounded border border-border p-3" data-testid={`suggestion-${field}`}>
      <p>
        <strong>{label}:</strong> {current} → {proposed}
      </p>
      {needsSystem && (
        <SelectField
          id={`system-${field}`}
          label="Kodeverk"
          hint="Enhetsregisteret oppgir ikke hvilken SN-versjon koden følger. Velg versjonen du kjenner til."
          value={system}
          onChange={(e) => setSystem(e.target.value as typeof system)}
        >
          <option value="">Velg kodeverk</option>
          <option value="SN2007">SN 2007</option>
          <option value="SN2025">SN 2025</option>
        </SelectField>
      )}
      <div className="mt-2 flex flex-col gap-2">
        <div>
          <Button
            variant="secondary"
            disabled={pending || (needsSystem && !system)}
            onClick={() =>
              run(() =>
                applyRegistrySuggestionAction(organizationId, {
                  supplierId,
                  expectedRowVersion: rowVersion,
                  field,
                  expectedValue,
                  ...(needsSystem && system && { industryCodeSystem: system }),
                }),
              )
            }
          >
            Bruk registerverdien
          </Button>
        </div>
        {note}
      </div>
    </li>
  );
}
