/**
 * Gjør radene i en CSV-tabell om til normaliserte leverandørverdier med
 * avklaringer per rad. Ingenting gjettes: en verdi som ikke kan tolkes sikkert,
 * blir stående uten normalisert verdi og får en synlig melding.
 */
import { normalizeOrgNumber } from "../brreg/org-number";
import { MAX_CATEGORY_LENGTH, MAX_DESCRIPTION_LENGTH, nameKey, type IndustryCodeSystem } from "../suppliers/supplier";
import { parseAmount } from "./amount";
import { parseCountry } from "./country";
import type { CsvTable } from "./csv";
import type { DecimalFormat } from "./limits";
import type { ColumnMapping, ImportField } from "./mapping";

/** «error»: verdien kan ikke brukes slik den står. «warning»: brukeren må ta stilling til noe. */
export type IssueLevel = "error" | "warning";
export type RowIssue = { level: IssueLevel; code: string; field?: ImportField; message: string };

export type ImportValues = {
  name?: string;
  registryOrgNumber?: string;
  externalKey?: string;
  /** ISO 3166-1 alfa-2. Mangler når landet er ukjent. */
  registeredCountry?: string;
  /** Øre i NOK. Mangler når beløpet er ukjent; kan være negativt (med avklaring). */
  spendOre?: bigint;
  industryCode?: string;
  purchaseCategory?: string;
  purchaseDescription?: string;
};

export type ImportRow = {
  /** Rad i filen slik et regneark viser den (overskriftsraden er rad 1). */
  rowNumber: number;
  /** Teksten i filen for hvert valgt felt, avkortet for visning. */
  source: Partial<Record<ImportField, string>>;
  values: ImportValues;
  issues: RowIssue[];
};

export type NormalizeOptions = { mapping: ColumnMapping; decimal: DecimalFormat; industryCodeSystem?: IndustryCodeSystem };

const MAX_SOURCE_LENGTH = 200;
const clip = (text: string) => (text.length > MAX_SOURCE_LENGTH ? `${text.slice(0, MAX_SOURCE_LENGTH)}…` : text);
const tidy = (text: string) => text.trim().replace(/\s+/g, " ");

/**
 * Navnet uten selskapsform og tegnsetting, for å finne mulige dubletter:
 * «Oslo Bygg AS», «OSLO BYGG A/S» og «Oslo Bygg» gir samme nøkkel. Brukes bare
 * til forslag, aldri til automatisk sammenslåing.
 */
export function matchKey(name: string): string {
  const key = nameKey(name).replace(/[.,/]/g, "").replace(/\s+/g, " ").trim();
  const base = key.replace(/(?: (?:as|asa|ans|da|enk|sa|ks|ba|nuf|ab|aps|oy|ltd|limited|inc|gmbh|bv|llc|plc))+$/, "");
  return base || key;
}

const AMOUNT_MESSAGES = {
  format: "Beløpet kan ikke leses. Skriv tall i kroner, for eksempel 125 000 eller 1 250,50.",
  currency: "Beløpet er oppgitt i en annen valuta enn norske kroner. Regn om til NOK.",
  decimals: "Beløpet har flere enn to desimaler med valgt desimaltegn.",
  too_large: "Beløpet er for stort.",
} as const;

/** «NO 920 000 002 MVA» → «920000002». Null hvis det ikke er et gyldig norsk organisasjonsnummer. */
function parseOrgNumber(raw: string): string | null {
  return normalizeOrgNumber(raw.replace(/^NO/i, "").replace(/MVA$/i, "").replace(/[\s.]/g, ""));
}

export function normalizeRows(table: CsvTable, { mapping, decimal, industryCodeSystem }: NormalizeOptions): ImportRow[] {
  const rows = table.rows.map((row): ImportRow => {
    const issues: RowIssue[] = [];
    const add = (level: IssueLevel, code: string, message: string, field?: ImportField) => issues.push({ level, code, message, field });
    const source: ImportRow["source"] = {};
    const cell = (field: ImportField) => {
      const column = mapping[field];
      const text = column === undefined ? "" : tidy(row.cells[column] ?? "");
      if (column !== undefined && text !== "") source[field] = clip(text);
      return text;
    };
    const values: ImportValues = {};

    if (row.quoteError) add("error", "quotes", "Raden har feil bruk av anførselstegn og kan være lest feil. Rett raden i filen.");
    if (row.cells.length > table.headers.length) {
      add("error", "too_many_fields", "Raden har flere felt enn overskriftsraden. Kontroller skilletegn og anførselstegn.");
    } else if (row.cells.length < table.headers.length) {
      add("warning", "too_few_fields", "Raden har færre felt enn overskriftsraden. Felt som mangler, regnes som tomme.");
    }

    const name = cell("name");
    if (!name) add("error", "name_missing", "Navn mangler.", "name");
    else if (name.length > 200) add("error", "name_too_long", "Navnet er lengre enn 200 tegn.", "name");
    else {
      values.name = name;
      if (/^[=+\-@]/.test(name)) {
        add("warning", "name_formula", `Navnet starter med «${name[0]}», som regneark kan tolke som en formel. Det behandles som vanlig tekst. Kontroller at navnet er riktig.`, "name");
      }
    }

    const orgNumber = cell("registryOrgNumber");
    if (orgNumber) {
      const normalized = parseOrgNumber(orgNumber);
      if (normalized) values.registryOrgNumber = normalized;
      else add("error", "org_number_invalid", "Organisasjonsnummeret er ikke et gyldig norsk organisasjonsnummer (9 siffer).", "registryOrgNumber");
    }

    const externalKey = cell("externalKey");
    if (externalKey.length > 100) add("error", "external_key_too_long", "Leverandør-ID-en er lengre enn 100 tegn.", "externalKey");
    else if (externalKey) values.externalKey = externalKey;

    const country = cell("registeredCountry");
    const code = parseCountry(country);
    if (code) values.registeredCountry = code;
    else if (code === undefined) {
      add("warning", "country_unknown", "Landet kjennes ikke igjen. Bruk landkode (for eksempel NO) eller landets navn. Uten rettelse står landet som ukjent.", "registeredCountry");
    }

    const amount = parseAmount(cell("spend"), decimal);
    if (amount.kind === "ok") {
      values.spendOre = amount.ore;
      if (amount.ore < 0n) add("warning", "amount_negative", "Beløpet er negativt (for eksempel en kreditnota). Avklar om raden skal være med.", "spend");
    } else if (amount.kind === "ambiguous") {
      add("warning", "amount_ambiguous", "Beløpet kan leses på to måter. Velg om punktum eller komma er desimaltegn i filen.", "spend");
    } else if (amount.kind === "invalid") {
      add("error", `amount_${amount.reason}`, AMOUNT_MESSAGES[amount.reason], "spend");
    }

    const industryCode = cell("industryCode");
    if (industryCode && industryCodeSystem) {
      if (/^\d{2}(\.\d{1,3})?$/.test(industryCode)) values.industryCode = industryCode;
      else add("error", "industry_code_invalid", "Bransjekoden kan ikke leses. Skriv koden slik: 46.900 eller 46.", "industryCode");
    }

    const category = cell("purchaseCategory");
    if (category.length > MAX_CATEGORY_LENGTH) add("error", "category_too_long", `Kategorien er lengre enn ${MAX_CATEGORY_LENGTH} tegn.`, "purchaseCategory");
    else if (category) values.purchaseCategory = category;

    const description = cell("purchaseDescription");
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      add("error", "description_too_long", `Beskrivelsen er lengre enn ${MAX_DESCRIPTION_LENGTH} tegn.`, "purchaseDescription");
    } else if (description) values.purchaseDescription = description;

    return { rowNumber: row.rowNumber, source, values, issues };
  });
  markDuplicates(rows);
  return rows;
}

/** «rad 3», «rad 3 og 7», «rad 3, 7, 9 og 2 til». */
function rowList(numbers: number[]): string {
  const shown = numbers.slice(0, 3);
  const rest = numbers.length - shown.length;
  const tail = rest > 0 ? `${rest} til` : String(shown.pop());
  return `rad ${shown.length > 0 ? `${shown.join(", ")} og ${tail}` : tail}`;
}

/**
 * Dubletter innenfor filen. Samme org.nr. eller leverandør-ID er samme
 * leverandør på flere rader. Likt navn er bare en mulig dublett, og meldes
 * ikke når begge radene har hvert sitt gyldige org.nr.
 */
function markDuplicates(rows: ImportRow[]) {
  const group = (key: (row: ImportRow) => string | undefined) => {
    const groups = new Map<string, ImportRow[]>();
    for (const row of rows) {
      const k = key(row);
      if (k) groups.set(k, [...(groups.get(k) ?? []), row]);
    }
    return [...groups.values()].filter((g) => g.length > 1);
  };
  const mark = (row: ImportRow, others: ImportRow[], code: string, field: ImportField, what: string) => {
    if (others.length === 0) return;
    row.issues.push({ level: "warning", code, field, message: `${what} ${rowList(others.map((o) => o.rowNumber))}.` });
  };
  for (const g of group((r) => r.values.registryOrgNumber)) {
    for (const row of g) mark(row, g.filter((o) => o !== row), "duplicate_org_number", "registryOrgNumber", "Samme organisasjonsnummer som");
  }
  for (const g of group((r) => r.values.externalKey)) {
    for (const row of g) mark(row, g.filter((o) => o !== row), "duplicate_external_key", "externalKey", "Samme leverandør-ID som");
  }
  for (const g of group((r) => r.values.name && matchKey(r.values.name))) {
    for (const row of g) {
      const others = g.filter((o) => o !== row && !(o.values.registryOrgNumber && row.values.registryOrgNumber));
      mark(row, others, "similar_name", "name", "Navnet ligner på navnet i");
    }
  }
}
