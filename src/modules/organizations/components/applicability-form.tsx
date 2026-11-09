"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { assess, type Answer } from "@/domain/applicability/assess";
import { toApplicabilityInput, type FormValues, type YearValues } from "@/domain/applicability/form";
import { assessApplicabilityAction } from "../actions";
import { ApplicabilityResultView } from "./applicability-result";

const QUESTIONS: Array<{ key: "previousStatus" | "isParentCompany" | "publicInterestEntity" | "norwegian"; label: string; hint?: string }> = [
  {
    key: "previousStatus",
    label: "Var virksomheten omfattet av åpenhetsloven for forrige regnskapsår?",
    hint: "Trengs når årene peker hver sin vei: endret status får først virkning det andre året på rad.",
  },
  { key: "isParentCompany", label: "Er virksomheten morselskap i et konsern?" },
  { key: "publicInterestEntity", label: "Er virksomheten et foretak av allmenn interesse (regnskapsloven § 1-6)?", hint: "For eksempel børsnoterte selskaper, banker og forsikringsselskaper." },
  { key: "norwegian", label: "Er virksomheten hjemmehørende i Norge?" },
];
const ANSWERS: Array<[Answer, string]> = [["yes", "Ja"], ["no", "Nei"], ["unknown", "Vet ikke"]];

/** Skjema for grunnlaget, med forhåndsvisning av resultatet før kunden bekrefter og lagrer. */
export function ApplicabilityForm({ organizationId, initial }: { organizationId: string; initial: FormValues }) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initial);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<{ status: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = toApplicabilityInput(values);
  const errors = "errors" in parsed ? parsed.errors : {};
  const preview = "input" in parsed ? assess(parsed.input) : null;

  const setYear = (year: "previousYear" | "currentYear", field: keyof YearValues, value: string) =>
    setValues((v) => ({ ...v, [year]: { ...v[year], [field]: value } }));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || !confirmed) return;
    setMessage(null);
    startTransition(async () => {
      const outcome = await assessApplicabilityAction(organizationId, values);
      setMessage({ status: outcome.status === "ok" ? "ok" : "error", text: outcome.message ?? "" });
      if (outcome.status === "ok") {
        setConfirmed(false);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <p className="text-sm text-muted">
        Tall fra årsregnskapet for to regnskapsår etter hverandre. La felt stå tomt hvis tallet ikke er kjent. Årsverk er
        gjennomsnittlige årsverk i regnskapsåret, ikke antall ansatte fra Enhetsregisteret.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {(["previousYear", "currentYear"] as const).map((year) => (
          <fieldset key={year} className="flex flex-col gap-3 rounded border border-border p-4">
            <legend className="px-1 font-medium">{year === "previousYear" ? "Forrige regnskapsår" : "Siste avsluttede regnskapsår"}</legend>
            {(
              [
                ["fiscalYear", "Regnskapsår", "numeric"],
                ["salesRevenue", "Salgsinntekt (kr)", "decimal"],
                ["balanceSheetTotal", "Balansesum (kr)", "decimal"],
                ["averageFte", "Gjennomsnittlige årsverk", "decimal"],
              ] as const
            ).map(([field, label, inputMode]) => (
              <Field
                key={field}
                id={`${year}-${field}`}
                label={label}
                inputMode={inputMode}
                value={values[year][field]}
                onChange={(e) => setYear(year, field, e.target.value)}
                error={errors[`${year}.${field}`]}
              />
            ))}
          </fieldset>
        ))}
      </div>
      {QUESTIONS.map((q) => (
        <fieldset key={q.key}>
          <legend className="font-medium">{q.label}</legend>
          {q.hint && <p className="text-sm text-muted">{q.hint}</p>}
          <div className="mt-2 flex flex-wrap gap-4">
            {ANSWERS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={q.key}
                  value={value}
                  checked={values[q.key] === value}
                  onChange={() => setValues((v) => ({ ...v, [q.key]: value }))}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <section aria-labelledby="preview-heading" aria-live="polite">
        <h3 id="preview-heading" className="font-semibold">
          Forhåndsvisning
        </h3>
        <div className="mt-2">
          {preview ? (
            <ApplicabilityResultView result={preview.result} reasons={preview.reasons} />
          ) : (
            <p className="text-muted">Rett feltene som er markert for å se resultatet.</p>
          )}
        </div>
      </section>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
        <span>Jeg bekrefter at tallene og svarene over er riktige etter det virksomheten vet.</span>
      </label>
      <div>
        <Button type="submit" disabled={pending || !preview || !confirmed}>
          {pending ? "Lagrer …" : "Lagre vurderingen"}
        </Button>
      </div>
      {message && (
        <p role={message.status === "error" ? "alert" : "status"} className={message.status === "error" ? "text-danger" : ""}>
          {message.text}
        </p>
      )}
    </form>
  );
}
