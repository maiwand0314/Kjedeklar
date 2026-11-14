"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { TextAreaField } from "@/components/ui/textarea-field";
import { LEVEL_LABELS } from "@/domain/risk/labels";
import { checkRationale, OVERRIDE_LEVELS, RATIONALE_MESSAGES, type ReviewDecision, type ScreeningLevel } from "@/domain/risk/review";
import { recordReviewAction } from "../actions";

/**
 * Skjema for kundens vurdering av screeningen. Verdiene som følger med er det brukeren så (screening og gjeldende
 * vurdering); Convex avviser lagringen hvis noen av dem har endret seg. Begrunnelsen kontrolleres her for rask
 * tilbakemelding og på nytt i Convex.
 */
export function ReviewForm({
  organizationId,
  supplierId,
  reportingPeriodId,
  assessmentId,
  expectedReviewId,
  screeningLevel,
  hasReview,
  disabledReason,
}: {
  organizationId: string;
  supplierId: string;
  reportingPeriodId: string;
  assessmentId: string;
  expectedReviewId: string | null;
  screeningLevel: ScreeningLevel;
  /** Finnes det en vurdering som kan trekkes tilbake? */
  hasReview: boolean;
  /** Satt når screeningen er utdatert: bekreftelse og overstyring er stengt til den er kjørt på nytt. */
  disabledReason?: string;
}) {
  const [decision, setDecision] = useState<ReviewDecision>("confirm");
  const [chosenLevel, setChosenLevel] = useState<string>("");
  const [rationale, setRationale] = useState("");
  const [note, setNote] = useState("");
  const [rationaleError, setRationaleError] = useState<string>();
  const [levelError, setLevelError] = useState<string>();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const options: [ReviewDecision, string][] = [
    ["confirm", "Bekreft screeningen"],
    ["override", "Overstyr nivået"],
    ...(hasReview ? ([["revoke", "Trekk vurderingen tilbake"]] as [ReviewDecision, string][]) : []),
  ];
  const stale = disabledReason !== undefined && decision !== "revoke";

  const submit = () => {
    const check = checkRationale(rationale);
    setRationaleError(check.ok ? undefined : RATIONALE_MESSAGES[check.reason]);
    const missingLevel = decision === "override" && !chosenLevel;
    setLevelError(missingLevel ? "Velg nivået du overstyrer til." : undefined);
    if (!check.ok || missingLevel) return;
    startTransition(async () => {
      const outcome = await recordReviewAction(organizationId, {
        supplierId, reportingPeriodId, assessmentId, expectedReviewId, decision,
        ...(decision === "override" && { chosenLevel }),
        rationale, evidenceNote: note.trim() || undefined,
      });
      setResult({ ok: outcome.status === "ok", text: outcome.message ?? "Noe gikk galt. Prøv igjen." });
      // Hele siden lastes på nytt, så vurderingen, historikken og neste forventede vurdering stemmer med serveren.
      if (outcome.status === "ok") window.location.reload();
    });
  };

  return (
    <form
      className="flex max-w-2xl flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Hva vil du gjøre?</legend>
        {options.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input type="radio" name="decision" value={value} checked={decision === value} onChange={() => setDecision(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      {decision === "override" && (
        <SelectField
          id="chosen-level"
          label="Overstyr til"
          hint={`Screeningen er ${LEVEL_LABELS[screeningLevel].toLowerCase()}. Den står uendret ved siden av din vurdering.`}
          value={chosenLevel}
          error={levelError}
          onChange={(e) => setChosenLevel(e.target.value)}
        >
          <option value="">Velg nivå</option>
          {OVERRIDE_LEVELS.filter((l) => l !== screeningLevel).map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABELS[l]}
            </option>
          ))}
        </SelectField>
      )}
      <TextAreaField
        id="rationale"
        label="Begrunnelse"
        hint="Forklar hva du har lagt til grunn. Begrunnelsen lagres sammen med vurderingen, ditt navn og tidspunktet."
        value={rationale}
        error={rationaleError}
        onChange={(e) => setRationale(e.target.value)}
        maxLength={5000}
      />
      <TextAreaField
        id="evidence-note"
        label="Henvisning til dokumentasjon (valgfritt)"
        hint="For eksempel navn på en rapport eller et møte. Ikke legg inn personopplysninger."
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={5000}
      />
      {stale && <p role="alert">{disabledReason}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || stale}>
          Lagre vurderingen
        </Button>
        {result && (
          <p role={result.ok ? "status" : "alert"} className={result.ok ? undefined : "text-danger"}>
            {result.text}
          </p>
        )}
      </div>
    </form>
  );
}
