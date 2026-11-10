/**
 * Leser en CSV-fil fra bytes til en tabell med tekstceller. Ren funksjon som
 * kjører likt i tester og i Convex. Filinnholdet er ubetrodd tekst: ingenting
 * tolkes som formel, HTML eller kode, og ingenting logges.
 */
import Papa from "papaparse";
import { FILE_TOO_LARGE_MESSAGE, MAX_COLUMNS, MAX_FILE_BYTES, MAX_ROWS, type Delimiter } from "./limits";

export type FileRejection = {
  code: "too_large" | "not_utf8" | "empty" | "no_rows" | "too_many_rows" | "too_many_columns";
  message: string;
};

export type CsvRow = {
  /** Radnummer slik et regneark viser det: overskriftsraden er rad 1. */
  rowNumber: number;
  cells: string[];
  /** Raden kunne ikke leses sikkert på grunn av feil bruk av anførselstegn. */
  quoteError: boolean;
};

export type CsvTable = { delimiter: Delimiter; headers: string[]; rows: CsvRow[] };

const reject = (code: FileRejection["code"], message: string) => ({ rejected: { code, message } });

/**
 * Skilletegnet leses fra overskriftsraden: det av semikolon og komma som
 * forekommer oftest utenfor anførselstegn. Semikolon ved likt antall, fordi
 * norske regneark bruker det og komma da kan være desimaltegn.
 */
export function detectDelimiter(text: string): Delimiter {
  let quoted = false;
  let semicolons = 0;
  let commas = 0;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (char === "\n" || char === "\r") break;
    else if (char === ";") semicolons++;
    else if (char === ",") commas++;
  }
  return commas > semicolons ? "," : ";";
}

/** Bytes → tabell, eller en begrunnet avvisning av hele filen. */
export function readCsv(bytes: ArrayBuffer | Uint8Array, delimiter?: Delimiter): { table: CsvTable } | { rejected: FileRejection } {
  // Størrelsen kontrolleres før noe av innholdet leses.
  if (bytes.byteLength > MAX_FILE_BYTES) return reject("too_large", FILE_TOO_LARGE_MESSAGE);
  let text: string;
  try {
    // `fatal` avviser bytes som ikke er gyldig UTF-8. En eventuell BOM fjernes.
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = "\u0000";
  }
  if (text.includes("\u0000")) {
    return reject(
      "not_utf8",
      "Filen er ikke lagret som UTF-8. Velg «CSV UTF-8 (kommadelt)» når du lagrer fra Excel, og last opp på nytt.",
    );
  }
  if (text.trim() === "") return reject("empty", "Filen er tom.");

  const used = delimiter ?? detectDelimiter(text);
  const parsed = Papa.parse<string[]>(text, { delimiter: used, header: false, skipEmptyLines: false });
  const quoteErrors = new Set(parsed.errors.filter((e) => e.type === "Quotes" && e.row !== undefined).map((e) => e.row));
  // Radnummeret følger posten i filen, også når tomme linjer hoppes over.
  const records = parsed.data
    .map((cells, index) => ({ rowNumber: index + 1, cells, quoteError: quoteErrors.has(index) }))
    .filter((r) => r.cells.some((cell) => cell.trim() !== ""));

  const [header, ...rows] = records;
  if (!header) return reject("empty", "Filen er tom.");
  if (header.cells.length > MAX_COLUMNS) {
    return reject("too_many_columns", `Filen har ${header.cells.length} kolonner. Største tillatte antall er ${MAX_COLUMNS}.`);
  }
  if (rows.length === 0) return reject("no_rows", "Filen har en overskriftsrad, men ingen rader med leverandører.");
  if (rows.length > MAX_ROWS) {
    return reject("too_many_rows", `Filen har ${rows.length} rader. Største tillatte antall er ${MAX_ROWS}. Del filen opp og last opp én del om gangen.`);
  }
  const headers = header.cells.map((cell, index) => cell.trim() || `Kolonne ${index + 1}`);
  return { table: { delimiter: used, headers, rows } };
}
