"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { TextAreaField } from "@/components/ui/textarea-field";
import {
  MAX_CATEGORY_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  parseSupplierPeriodForm,
  type SupplierPeriodErrors,
  type SupplierPeriodForm as Values,
} from "@/domain/suppliers/supplier";
import { saveSupplierPeriodAction } from "../actions";
import type { CountryOption } from "./supplier-form";

/**
 * Innkjøpsdata for én leverandør i valgt rapportperiode. Tomt beløp er ukjent,
 * og produksjonsland legges bare til når de faktisk er kjent.
 */
export function SupplierPeriodForm({
  organizationId,
  supplierId,
  periodId,
  countries,
  initial,
  initialRowVersion,
}: {
  organizationId: string;
  supplierId: string;
  periodId: string;
  countries: CountryOption[];
  initial: Values;
  initialRowVersion: number;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  // Følger bare egen lagring; se SupplierForm.
  const [rowVersion, setRowVersion] = useState(initialRowVersion);
  const [candidate, setCandidate] = useState("");
  const [errors, setErrors] = useState<SupplierPeriodErrors>({});
  const [message, setMessage] = useState<{ status: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const countryNames = new Map(countries.map((c) => [c.code, c.name]));
  const setCountries = (productionCountries: string[]) => setValues((v) => ({ ...v, productionCountries }));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseSupplierPeriodForm(values);
    setErrors("errors" in parsed ? parsed.errors : {});
    setMessage(null);
    if ("errors" in parsed) return;
    startTransition(async () => {
      const outcome = await saveSupplierPeriodAction(
        organizationId,
        { supplierId, reportingPeriodId: periodId, expectedRowVersion: rowVersion },
        values,
      );
      setMessage({ status: outcome.status === "ok" ? "ok" : "error", text: outcome.message ?? "" });
      if (outcome.status === "ok" && outcome.rowVersion) {
        setRowVersion(outcome.rowVersion);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field
        id="period-spend"
        label="Innkjøp i perioden (kroner)"
        hint="La feltet stå tomt hvis beløpet er ukjent. Skriv 0 hvis det ikke var innkjøp i perioden."
        inputMode="decimal"
        value={values.spend}
        onChange={(e) => setValues((v) => ({ ...v, spend: e.target.value }))}
        error={errors.spend}
      />
      <Field
        id="period-category"
        label="Kategori"
        hint="Valgfritt. For eksempel arbeidstøy, IT-utstyr eller renhold."
        maxLength={MAX_CATEGORY_LENGTH}
        value={values.purchaseCategory}
        onChange={(e) => setValues((v) => ({ ...v, purchaseCategory: e.target.value }))}
        error={errors.purchaseCategory}
      />
      <TextAreaField
        id="period-description"
        label="Hva er kjøpt?"
        hint="Valgfritt. Kort beskrivelse av varene eller tjenestene."
        maxLength={MAX_DESCRIPTION_LENGTH}
        value={values.purchaseDescription}
        onChange={(e) => setValues((v) => ({ ...v, purchaseDescription: e.target.value }))}
        error={errors.purchaseDescription}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Kjente produksjonsland</legend>
        <p className="text-sm text-muted">
          Land der varene produseres eller tjenestene utføres. Legg bare til land dere faktisk kjenner til.
          Registreringslandet regnes ikke som produksjonsland.
        </p>
        {values.productionCountries.length === 0 ? (
          <p>Ingen land lagt til. Produksjonslandet står som ukjent.</p>
        ) : (
          <ul aria-label="Valgte produksjonsland" className="flex flex-wrap gap-2">
            {values.productionCountries.map((code) => (
              <li key={code} className="flex items-center gap-2 rounded border border-border px-2 py-1">
                {countryNames.get(code) ?? code}
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => setCountries(values.productionCountries.filter((c) => c !== code))}
                >
                  Fjern<span className="sr-only"> {countryNames.get(code) ?? code}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <SelectField id="period-country" label="Land" value={candidate} onChange={(e) => setCandidate(e.target.value)} error={errors.productionCountries}>
            <option value="">Velg land</option>
            {countries
              .filter((c) => !values.productionCountries.includes(c.code))
              .map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
          </SelectField>
          <Button
            variant="secondary"
            disabled={!candidate}
            onClick={() => {
              setCountries([...values.productionCountries, candidate]);
              setCandidate("");
            }}
          >
            Legg til land
          </Button>
        </div>
      </fieldset>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={values.upstreamUnknown}
          onChange={(e) => setValues((v) => ({ ...v, upstreamUnknown: e.target.checked }))}
          className="mt-1"
        />
        <span>
          Leddene bak leverandøren (underleverandører og råvarer) er ukjente. La krysset stå til dere faktisk har
          kartlagt dem.
        </span>
      </label>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Lagrer …" : "Lagre innkjøpsdata"}
        </Button>
      </div>
      {message?.text && (
        <p role={message.status === "error" ? "alert" : "status"} className={message.status === "error" ? "text-danger" : ""}>
          {message.text}
        </p>
      )}
    </form>
  );
}
