"use client";

import { useRef, useState, useTransition } from "react";
import { SelectField } from "@/components/ui/select-field";
import { FILE_TOO_LARGE_MESSAGE, MAX_FILE_BYTES, MAX_ROWS, type DecimalFormat, type Delimiter } from "@/domain/import/limits";
import { IMPORT_FIELDS, type ColumnMapping, type ImportField } from "@/domain/import/mapping";
import { INDUSTRY_CODE_SYSTEMS, type IndustryCodeSystem } from "@/domain/suppliers/supplier";
import { previewSupplierImportAction, type ImportPreview as Preview } from "../../import-actions";
import { PreviewTable } from "./preview-table";

/** Valgene brukeren kan gjøre. Det som mangler, foreslår serveren ut fra filen. */
type Choices = { delimiter?: Delimiter; mapping?: ColumnMapping; decimal?: DecimalFormat; industryCodeSystem?: IndustryCodeSystem };

const DELIMITER_LABELS: Record<Delimiter, string> = { ";": "Semikolon (;)", ",": "Komma (,)" };
const DECIMAL_LABELS: Record<DecimalFormat, string> = {
  auto: "Automatisk (sier fra om tvetydige beløp)",
  comma: "Komma: 1.234 leses som 1 234 kroner",
  dot: "Punktum: 1,234 leses som 1 234 kroner",
};

/**
 * Opplasting og forhåndsvisning av en CSV-fil. Filen holdes i nettleseren og
 * sendes på nytt hver gang et valg endres; den lagres ikke på serveren, og
 * forhåndsvisningen endrer ingenting i leverandørregisteret.
 */
export function ImportPreview({ organizationId }: { organizationId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Bare svaret på den siste forespørselen brukes, så et tregt eldre svar ikke overskriver et nyere.
  const latest = useRef(0);

  function run(target: File, choices: Choices) {
    const request = ++latest.current;
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("file", target);
      data.set("options", JSON.stringify(choices));
      let result;
      try {
        result = await previewSupplierImportAction(organizationId, data);
      } catch {
        result = { status: "rejected" as const, message: "Filen kunne ikke lastes opp. Prøv igjen." };
      }
      if (request !== latest.current) return;
      if (result.status === "rejected") {
        setPreview(null);
        setError(result.message);
      } else {
        setPreview(result);
      }
    });
  }

  function onFile(selected: File | undefined) {
    latest.current++;
    setFile(selected ?? null);
    setFileCount((n) => n + 1);
    setPreview(null);
    setError(null);
    if (!selected) return;
    // Avvis for store filer før de lastes opp.
    if (selected.size > MAX_FILE_BYTES) return setError(FILE_TOO_LARGE_MESSAGE);
    run(selected, {});
  }

  /** Endrer ett valg og henter forhåndsvisningen på nytt med alle gjeldende valg. */
  function change(changes: Choices) {
    if (!file || !preview) return;
    const { delimiter, mapping, decimal, industryCodeSystem } = preview;
    run(file, { delimiter, mapping, decimal, industryCodeSystem, ...changes });
  }

  function setColumn(field: ImportField, value: string) {
    if (!preview) return;
    const mapping = { ...preview.mapping };
    if (value === "") delete mapping[field];
    else mapping[field] = Number(value);
    change({ mapping });
  }

  const summary = preview?.summary;
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="fil-heading">
        <h2 id="fil-heading" className="text-xl font-semibold">
          1. Velg fil
        </h2>
        <div className="mt-4 flex flex-col gap-1">
          <label htmlFor="import-file" className="font-medium">
            CSV-fil
          </label>
          <p id="import-file-hint" className="text-sm text-muted">
            Lagret som UTF-8, med komma eller semikolon som skilletegn og overskrifter i første rad. Høyst 2 MB og{" "}
            {MAX_ROWS.toLocaleString("nb-NO")} rader.
          </p>
          <input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            aria-describedby="import-file-hint"
            className="rounded border border-input bg-background px-3 py-2"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
        <p role="status" className="mt-2 min-h-6 text-sm text-muted">
          {pending ? "Leser filen …" : preview ? "Forhåndsvisningen er oppdatert." : ""}
        </p>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </section>

      {preview && file && (
        <>
          <section aria-labelledby="kolonner-heading">
            <h2 id="kolonner-heading" className="text-xl font-semibold">
              2. Kontroller kolonnene
            </h2>
            <p className="mt-1 text-sm text-muted">
              Kolonnene er foreslått ut fra overskriftene i «{file.name}». Endre valgene hvis forslaget er feil;
              forhåndsvisningen oppdateres med en gang.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <SelectField
                id="import-delimiter"
                label="Skilletegn i filen"
                value={preview.delimiter}
                // Nytt skilletegn gir andre kolonner, så kolonnevalget foreslås på nytt.
                onChange={(e) => change({ delimiter: e.target.value as Delimiter, mapping: undefined })}
              >
                {Object.entries(DELIMITER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="import-decimal"
                label="Desimaltegn i beløp"
                value={preview.decimal}
                onChange={(e) => change({ decimal: e.target.value as DecimalFormat })}
              >
                {Object.entries(DECIMAL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              {IMPORT_FIELDS.map((field) => (
                <SelectField
                  key={field.key}
                  id={`import-column-${field.key}`}
                  label={field.key === "spend" ? "Innkjøp i perioden (kroner)" : field.label}
                  value={preview.mapping[field.key] ?? ""}
                  onChange={(e) => setColumn(field.key, e.target.value)}
                >
                  <option value="">{field.key === "name" ? "Velg kolonne" : "Ikke i filen"}</option>
                  {preview.headers.map((header, index) => (
                    <option key={index} value={index}>
                      Kolonne {index + 1}: {header}
                    </option>
                  ))}
                </SelectField>
              ))}
              {preview.mapping.industryCode !== undefined && (
                <SelectField
                  id="import-industry-system"
                  label="Kodeverk for bransjekodene"
                  value={preview.industryCodeSystem ?? ""}
                  onChange={(e) => change({ industryCodeSystem: (e.target.value || undefined) as IndustryCodeSystem | undefined })}
                >
                  <option value="">Velg kodeverk</option>
                  {INDUSTRY_CODE_SYSTEMS.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              )}
            </div>
            {preview.problems.length > 0 && (
              <ul role="alert" className="mt-4 flex flex-col gap-1 text-danger">
                {preview.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="rader-heading">
            <h2 id="rader-heading" className="text-xl font-semibold">
              3. Gå gjennom radene
            </h2>
            <p className="mt-1 text-sm text-muted">
              Ingenting er lagret. Forhåndsvisningen endrer ikke leverandørregisteret, og filen lagres ikke. Import av
              radene er ikke tilgjengelig ennå.
            </p>
            {summary && preview.rows.length > 0 && (
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[14rem_1fr]" data-testid="import-summary">
                <dt className="text-muted">Rader i filen</dt>
                <dd>
                  {preview.rowCount}: {summary.ready} klare, {summary.clarify} må avklares, {summary.error} med feil
                </dd>
                <dt className="text-muted">Forslag til matching</dt>
                <dd>
                  {summary.proposedNew} nye leverandører, {summary.proposedExisting} finnes fra før, {summary.proposedUnclear} må
                  avklares
                </dd>
              </dl>
            )}
            {preview.rows.length > 0 && (
              <div className="mt-6">
                {/* Ny fil gir ny tabell, så filter og side starter på nytt. Nye valg beholder dem. */}
                <PreviewTable key={fileCount} preview={preview} organizationId={organizationId} />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
