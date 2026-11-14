/** Norske tekster for risikovisningen. Nivå vises alltid med tekst, aldri bare med farge. */
import type { ListLevel, ReviewDecision, ReviewState } from "./review";

export const LEVEL_LABELS: Record<ListLevel, string> = {
  high: "Høy",
  unknown: "Ukjent",
  moderate: "Moderat",
  low: "Lav",
  not_assessed: "Ikke vurdert",
};

export const GROUP_HEADINGS: Record<ListLevel, string> = {
  high: "Høy screening",
  unknown: "Ukjent – krever oppfølging",
  not_assessed: "Ikke vurdert – kjør screening",
  moderate: "Moderat screening",
  low: "Lav screening",
};

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  none: "Ikke gjennomgått",
  confirmed: "Bekreftet",
  overridden: "Overstyrt",
  revoked: "Trukket tilbake",
  outdated: "Utdatert – bekreft på nytt",
};

export const DECISION_LABELS: Record<ReviewDecision, string> = {
  confirm: "Bekreftet screeningen",
  override: "Overstyrt til nytt nivå",
  revoke: "Trukket tilbake",
};

export const DATA_QUALITY_LABELS = {
  complete: "Fullstendig",
  incomplete: "Ufullstendig",
  insufficient: "Utilstrekkelig",
} as const;

export const FACTOR_LABELS: Record<string, string> = {
  country: "Produksjonsland",
  industry: "Bransje",
  product: "Produktkategori",
  registry_status: "Registerstatus",
  data_gap: "Datamangel",
};

const FIELD_LABELS: Record<string, string> = {
  productionCountries: "Kjente produksjonsland",
  countryCoverage: "Landet finnes ikke i landdataene",
  countryData: "Landdata",
  industryCode: "Næringskode",
  industryMapping: "Bransjemapping",
  industryData: "Bransjedata",
  productCategory: "Produktkategori",
  productMapping: "Produktkategorien finnes ikke i bransjedataene",
  upstream: "Leddene bak leverandøren",
};

const REASON_LABELS: Record<string, string> = {
  missing: "mangler",
  not_covered: "dekkes ikke av datasettet (ukjent, ikke lav)",
  source_unavailable: "ingen aktiv kilde",
  code_system_mismatch: "kodeverket er et annet enn kildens",
  unknown_upstream: "er ukjent",
};

export const describeMissing = (m: { field: string; reason: string; detail?: string }) =>
  `${FIELD_LABELS[m.field] ?? m.field}: ${REASON_LABELS[m.reason] ?? m.reason}${m.detail ? ` (${m.detail})` : ""}`;

export const SOURCE_LABELS: Record<string, string> = { country: "Landdata", industry: "Bransjedata", method: "Metode" };
export const FRESHNESS_LABELS: Record<string, string> = {
  review_overdue: "gjennomgangen er utløpt",
  unreviewed: "ikke gjennomgått",
  current: "gjeldende",
};

export const STALE_REASON_LABELS: Record<string, string> = {
  input_changed: "Leverandør, innkjøpsdata eller registerstatus er endret",
  method_changed: "Aktiv metodeversjon er en annen",
  country_data_changed: "Aktiv landdataversjon er en annen",
  industry_data_changed: "Aktiv bransjedataversjon er en annen",
  engine_changed: "Beregningsmotoren er endret",
  source_freshness_changed: "En kilde er blitt utløpt eller gjennomgått på nytt",
};
