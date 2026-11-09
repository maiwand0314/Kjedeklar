"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { validatePeriod, type PeriodDates, type PeriodErrors } from "@/domain/reporting/period";
import { createReportingPeriodAction } from "../actions";

const FIELDS: Array<[keyof PeriodDates, string, string?]> = [
  ["startDate", "Fra og med"],
  ["endDate", "Til og med"],
  ["publicationDueDate", "Publiseringsfrist", "Fristen virksomheten selv har avklart. Redegjørelsen skal etter åpenhetsloven § 5 offentliggjøres innen 30. juni hvert år."],
];

/** Ny rapportperiode. Datoene er et forslag kunden kan endre; avvikende regnskapsår er tillatt. */
export function PeriodForm({ organizationId, suggestion }: { organizationId: string; suggestion: PeriodDates }) {
  const router = useRouter();
  const [values, setValues] = useState(suggestion);
  const [errors, setErrors] = useState<PeriodErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validatePeriod(values);
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;
    startTransition(async () => {
      const outcome = await createReportingPeriodAction(organizationId, values);
      if (outcome.status === "ok" && outcome.periodId) {
        router.push(`/o/${organizationId}/virksomheten?periode=${outcome.periodId}`);
      } else {
        setError(outcome.message ?? "Noe gikk galt. Prøv igjen.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        {FIELDS.map(([field, label, hint]) => (
          <Field
            key={field}
            id={`period-${field}`}
            type="date"
            label={label}
            hint={hint}
            value={values[field]}
            onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
            error={errors[field]}
          />
        ))}
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Oppretter …" : "Opprett periode"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
