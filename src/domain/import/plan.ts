/**
 * Fra forhåndsvisning til importgrunnlag. Radene i filen blir til oppføringer,
 * én per leverandør: rader med samme organisasjonsnummer eller leverandør-ID
 * slås sammen, og beløpene summeres. Hver oppføring får en type som avgjør
 * hvilke valg brukeren må ta før importen kan bekreftes.
 */
import type { MatchProposal } from "./match";
import type { ImportRow, ImportValues, RowIssue } from "./normalize";

/** Endres når tolking, sammenslåing eller regler endres, så et eldre grunnlag ikke kan bekreftes. */
export const IMPORT_MAPPING_VERSION = "csv-import-v1";
/** Et grunnlag som ikke er bekreftet innen denne tiden, må lages på nytt. */
export const IMPORT_TTL_MS = 24 * 60 * 60 * 1000;
/** Så mange radnummer lagres per oppføring. Antallet lagres alltid. */
const MAX_SOURCE_ROWS = 20;

export type ImportEntry = ImportRow & {
  /** Radene i filen oppføringen bygger på (de første). `rowNumber` er den første. */
  sourceRows: number[];
  sourceRowCount: number;
};

/**
 * - `new_clean`: ny leverandør uten avklaringer. Opprettes uten eget valg.
 * - `new_warning`: ny leverandør med avklaringer. Brukeren velger opprett eller utelat.
 * - `known`: sikkert treff på org.nr. eller leverandør-ID. Brukeren velger oppdater eller hopp over.
 * - `unclear`: navnetreff eller motstridende treff. Brukeren velger leverandør, ny eller utelat.
 * - `error`: kan ikke importeres. Må rettes i filen eller utelates uttrykkelig.
 */
export const ENTRY_KINDS = ["new_clean", "new_warning", "known", "unclear", "error"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export type Decision = "create" | "update" | "skip";

const hasError = (row: { issues: RowIssue[] }) => row.issues.some((i) => i.level === "error");

function rowList(numbers: number[]): string {
  const shown = numbers.slice(0, 3);
  const rest = numbers.length - shown.length;
  const tail = rest > 0 ? `${rest} til` : String(shown.pop());
  return `rad ${shown.length > 0 ? `${shown.join(", ")} og ${tail}` : tail}`;
}

/** Slår sammen radene til én oppføring: første verdi som finnes per felt, og summen av kjente beløp. */
function merge(rows: ImportRow[]): ImportEntry {
  const first = <K extends keyof ImportValues>(key: K) => rows.map((r) => r.values[key]).find((v) => v !== undefined);
  const amounts = rows.flatMap((r) => (r.values.spendOre === undefined ? [] : [r.values.spendOre]));
  const values: ImportValues = {};
  for (const key of ["name", "registryOrgNumber", "externalKey", "registeredCountry", "industryCode", "purchaseCategory", "purchaseDescription"] as const) {
    const value = first(key);
    if (value !== undefined) values[key] = value;
  }
  if (amounts.length > 0) values.spendOre = amounts.reduce((sum, ore) => sum + ore, 0n);

  // Dublettmeldingene fra forhåndsvisningen erstattes av én melding om sammenslåingen.
  const issues: RowIssue[] = [];
  for (const issue of rows.flatMap((r) => r.issues)) {
    if (issue.code.startsWith("duplicate_") && rows.length > 1) continue;
    if (!issues.some((i) => i.code === issue.code)) issues.push(issue);
  }
  const numbers = rows.map((r) => r.rowNumber);
  if (rows.length > 1) {
    issues.push({
      level: "warning",
      code: "aggregated",
      message: `Slått sammen fra ${rows.length} rader i filen (${rowList(numbers)}) med samme organisasjonsnummer eller leverandør-ID. Beløpet er summen av radene.`,
    });
  }
  if (values.spendOre !== undefined && values.spendOre < 0n) {
    issues.push({ level: "error", code: "amount_negative_total", field: "spend", message: "Beløpet for leverandøren er negativt og kan ikke lagres som innkjøp. Rett filen eller utelat oppføringen." });
  }
  return { rowNumber: numbers[0], source: rows[0].source, values, issues, sourceRows: numbers.slice(0, MAX_SOURCE_ROWS), sourceRowCount: rows.length };
}

/**
 * Rader → oppføringer, i filens rekkefølge. Rader med feil står alene og må
 * utelates uttrykkelig. Rader som deler org.nr. eller leverandør-ID er samme
 * leverandør; peker de på mer enn ett org.nr. eller mer enn én ID, er det en
 * motstrid brukeren må rette i filen.
 */
export function buildEntries(rows: readonly ImportRow[]): ImportEntry[] {
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const seen = new Map<string, number>();
  rows.forEach((row, i) => {
    if (hasError(row)) return;
    const { registryOrgNumber, externalKey } = row.values;
    for (const key of [registryOrgNumber && `org:${registryOrgNumber}`, externalKey && `key:${externalKey}`]) {
      if (!key) continue;
      const other = seen.get(key);
      if (other === undefined) seen.set(key, i);
      else parent[find(i)] = find(other);
    }
  });
  const groups = new Map<number, ImportRow[]>();
  rows.forEach((row, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), row]));

  const entries: ImportEntry[] = [];
  for (const group of groups.values()) {
    const distinct = (key: "registryOrgNumber" | "externalKey") => new Set(group.flatMap((r) => r.values[key] ?? [])).size;
    if (distinct("registryOrgNumber") <= 1 && distinct("externalKey") <= 1) {
      entries.push(merge(group));
      continue;
    }
    for (const row of group) {
      const others = group.filter((r) => r !== row).map((r) => r.rowNumber);
      const entry = merge([row]);
      entry.issues.push({
        level: "error",
        code: "identity_conflict",
        message: `Raden deler organisasjonsnummer eller leverandør-ID med ${rowList(others)}, men radene peker ikke på én og samme leverandør. Rett filen eller utelat radene.`,
      });
      entries.push(entry);
    }
  }
  return entries.sort((a, b) => a.rowNumber - b.rowNumber);
}

/** Typen avgjør hvilke valg som finnes. Feil går foran alt annet. */
export function entryKind(entry: { issues: RowIssue[] }, match: MatchProposal): EntryKind {
  if (hasError(entry) || match.kind === "none") return "error";
  if (match.kind === "org_number" || match.kind === "external_key") return "known";
  if (match.kind === "name" || match.kind === "conflict") return "unclear";
  return entry.issues.length > 0 ? "new_warning" : "new_clean";
}

/** Valgene brukeren kan ta for en oppføring. Tom liste finnes ikke: alt kan utelates. */
export function allowedDecisions(kind: EntryKind, matchKind: MatchProposal["kind"]): Decision[] {
  if (kind === "error") return ["skip"];
  if (kind === "known") return ["update", "skip"];
  // Ved motstridende treff finnes org.nr. eller ID allerede, så en ny leverandør ville bli en dublett.
  if (kind === "unclear") return matchKind === "name" ? ["update", "create", "skip"] : ["update", "skip"];
  return ["create", "skip"];
}

/** Felles valg for alle oppføringer av en type. Bare typer som kan avgjøres samlet. */
export type ImportPolicy = { known?: "update" | "skip"; new_warning?: "create" | "skip"; error?: "skip"; unclear?: "skip" };

/**
 * Valget som gjelder for en oppføring: eget valg, ellers fellesvalget for typen.
 * Nye leverandører uten avklaringer opprettes. `undefined` betyr at brukeren
 * ikke har tatt stilling, og da kan ikke importen bekreftes.
 */
export function effectiveDecision(entry: { kind: EntryKind; decision?: Decision }, policy: ImportPolicy): Decision | undefined {
  if (entry.decision) return entry.decision;
  if (entry.kind === "new_clean") return "create";
  return policy[entry.kind];
}

/** Stabil tekst for hashing av grunnlaget: samme fil, valg og periode gir samme tekst. */
export function fingerprint(entries: readonly ImportEntry[], context: Record<string, unknown>): string {
  return JSON.stringify(
    { version: IMPORT_MAPPING_VERSION, context, entries: entries.map((e) => [e.sourceRows, e.sourceRowCount, e.values, e.issues.map((i) => i.code)]) },
    (_key, value) => (typeof value === "bigint" ? `${value}n` : value),
  );
}
