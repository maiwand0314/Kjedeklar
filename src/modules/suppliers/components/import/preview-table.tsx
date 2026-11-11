"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { formatKroner } from "@/domain/applicability/form";
import { IMPORT_FIELDS, type ImportField } from "@/domain/import/mapping";
import { countryName } from "@/domain/suppliers/countries";
import type { ImportPreview, ImportPreviewRow } from "../../import-actions";

const PAGE_SIZE = 50;
const STATUS = { ready: "Klar", clarify: "Må avklares", error: "Feil" } as const;
const MATCH_REASON = { org_number: "samme organisasjonsnummer", external_key: "samme leverandør-ID" } as const;
const clip = (text: string) => (text.length > 120 ? `${text.slice(0, 120)}…` : text);

/** Normalisert verdi slik den vil bli lagret, som tekst. Null når feltet er ukjent eller ikke kunne tolkes. */
function normalized(field: ImportField, values: ImportPreviewRow["values"]): string | null {
  if (field === "spend") return values.spendOre === undefined ? null : formatKroner(BigInt(values.spendOre));
  if (field === "registeredCountry") return values.registeredCountry ? `${countryName(values.registeredCountry)} (${values.registeredCountry})` : null;
  if (field === "registryOrgNumber") return values.registryOrgNumber?.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3") ?? null;
  const value = values[field];
  return value ? clip(value) : null;
}

function Proposal({ row, organizationId }: { row: ImportPreviewRow; organizationId: string }) {
  const { match } = row;
  if (!("suppliers" in match)) return <>{match.kind === "new" ? "Ny leverandør" : "–"}</>;
  const label =
    match.kind === "name" ? "Mulig treff, må avklares:" : match.kind === "conflict" ? "Motstridende treff, må avklares:" : "Finnes fra før:";
  return (
    <>
      {label}{" "}
      {match.suppliers.map((s, i) => (
        <span key={s.id}>
          {i > 0 && ", "}
          <Link href={`/o/${organizationId}/leverandorer/${s.id}`} className="underline">
            {s.name}
          </Link>
          {s.archived && " (arkivert)"}
        </span>
      ))}
      {(match.kind === "org_number" || match.kind === "external_key") && ` (${MATCH_REASON[match.kind]})`}
    </>
  );
}

/** Felt der verdien er kort og ikke skal brytes over flere linjer. */
const COMPACT: readonly ImportField[] = ["registryOrgNumber", "externalKey", "registeredCountry", "spend", "industryCode"];

/**
 * Radene i forhåndsvisningen. Hver rad i filen vises som to linjer: først den
 * normaliserte verdien og teksten i filen for hvert valgt felt, så forslaget
 * til matching og radens feil og avklaringer i full bredde, så de ikke havner
 * utenfor skjermen. Alt fra filen vises som vanlig tekst.
 */
export function PreviewTable({ preview, organizationId }: { preview: ImportPreview; organizationId: string }) {
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [page, setPage] = useState(0);
  const fields = IMPORT_FIELDS.filter((f) => preview.mapping[f.key] !== undefined && (f.key !== "industryCode" || preview.industryCodeSystem));
  const withIssues = preview.rows.filter((r) => r.status !== "ready");
  const rows = onlyIssues ? withIssues : preview.rows;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Hvilke rader som vises</legend>
        {(
          [
            [false, `Alle rader (${preview.rows.length})`],
            [true, `Bare rader med feil eller avklaringer (${withIssues.length})`],
          ] as const
        ).map(([value, label]) => (
          <label key={label} className="flex items-center gap-2">
            <input
              type="radio"
              name="preview-filter"
              checked={onlyIssues === value}
              onChange={() => {
                setOnlyIssues(value);
                setPage(0);
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {shown.length === 0 ? (
        <p>Ingen rader har feil eller avklaringer.</p>
      ) : (
        <Table caption="Forhåndsvisning av radene i filen">
          <thead>
            <tr>
              <th scope="col">Rad</th>
              <th scope="col">Status</th>
              {fields.map((f) => (
                <th key={f.key} scope="col">
                  {f.label}
                  <span className="block text-xs font-normal text-muted">Kolonne: «{preview.headers[preview.mapping[f.key] ?? 0]}»</span>
                </th>
              ))}
            </tr>
          </thead>
          {/* Én radgruppe per rad i filen: verdiene, og under dem forslag og avklaringer. */}
          {shown.map((row) => (
            <tbody key={row.rowNumber}>
              <tr className="border-b-0! align-top">
                <th scope="row" className="whitespace-nowrap font-normal">
                  {row.rowNumber}
                </th>
                <td className="whitespace-nowrap">{STATUS[row.status]}</td>
                {fields.map((f) => {
                  const value = normalized(f.key, row.values);
                  const source = row.source[f.key];
                  return (
                    <td key={f.key}>
                      <span className={COMPACT.includes(f.key) ? "whitespace-nowrap" : undefined}>
                        {value ?? (source ? "–" : f.key === "name" ? "Mangler" : "Ukjent")}
                      </span>
                      {source && source !== value && <span className="block text-xs text-muted">I filen: «{clip(source)}»</span>}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td />
                <td colSpan={fields.length + 1} className="pt-0!">
                  {/* Holder seg i synsfeltet når tabellen rulles vannrett på smale skjermer. */}
                  <div className="sticky left-0 w-[calc(100cqw-4rem)]">
                    <p>
                      <span className="text-muted">Forslag:</span> <Proposal row={row} organizationId={organizationId} />
                    </p>
                    {row.issues.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-1">
                        {row.issues.map((issue, i) => (
                          <li key={i}>
                            <strong>{issue.level === "error" ? "Feil" : "Må avklares"}:</strong> {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          ))}
        </Table>
      )}
      {pages > 1 && (
        <nav aria-label="Sider i forhåndsvisningen" className="flex items-center gap-4">
          <Button variant="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Forrige
          </Button>
          <span>
            Side {current + 1} av {pages}
          </span>
          <Button variant="secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Neste
          </Button>
        </nav>
      )}
    </div>
  );
}
