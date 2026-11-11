"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { allowedDecisions, type Decision, type EntryKind } from "@/domain/import/plan";
import { decideImportRowAction } from "../../import-batch-actions";

export const DECISION_LABELS: Record<Decision, string> = { create: "Opprett ny leverandør", update: "Oppdater innkjøpsdata", skip: "Utelat" };

export type EntryChoice = {
  id: string;
  rowNumber: number;
  kind: EntryKind;
  matchKind: "new" | "none" | "org_number" | "external_key" | "name" | "conflict";
  candidates: { id: string; name: string }[];
  /** Valget som gjelder nå: eget valg eller fellesvalget for typen. */
  decision?: Decision;
  ownDecision: boolean;
  targetSupplierId?: string;
};

/**
 * Valget for én oppføring. Tomt valg følger fellesvalget for typen. «Oppdater»
 * gjelder alltid en av leverandørene grunnlaget foreslo.
 */
export function EntryDecision({ organizationId, batchId, rowVersion, entry }: { organizationId: string; batchId: string; rowVersion: number; entry: EntryChoice }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const allowed = allowedDecisions(entry.kind, entry.matchKind);
  const target = entry.targetSupplierId ?? entry.candidates[0]?.id;
  const saved = !entry.ownDecision ? "" : entry.decision === "update" ? `update:${target}` : (entry.decision ?? "");
  // Valget vises med en gang og lagres i bakgrunnen. Siden gir komponenten ny nøkkel når valgene er lagret.
  const [value, setValue] = useState(saved);
  // Nye leverandører uten avklaringer opprettes uten eget valg; andre følger fellesvalget for typen, hvis det er satt.
  const inherited = entry.ownDecision
    ? null
    : entry.kind === "new_clean"
      ? "Opprettes"
      : entry.decision
        ? `Følger fellesvalget: ${DECISION_LABELS[entry.decision].toLowerCase()}`
        : "Ikke valgt";

  function change(next: string) {
    const [decision, targetSupplierId] = next.split(":") as [Decision | "", string | undefined];
    setValue(next);
    startTransition(async () => {
      const outcome = await decideImportRowAction(organizationId, {
        batchId,
        rowId: entry.id,
        expectedRowVersion: rowVersion,
        decision: decision || null,
        targetSupplierId,
      });
      setError(outcome.status === "error" ? (outcome.message ?? "Noe gikk galt. Prøv igjen.") : null);
      if (outcome.status === "ok") router.refresh();
      else setValue(saved);
    });
  }

  const id = `decision-${entry.id}`;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="font-medium">
        Valg for rad {entry.rowNumber}
      </label>
      <select id={id} value={value} disabled={pending} onChange={(e) => change(e.target.value)} className="min-w-0 max-w-full rounded border border-input bg-background px-2 py-1">
        <option value="">{inherited ?? "Fjern eget valg"}</option>
        {allowed.includes("create") && <option value="create">{DECISION_LABELS.create}</option>}
        {allowed.includes("update") &&
          (entry.kind === "known" ? entry.candidates.slice(0, 1) : entry.candidates).map((c) => (
            <option key={c.id} value={`update:${c.id}`}>
              {DECISION_LABELS.update} for {c.name}
            </option>
          ))}
        <option value="skip">{DECISION_LABELS.skip}</option>
      </select>
      {error && (
        <span role="alert" className="text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
