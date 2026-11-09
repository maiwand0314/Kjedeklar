/**
 * Rapportperiode: eksplisitte kalenderdatoer som `YYYY-MM-DD`-strenger. Ingen
 * antakelse om kalenderår, og fristen er en egen dato kunden setter selv.
 */
export type PeriodDates = { startDate: string; endDate: string; publicationDueDate: string };

/** Feltnavn → norsk feilmelding. Tomt objekt betyr gyldig periode. */
export type PeriodErrors = Partial<Record<keyof PeriodDates, string>>;

/** Ekte kalenderdato på formen YYYY-MM-DD, innenfor 2000–2100. */
export function isIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date ruller 2026-02-30 over til mars; da stemmer ikke måneden lenger.
  return year >= 2000 && year <= 2100 && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validatePeriod({ startDate, endDate, publicationDueDate }: PeriodDates): PeriodErrors {
  const errors: PeriodErrors = {};
  if (!isIsoDate(startDate)) errors.startDate = "Velg en gyldig startdato.";
  if (!isIsoDate(endDate)) errors.endDate = "Velg en gyldig sluttdato.";
  if (!isIsoDate(publicationDueDate)) errors.publicationDueDate = "Velg en gyldig frist.";
  // ISO-datoer sorterer riktig som tekst.
  if (!errors.startDate && !errors.endDate && endDate <= startDate) errors.endDate = "Sluttdatoen må være etter startdatoen.";
  if (!errors.endDate && !errors.publicationDueDate && publicationDueDate < endDate) {
    errors.publicationDueDate = "Fristen kan ikke være før perioden er slutt.";
  }
  return errors;
}

/**
 * Forslag til ny periode: kalenderåret som har neste 30. juni-frist (åpenhetsloven
 * § 5), altså fjoråret til og med juni og inneværende år etterpå. Finnes perioden
 * allerede, foreslås året etter. Bare et forslag; kunden kan endre alle datoene.
 */
export function suggestPeriod(today: string, existing: readonly Pick<PeriodDates, "startDate" | "endDate">[]): PeriodDates {
  let year = Number(today.slice(0, 4)) - (today.slice(5, 7) <= "06" ? 1 : 0);
  const taken = new Set(existing.map((p) => `${p.startDate}/${p.endDate}`));
  while (taken.has(`${year}-01-01/${year}-12-31`)) year++;
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31`, publicationDueDate: `${year + 1}-06-30` };
}

/** «2026-01-31» → «31.01.2026». */
export const formatIsoDate = (iso: string) => iso.split("-").reverse().join(".");

export const formatPeriod = (p: Pick<PeriodDates, "startDate" | "endDate">) =>
  `${formatIsoDate(p.startDate)} – ${formatIsoDate(p.endDate)}`;
