/**
 * Hvilke kolonner i filen som fylles inn i hvilke felt. Forslaget bygger på
 * overskriftene og er bare et utgangspunkt; brukeren går gjennom det før import.
 */
export const IMPORT_FIELDS = [
  { key: "name", label: "Navn", synonyms: ["navn", "leverandør", "leverandørnavn", "firmanavn", "firma", "selskap", "name", "supplier", "suppliername", "company"] },
  {
    key: "registryOrgNumber",
    label: "Organisasjonsnummer",
    synonyms: ["organisasjonsnummer", "orgnr", "orgnummer", "organisasjonsnr", "foretaksnummer", "orgno", "organizationnumber"],
  },
  {
    key: "externalKey",
    label: "Egen leverandør-ID",
    synonyms: ["leverandørid", "leverandørnummer", "leverandørnr", "levnr", "levid", "supplierid", "suppliernumber", "vendorid"],
  },
  { key: "registeredCountry", label: "Registreringsland", synonyms: ["land", "landkode", "registreringsland", "country", "countrycode"] },
  {
    key: "spend",
    label: "Innkjøp i perioden",
    synonyms: ["innkjøp", "innkjøpnok", "innkjøpkr", "beløp", "beløpnok", "sum", "kjøp", "omsetning", "amount", "spend", "total"],
  },
  { key: "industryCode", label: "Bransjekode", synonyms: ["bransjekode", "næringskode", "nace", "nacekode", "sn2007", "sn2025", "industrycode"] },
  { key: "purchaseCategory", label: "Kategori", synonyms: ["kategori", "varegruppe", "kjøpskategori", "category"] },
  { key: "purchaseDescription", label: "Beskrivelse av kjøpet", synonyms: ["beskrivelse", "kjøpsbeskrivelse", "hvaerkjøpt", "description"] },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
/** Felt → kolonneindeks i filen (0 er første kolonne). Felt som mangler, er ikke med i filen. */
export type ColumnMapping = Partial<Record<ImportField, number>>;

const headerKey = (header: string) => header.toLocaleLowerCase("nb").replace(/[^\p{L}\p{N}]/gu, "");

/** Foreslår kolonne for hvert felt ut fra overskriften. Hver kolonne brukes høyst én gang. */
export function suggestMapping(headers: readonly string[]): ColumnMapping {
  const keys = headers.map(headerKey);
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  for (const field of IMPORT_FIELDS) {
    const index = keys.findIndex((key, i) => !used.has(i) && (field.synonyms as readonly string[]).includes(key));
    if (index === -1) continue;
    mapping[field.key] = index;
    used.add(index);
  }
  return mapping;
}

/** Norsk melding hvis valget av kolonner ikke kan brukes, ellers null. */
export function mappingProblem(mapping: ColumnMapping, columnCount: number): string | null {
  const columns = Object.values(mapping);
  if (columns.some((c) => !Number.isInteger(c) || c < 0 || c >= columnCount)) return "En valgt kolonne finnes ikke i filen. Velg kolonnene på nytt.";
  if (new Set(columns).size !== columns.length) return "Samme kolonne er valgt for flere felt. Velg én kolonne per felt.";
  if (mapping.name === undefined) return "Velg hvilken kolonne som inneholder navnet på leverandøren.";
  return null;
}
