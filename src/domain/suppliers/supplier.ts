/**
 * Leverandørregister: leverandørens profil er adskilt fra innkjøpsdata for en
 * rapportperiode. Ukjent er en lovlig verdi overalt der grunnlaget mangler, og
 * registreringsland sier ingenting om hvor varene produseres.
 */
import { parseKronerToOre } from "../applicability/parse";
import { normalizeOrgNumber } from "../brreg/org-number";
import { isCountryCode } from "./countries";

export const INDUSTRY_CODE_SYSTEMS = [
  ["SN2007", "SN 2007 (norsk næringskode)"],
  ["SN2025", "SN 2025 (norsk næringskode)"],
  ["NACE2", "NACE Rev. 2"],
  ["NACE2.1", "NACE Rev. 2.1"],
] as const;
export type IndustryCodeSystem = (typeof INDUSTRY_CODE_SYSTEMS)[number][0];

export type SupplierProfile = {
  name: string;
  registryOrgNumber?: string;
  externalKey?: string;
  registeredCountry?: string;
  industryCodeSystem?: IndustryCodeSystem;
  industryCode?: string;
};
export type SupplierErrors = Partial<Record<keyof SupplierProfile, string>>;

/**
 * Navn i sammenlignbar form: små bokstaver og enkle mellomrom. Brukes til
 * sortering, søk på starten av navnet og forslag om mulig duplikat.
 */
export const nameKey = (name: string) => name.trim().toLocaleLowerCase("nb").replace(/\s+/g, " ");

const text = (value: string | undefined) => value?.trim() || undefined;

/** Trimmer, fjerner tomme felt og validerer. Samme funksjon i skjemaet og i Convex. */
export function normalizeSupplier(
  raw: Partial<Record<keyof SupplierProfile, string>>,
): { value: SupplierProfile } | { errors: SupplierErrors } {
  const errors: SupplierErrors = {};
  const name = raw.name?.trim().replace(/\s+/g, " ") ?? "";
  if (!name) errors.name = "Skriv navnet på leverandøren.";
  else if (name.length > 200) errors.name = "Navnet kan ikke være lengre enn 200 tegn.";

  const orgInput = text(raw.registryOrgNumber);
  const registryOrgNumber = orgInput && (normalizeOrgNumber(orgInput) ?? undefined);
  if (orgInput && !registryOrgNumber) errors.registryOrgNumber = "Organisasjonsnummeret er ikke gyldig (9 siffer).";

  const externalKey = text(raw.externalKey);
  if (externalKey && externalKey.length > 100) errors.externalKey = "ID-en kan ikke være lengre enn 100 tegn.";

  const registeredCountry = text(raw.registeredCountry);
  if (registeredCountry && !isCountryCode(registeredCountry)) errors.registeredCountry = "Velg et land fra listen.";

  const system = text(raw.industryCodeSystem);
  const industryCodeSystem = INDUSTRY_CODE_SYSTEMS.find(([key]) => key === system)?.[0];
  const industryCode = text(raw.industryCode);
  if (system && !industryCodeSystem) errors.industryCodeSystem = "Velg et kodeverk fra listen.";
  else if (industryCode && !industryCodeSystem) errors.industryCodeSystem = "Velg kodeverket bransjekoden er hentet fra.";
  if (industryCodeSystem && !industryCode) errors.industryCode = "Skriv bransjekoden, eller sett kodeverket til ukjent.";
  else if (industryCode && !/^\d{2}(\.\d{1,3})?$/.test(industryCode)) errors.industryCode = "Skriv koden slik: 46.900 eller 46.";

  if (Object.keys(errors).length > 0) return { errors };
  return {
    value: {
      name,
      ...(registryOrgNumber && { registryOrgNumber }),
      ...(externalKey && { externalKey }),
      ...(registeredCountry && { registeredCountry }),
      ...(industryCodeSystem && industryCode && { industryCodeSystem, industryCode }),
    },
  };
}

/**
 * Innkjøp fra én leverandør i én rapportperiode. `spendOre` mangler når beløpet
 * er ukjent; `0n` er et kjent nullbeløp. Tom liste over produksjonsland betyr at
 * ingen er kjent, aldri at varene produseres i registreringslandet.
 */
export type SupplierPeriodData = {
  spendOre?: bigint;
  purchaseCategory?: string;
  purchaseDescription?: string;
  productionCountries: string[];
  upstreamUnknown: boolean;
};
export type SupplierPeriodForm = {
  spend: string;
  purchaseCategory: string;
  purchaseDescription: string;
  productionCountries: string[];
  upstreamUnknown: boolean;
};
export type SupplierPeriodErrors = Partial<Record<keyof SupplierPeriodForm, string>>;

export const MAX_CATEGORY_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 2000;
/** Convex lagrer beløpet som 64-biters heltall. */
const MAX_SPEND_ORE = 2n ** 63n - 1n;

/** Validerer og rydder innkjøpsdata. Negative beløp (kreditnota) hører til importen, ikke her. */
export function normalizeSupplierPeriod(
  data: SupplierPeriodData,
): { value: SupplierPeriodData } | { errors: SupplierPeriodErrors } {
  const errors: SupplierPeriodErrors = {};
  if (data.spendOre !== undefined && (data.spendOre < 0n || data.spendOre > MAX_SPEND_ORE)) {
    errors.spend = "Beløpet kan ikke være negativt.";
  }
  const purchaseCategory = text(data.purchaseCategory);
  if (purchaseCategory && purchaseCategory.length > MAX_CATEGORY_LENGTH) {
    errors.purchaseCategory = `Kategorien kan ikke være lengre enn ${MAX_CATEGORY_LENGTH} tegn.`;
  }
  const purchaseDescription = text(data.purchaseDescription);
  if (purchaseDescription && purchaseDescription.length > MAX_DESCRIPTION_LENGTH) {
    errors.purchaseDescription = `Beskrivelsen kan ikke være lengre enn ${MAX_DESCRIPTION_LENGTH} tegn.`;
  }
  const productionCountries = [...new Set(data.productionCountries)].sort();
  if (!productionCountries.every(isCountryCode)) errors.productionCountries = "Velg land fra listen.";

  if (Object.keys(errors).length > 0) return { errors };
  return {
    value: {
      ...(data.spendOre !== undefined && { spendOre: data.spendOre }),
      ...(purchaseCategory && { purchaseCategory }),
      ...(purchaseDescription && { purchaseDescription }),
      productionCountries,
      upstreamUnknown: data.upstreamUnknown,
    },
  };
}

/** Skjemaverdier → innkjøpsdata. Tomt beløp er ukjent; «0» er et kjent nullbeløp. */
export function parseSupplierPeriodForm(
  form: SupplierPeriodForm,
): { value: SupplierPeriodData } | { errors: SupplierPeriodErrors } {
  const spendOre = parseKronerToOre(form.spend);
  if (spendOre === undefined) {
    return { errors: { spend: "Skriv beløpet i kroner, for eksempel 125 000 eller 1 250,50. La feltet stå tomt hvis beløpet er ukjent." } };
  }
  return normalizeSupplierPeriod({
    ...(spendOre !== null && { spendOre }),
    purchaseCategory: form.purchaseCategory,
    purchaseDescription: form.purchaseDescription,
    productionCountries: form.productionCountries,
    upstreamUnknown: form.upstreamUnknown,
  });
}
