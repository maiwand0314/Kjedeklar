"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ImportPolicy } from "@/domain/import/plan";
import { continueImportAction, setImportPolicyAction, startImportAction } from "../../import-batch-actions";

type Counts = { new_clean: number; new_warning: number; known: number; unclear: number; error: number };
type PolicyKind = keyof ImportPolicy;

/** Fellesvalgene som finnes for hver type. Tom verdi betyr at brukeren velger for hver oppføring. */
const GROUPS: Array<{ kind: PolicyKind; legend: string; help: string; options: Array<[string, string]> }> = [
  {
    kind: "known",
    legend: "Leverandører som finnes fra før",
    help: "Treff på organisasjonsnummer eller leverandør-ID. Oppdatering erstatter periodens innkjøpsbeløp, kategori og beskrivelse med verdiene fra filen. Leverandørens navn og øvrige profil endres ikke.",
    options: [
      ["update", "Oppdater innkjøpsdata for alle"],
      ["skip", "Hopp over alle"],
    ],
  },
  {
    kind: "new_warning",
    legend: "Nye leverandører med avklaringer",
    help: "For eksempel ukjent land, beløp som ikke kunne leses sikkert, eller flere rader slått sammen. Det som ikke er forstått, lagres som ukjent.",
    options: [
      ["create", "Opprett alle likevel"],
      ["skip", "Utelat alle"],
    ],
  },
  {
    kind: "unclear",
    legend: "Uklare treff",
    help: "Navnet ligner en leverandør som finnes fra før, eller treffene peker i ulike retninger. Velg leverandør for hver oppføring, eller utelat alle.",
    options: [["skip", "Utelat alle"]],
  },
  {
    kind: "error",
    legend: "Rader med feil",
    help: "Kan ikke importeres slik de står. Rett dem i filen og last opp på nytt, eller utelat dem uttrykkelig.",
    options: [["skip", "Utelat alle rader med feil"]],
  },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const INTERRUPTED = "Importen ble avbrutt før den var ferdig. Det som er gjort, er lagret. Velg «Fortsett importen» for å gjøre den ferdig.";

/**
 * Fellesvalg, bekreftelse og gjennomføring av en import. Importen gjennomføres
 * i stykker; knappen kaller serveren til alt er behandlet og viser hvor langt
 * den er kommet. Et avbrudd kan alltid fortsettes.
 */
export function ImportDecisions({
  organizationId,
  batch,
}: {
  organizationId: string;
  batch: { id: string; status: "draft" | "committing"; rowVersion: number; policy: ImportPolicy; kindCounts: Counts; undecided: number; processed: number; entryCount: number };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ processed: number; entryCount: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [pending, startTransition] = useTransition();
  // Valget vises med en gang og lagres i bakgrunnen. Siden gir komponenten ny nøkkel når valgene er lagret.
  const [policy, setShownPolicy] = useState(batch.policy);

  function setPolicy(kind: PolicyKind, value: string) {
    const next = { ...batch.policy, [kind]: value || undefined };
    setShownPolicy(next);
    startTransition(async () => {
      const outcome = await setImportPolicyAction(organizationId, { batchId: batch.id, expectedRowVersion: batch.rowVersion, policy: next });
      setError(outcome.status === "error" ? (outcome.message ?? "Noe gikk galt. Prøv igjen.") : null);
      if (outcome.status === "ok") router.refresh();
      else setShownPolicy(batch.policy);
    });
  }

  /** Bekrefter (når det ikke er gjort) og gjennomfører stykke for stykke til importen er ferdig. */
  async function run() {
    setRunning(true);
    setError(null);
    try {
      if (batch.status === "draft") {
        const confirmed = await startImportAction(organizationId, { batchId: batch.id, expectedRowVersion: batch.rowVersion });
        if (confirmed.status === "error") return setError(confirmed.message ?? "Noe gikk galt. Prøv igjen.");
      }
      for (let collisions = 0; ; ) {
        const step = await continueImportAction(organizationId, batch.id);
        if (step.status === "error") return setError(step.message);
        if (step.status === "retry") {
          // En annen fane gjennomfører samme import. Vent litt og prøv igjen.
          if (++collisions > 20) return setError(INTERRUPTED);
          await delay(300);
          continue;
        }
        collisions = 0;
        setProgress(step);
        if (step.done) return;
      }
    } catch {
      setError(INTERRUPTED);
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  const shown = progress ?? batch;
  return (
    <div className="flex flex-col gap-6">
      {batch.status === "draft" && (
        <div className="flex flex-col gap-6">
          {GROUPS.filter((g) => batch.kindCounts[g.kind] > 0).map((group) => (
            <fieldset key={group.kind} disabled={pending || running} className="flex flex-col gap-2">
              <legend className="font-medium">
                {group.legend} ({batch.kindCounts[group.kind]})
              </legend>
              <p className="text-sm text-muted">{group.help}</p>
              <div className="flex flex-col gap-1">
                {[...group.options, ["", "Velg for hver oppføring"] as [string, string]].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`policy-${group.kind}`}
                      checked={(policy[group.kind] ?? "") === value}
                      onChange={() => setPolicy(group.kind, value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {batch.status === "draft" && batch.undecided > 0 && (
          <p data-testid="import-undecided">
            <strong>{batch.undecided} oppføringer mangler valg.</strong> Importen kan bekreftes når alle har et valg.
          </p>
        )}
        <div>
          <Button disabled={running || pending || (batch.status === "draft" && batch.undecided > 0)} onClick={run}>
            {running ? "Importerer …" : batch.status === "draft" ? "Bekreft og importer" : "Fortsett importen"}
          </Button>
        </div>
        <p role="status" className="min-h-6 text-sm text-muted">
          {(running || batch.status === "committing") && `${shown.processed} av ${shown.entryCount} oppføringer er behandlet.`}
        </p>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
