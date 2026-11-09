/**
 * Skjemaverdier (tekst) → ApplicabilityInput. Brukes både av forhåndsvisningen i
 * nettleseren og av server-actionen, så begge tolker tallene likt.
 */
import type { Answer, ApplicabilityInput, YearFigures } from "./assess";
import { parseFte, parseKronerToOre } from "./parse";

export type YearValues = { fiscalYear: string; salesRevenue: string; balanceSheetTotal: string; averageFte: string };

export type FormValues = {
  previousYear: YearValues;
  currentYear: YearValues;
  previousStatus: Answer;
  isParentCompany: Answer;
  publicInterestEntity: Answer;
  norwegian: Answer;
};

/** Feltnavn som «currentYear.salesRevenue» → norsk feilmelding. */
export type FormErrors = Record<string, string>;

function parseYear(prefix: string, values: YearValues, errors: FormErrors): YearFigures | undefined {
  const fiscalYear = /^\d{4}$/.test(values.fiscalYear.trim()) ? Number(values.fiscalYear.trim()) : undefined;
  if (fiscalYear === undefined) errors[`${prefix}.fiscalYear`] = "Skriv regnskapsåret med fire siffer.";
  const salesRevenueOre = parseKronerToOre(values.salesRevenue);
  if (salesRevenueOre === undefined) errors[`${prefix}.salesRevenue`] = "Skriv et beløp i kroner, for eksempel 70 000 000.";
  const balanceSheetTotalOre = parseKronerToOre(values.balanceSheetTotal);
  if (balanceSheetTotalOre === undefined) errors[`${prefix}.balanceSheetTotal`] = "Skriv et beløp i kroner, for eksempel 35 000 000.";
  const averageFte = parseFte(values.averageFte);
  if (averageFte === undefined) errors[`${prefix}.averageFte`] = "Skriv antall årsverk, for eksempel 49,5.";
  if (fiscalYear === undefined || salesRevenueOre === undefined || balanceSheetTotalOre === undefined || averageFte === undefined) {
    return undefined;
  }
  return { fiscalYear, salesRevenueOre, balanceSheetTotalOre, averageFte };
}

export function toApplicabilityInput(values: FormValues): { input: ApplicabilityInput } | { errors: FormErrors } {
  const errors: FormErrors = {};
  const previousYear = parseYear("previousYear", values.previousYear, errors);
  const currentYear = parseYear("currentYear", values.currentYear, errors);
  if (!previousYear || !currentYear) return { errors };
  const { previousStatus, isParentCompany, publicInterestEntity, norwegian } = values;
  return { input: { previousYear, currentYear, previousStatus, isParentCompany, publicInterestEntity, norwegian } };
}

const kroner = new Intl.NumberFormat("nb-NO");

/** Øre → «70 000 000 kr» (med øre bare når det finnes). Tom verdi er «ikke oppgitt». */
export function formatKroner(ore: bigint | null): string {
  if (ore === null) return "ikke oppgitt";
  const rest = ore % 100n;
  return `${kroner.format(ore / 100n)}${rest ? `,${String(rest).padStart(2, "0")}` : ""} kr`;
}

/** Øre → tekst for skjemafelt («70000000» eller «70000000,5»), tom når ukjent. */
export function oreToInput(ore: bigint | null): string {
  if (ore === null) return "";
  const rest = ore % 100n;
  return `${ore / 100n}${rest ? `,${String(rest).padStart(2, "0")}` : ""}`;
}

export const RESULT_LABELS = {
  likely_in: "Sannsynlig omfattet",
  likely_out: "Sannsynlig ikke omfattet",
  manual_review: "Må avklares manuelt",
} as const;
