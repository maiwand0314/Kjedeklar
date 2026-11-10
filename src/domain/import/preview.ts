/**
 * Forhåndsvisning av en CSV-import i to rene steg: først lese og normalisere
 * filen, deretter foreslå matching mot leverandørene organisasjonen har fra før.
 * Stegene er delt fordi Convex-actionen henter leverandørene mellom dem.
 */
import type { IndustryCodeSystem } from "../suppliers/supplier";
import { readCsv, type FileRejection } from "./csv";
import type { DecimalFormat, Delimiter } from "./limits";
import { mappingProblem, suggestMapping, type ColumnMapping } from "./mapping";
import { proposeMatches, type ExistingSupplier, type MatchProposal } from "./match";
import { normalizeRows, type ImportRow } from "./normalize";

export type PreviewOptions = {
  /** Utelatt: leses fra overskriftsraden. */
  delimiter?: Delimiter;
  /** Utelatt: foreslås ut fra overskriftene. */
  mapping?: ColumnMapping;
  decimal?: DecimalFormat;
  /** Kodeverket bransjekodene i filen er hentet fra. Kreves når en kolonne for bransjekode er valgt. */
  industryCodeSystem?: IndustryCodeSystem;
};

export type ParsedImport = {
  delimiter: Delimiter;
  headers: string[];
  mapping: ColumnMapping;
  decimal: DecimalFormat;
  industryCodeSystem?: IndustryCodeSystem;
  /** Ting som må rettes i valgene før forhåndsvisningen er fullstendig. */
  problems: string[];
  rowCount: number;
  /** Tom når kolonnevalget ikke kan brukes (se `problems`). */
  rows: ImportRow[];
};

export function parseImport(bytes: ArrayBuffer | Uint8Array, options: PreviewOptions): { rejected: FileRejection } | ParsedImport {
  const read = readCsv(bytes, options.delimiter);
  if ("rejected" in read) return read;
  const { table } = read;
  const mapping = options.mapping ?? suggestMapping(table.headers);
  const decimal = options.decimal ?? "auto";
  const { industryCodeSystem } = options;
  const blocking = mappingProblem(mapping, table.headers.length);
  const problems = blocking ? [blocking] : [];
  if (!blocking && mapping.industryCode !== undefined && !industryCodeSystem) {
    problems.push("Velg kodeverket bransjekodene er hentet fra. Bransjekodene er ikke med i forhåndsvisningen før det er valgt.");
  }
  return {
    delimiter: table.delimiter,
    headers: table.headers,
    mapping,
    decimal,
    industryCodeSystem,
    problems,
    rowCount: table.rows.length,
    rows: blocking ? [] : normalizeRows(table, { mapping, decimal, industryCodeSystem }),
  };
}

export type PreviewRow = ImportRow & { match: MatchProposal; status: "ready" | "clarify" | "error" };

export type PreviewSummary = {
  ready: number;
  clarify: number;
  error: number;
  /** Forslag: nye leverandører, sikre treff på org.nr. eller ID, og treff som må avklares. */
  proposedNew: number;
  proposedExisting: number;
  proposedUnclear: number;
};

/** Legger forslag til matching på radene og teller opp. */
export function matchImport(rows: ImportRow[], existing: readonly ExistingSupplier[]): { rows: PreviewRow[]; summary: PreviewSummary } {
  const proposals = proposeMatches(rows, existing);
  const summary: PreviewSummary = { ready: 0, clarify: 0, error: 0, proposedNew: 0, proposedExisting: 0, proposedUnclear: 0 };
  const preview = rows.map((row, i): PreviewRow => {
    const match = proposals[i];
    const status = row.issues.some((issue) => issue.level === "error") ? "error" : row.issues.length > 0 ? "clarify" : "ready";
    summary[status]++;
    if (match.kind === "new") summary.proposedNew++;
    else if (match.kind === "org_number" || match.kind === "external_key") summary.proposedExisting++;
    else if (match.kind !== "none") summary.proposedUnclear++;
    return { ...row, match, status };
  });
  return { rows: preview, summary };
}
