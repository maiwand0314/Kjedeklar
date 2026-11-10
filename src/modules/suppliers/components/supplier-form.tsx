"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { INDUSTRY_CODE_SYSTEMS, normalizeSupplier, type SupplierErrors, type SupplierProfile } from "@/domain/suppliers/supplier";
import { saveSupplierAction } from "../actions";

export type SupplierFormValues = Record<keyof SupplierProfile, string>;
export type CountryOption = { code: string; name: string };

/**
 * Leverandørprofil: ny leverandør (uten `target`) eller endring. Tomme felt
 * lagres som ukjent. `rowVersion` er versjonen skjemaet bygger på; har noen
 * andre lagret i mellomtiden, avviser Convex endringen.
 */
export function SupplierForm({
  organizationId,
  countries,
  initial,
  target,
  createdHref,
}: {
  organizationId: string;
  countries: CountryOption[];
  initial: SupplierFormValues;
  target?: { supplierId: string; rowVersion: number };
  /** Hvor en ny leverandør åpnes etter lagring; `:id` byttes med id-en. */
  createdHref?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  // Nyeste kjente versjon: egen lagring eller siden (f.eks. etter arkivering), det som er høyest.
  const [savedVersion, setRowVersion] = useState(0);
  const rowVersion = Math.max(savedVersion, target?.rowVersion ?? 0);
  const [errors, setErrors] = useState<SupplierErrors>({});
  const [message, setMessage] = useState<{ status: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const bind = (field: keyof SupplierProfile) => ({
    id: `supplier-${field}`,
    value: values[field],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: e.target.value })),
    error: errors[field],
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = normalizeSupplier(values);
    setErrors("errors" in parsed ? parsed.errors : {});
    setMessage(null);
    if ("errors" in parsed) return;
    startTransition(async () => {
      const outcome = await saveSupplierAction(
        organizationId,
        target ? { supplierId: target.supplierId, expectedRowVersion: rowVersion } : null,
        values,
      );
      if (outcome.status === "ok" && outcome.supplierId && createdHref) {
        router.push(createdHref.replace(":id", outcome.supplierId));
        return;
      }
      setMessage({ status: outcome.status === "ok" ? "ok" : "error", text: outcome.message ?? "" });
      if (outcome.status === "ok" && outcome.rowVersion) {
        setRowVersion(outcome.rowVersion);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Navn" {...bind("name")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Norsk organisasjonsnummer"
          hint="Valgfritt. La feltet stå tomt for utenlandske leverandører eller når nummeret ikke er kjent."
          inputMode="numeric"
          {...bind("registryOrgNumber")}
        />
        <Field
          label="Egen leverandør-ID"
          hint="Valgfritt. For eksempel leverandørnummeret i regnskapssystemet."
          {...bind("externalKey")}
        />
      </div>
      <SelectField
        label="Registreringsland"
        hint="Landet leverandøren er registrert i. Det sier ikke hvor varene eller tjenestene produseres."
        {...bind("registeredCountry")}
      >
        <option value="">Ukjent</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Kodeverk for bransjekode" {...bind("industryCodeSystem")}>
          <option value="">Ukjent</option>
          {INDUSTRY_CODE_SYSTEMS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </SelectField>
        <Field label="Bransjekode" hint="For eksempel 46.900. La feltet stå tomt hvis koden er ukjent." {...bind("industryCode")} />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Lagrer …" : target ? "Lagre profilen" : "Opprett leverandør"}
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
