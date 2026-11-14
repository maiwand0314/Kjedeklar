/**
 * Deterministisk screeningmotor (Kjedeklars screening, ikke juridisk vurdering).
 * Ren funksjon av normalisert input, valgte dataversjoner og metodedefinisjon:
 * ingen AI, ingen nettverk, ingen klokke, ingen Convex eller Next.js. Samme
 * input og versjoner gir alltid identisk resultat. Se docs/decisions/risk-method-v0.md.
 *
 * Reglene:
 * 1. Kjent høy faktor gir høy, uansett datamangler og lavere faktorer.
 * 2. Ellers gir en vesentlig datamangel (metodens `unknownPolicy.materialGaps`) ukjent.
 * 3. Ellers høyeste kjente nivå. Uten noen faktor er nivået ukjent, aldri lavt.
 *
 * Innkjøpsbeløp er ikke en del av input og kan derfor ikke påvirke nivået.
 * Registreringsland er heller ikke input: bare kjente produksjonsland teller.
 * Kontrollsignaler (registerstatus, datamangel) gir oppfølging, aldri et nivå.
 */
import { canonicalJson, sha256 } from "./datasets/checksum.ts";
import type { CountryEntry, IndustryEntry, MethodDefinition, ScreeningLevel } from "./datasets/schema.ts";

/** Økes når motorens logikk endres, så eldre vurderinger vises som utdaterte. */
export const ENGINE_VERSION = "risk-engine-v1";

export type Level = ScreeningLevel | "unknown";
const ORDER: Record<ScreeningLevel, number> = { low: 0, moderate: 1, high: 2 };

export type RegistryFacts = {
  bankrupt: boolean | null;
  underLiquidation: boolean | null;
  underForcedLiquidation: boolean | null;
  deleted: boolean;
};

/** Det motoren ser. Ingen beløp, ingen registreringsland, ingen fritekst utover normalisert kategori. */
export type EngineInput = {
  industry: { codeSystem: string; code: string } | null;
  /** Kjente produksjonsland, sortert og uten duplikater. Tom liste er ukjent. */
  productionCountries: string[];
  upstreamUnknown: boolean;
  /** Kjøpskategori i små bokstaver, eller null. */
  purchaseCategory: string | null;
  /** Fra siste hentede registersvar; null når leverandøren ikke er hentet. */
  registry: RegistryFacts | null;
};

export type Freshness = "current" | "review_overdue" | "unreviewed";
type Source = { version: string; freshness: Freshness };

export type EngineData = {
  method: Source & { definition: MethodDefinition };
  country: (Source & { entries: Pick<CountryEntry, "iso2" | "screeningLevel" | "sourceReference">[] }) | null;
  industry:
    | (Source & { codeSystem: string; entries: Pick<IndustryEntry, "codeExact" | "codePrefix" | "productCategory" | "screeningLevel" | "sourceReference">[] })
    | null;
};

export type MissingField = {
  field: "productionCountries" | "countryCoverage" | "countryData" | "industryCode" | "industryMapping" | "industryData" | "productCategory" | "productMapping" | "upstream";
  reason: "missing" | "not_covered" | "source_unavailable" | "code_system_mismatch" | "unknown_upstream";
  detail?: string;
};
export type TriggeredRule = {
  ruleId: string;
  factor: "country" | "industry" | "product";
  level: ScreeningLevel;
  /** Det regelen ble anvendt på, f.eks. landkoden eller næringskoden. */
  input: string;
  sourceRef: { dataset: "country" | "industry"; version: string; entry: string; sourceReference: string };
};
export type ControlSignal = { ruleId: string; factor: "registry_status" | "data_gap"; detail: string };
export type StaleSource = { source: "country" | "industry" | "method"; version: string; freshness: Exclude<Freshness, "current"> };

export type Assessment = {
  screeningLevel: Level;
  /** `insufficient`: nivået er ukjent. `incomplete`: nivået er kjent, men noe mangler eller en kilde er utdatert. */
  dataQuality: "complete" | "incomplete" | "insufficient";
  missingFields: MissingField[];
  triggeredRules: TriggeredRule[];
  controlSignals: ControlSignal[];
  staleSources: StaleSource[];
};

const unique = <T>(values: T[]) => [...new Set(values)];

/** Normaliserer til motorens input. Samme verdier gir alltid samme input (og hash), uansett rekkefølge og store bokstaver. */
export function normalizeInput(raw: {
  industryCodeSystem?: string;
  industryCode?: string;
  productionCountries: readonly string[];
  upstreamUnknown: boolean;
  purchaseCategory?: string;
  registry?: { bankrupt: boolean | null; underLiquidation: boolean | null; underForcedLiquidation: boolean | null; deletedOn: string | null } | null;
}): EngineInput {
  const category = raw.purchaseCategory?.trim().toLowerCase();
  return {
    industry: raw.industryCodeSystem && raw.industryCode ? { codeSystem: raw.industryCodeSystem, code: raw.industryCode } : null,
    productionCountries: unique([...raw.productionCountries]).sort(),
    upstreamUnknown: raw.upstreamUnknown,
    purchaseCategory: category || null,
    registry: raw.registry
      ? {
          bankrupt: raw.registry.bankrupt,
          underLiquidation: raw.registry.underLiquidation,
          underForcedLiquidation: raw.registry.underForcedLiquidation,
          deleted: raw.registry.deletedOn !== null,
        }
      : null,
  };
}

export const inputHash = (input: EngineInput) => sha256(canonicalJson(input));

type Gap = MissingField & { dimension: "productionCountry" | "industryCode" | "productCategory" };

/** Eksakt kode først, ellers lengste prefiks som koden begynner med. */
function matchIndustry(code: string, entries: NonNullable<EngineData["industry"]>["entries"]) {
  const exact = entries.find((e) => e.codeExact === code);
  if (exact) return { entry: exact, key: `exact:${code}` };
  const prefixes = entries.filter((e) => e.codePrefix !== undefined && code.startsWith(e.codePrefix));
  const best = prefixes.reduce<(typeof prefixes)[number] | undefined>((a, b) => (a && a.codePrefix!.length >= b.codePrefix!.length ? a : b), undefined);
  return best ? { entry: best, key: `prefix:${best.codePrefix}` } : null;
}

/** Beregner screeningen. Se filhodet for reglene. */
export function assess(input: EngineInput, data: EngineData): Assessment {
  const { definition } = data.method;
  const rule = (factor: TriggeredRule["factor"]) => definition.ruleDefinitions.find((r) => r.kind === "risk_factor" && r.factor === factor);
  const factors: TriggeredRule[] = [];
  const gaps: Gap[] = [];

  const countryRule = rule("country");
  if (countryRule) {
    if (input.productionCountries.length === 0) gaps.push({ dimension: "productionCountry", field: "productionCountries", reason: "missing" });
    else if (!data.country) gaps.push({ dimension: "productionCountry", field: "countryData", reason: "source_unavailable" });
    else {
      for (const iso2 of input.productionCountries) {
        const entry = data.country.entries.find((e) => e.iso2 === iso2);
        if (!entry) gaps.push({ dimension: "productionCountry", field: "countryCoverage", reason: "not_covered", detail: iso2 });
        else
          factors.push({
            ruleId: countryRule.ruleId, factor: "country", level: entry.screeningLevel, input: iso2,
            sourceRef: { dataset: "country", version: data.country.version, entry: iso2, sourceReference: entry.sourceReference },
          });
      }
    }
  }

  const industryRule = rule("industry");
  if (industryRule) {
    if (!input.industry) gaps.push({ dimension: "industryCode", field: "industryCode", reason: "missing" });
    else if (!data.industry) gaps.push({ dimension: "industryCode", field: "industryData", reason: "source_unavailable" });
    else if (data.industry.codeSystem !== input.industry.codeSystem) {
      gaps.push({ dimension: "industryCode", field: "industryMapping", reason: "code_system_mismatch", detail: `${input.industry.codeSystem} ≠ ${data.industry.codeSystem}` });
    } else {
      const hit = matchIndustry(input.industry.code, data.industry.entries);
      if (!hit) gaps.push({ dimension: "industryCode", field: "industryMapping", reason: "not_covered", detail: input.industry.code });
      else
        factors.push({
          ruleId: industryRule.ruleId, factor: "industry", level: hit.entry.screeningLevel, input: input.industry.code,
          sourceRef: { dataset: "industry", version: data.industry.version, entry: hit.key, sourceReference: hit.entry.sourceReference },
        });
    }
  }

  const productRule = rule("product");
  if (productRule) {
    if (!input.purchaseCategory) gaps.push({ dimension: "productCategory", field: "productCategory", reason: "missing" });
    else if (!data.industry) gaps.push({ dimension: "productCategory", field: "industryData", reason: "source_unavailable" });
    else {
      const entry = data.industry.entries.find((e) => e.productCategory === input.purchaseCategory);
      if (!entry) gaps.push({ dimension: "productCategory", field: "productMapping", reason: "not_covered", detail: input.purchaseCategory });
      else
        factors.push({
          ruleId: productRule.ruleId, factor: "product", level: entry.screeningLevel, input: input.purchaseCategory,
          sourceRef: { dataset: "industry", version: data.industry.version, entry: `product:${input.purchaseCategory}`, sourceReference: entry.sourceReference },
        });
    }
  }

  const materialDimensions = new Set<string>(definition.unknownPolicy.materialGaps);
  const materialGap = gaps.some((g) => materialDimensions.has(g.dimension));
  const highest = factors.reduce<ScreeningLevel | null>((best, f) => (best === null || ORDER[f.level] > ORDER[best] ? f.level : best), null);
  const screeningLevel: Level = highest === "high" ? "high" : materialGap ? "unknown" : (highest ?? "unknown");

  const missingFields: MissingField[] = gaps.map((g) => ({ field: g.field, reason: g.reason, ...(g.detail !== undefined && { detail: g.detail }) }));
  if (input.upstreamUnknown) missingFields.push({ field: "upstream", reason: "unknown_upstream" });

  const staleSources: StaleSource[] = [
    ...(data.country && data.country.freshness !== "current" ? [{ source: "country" as const, version: data.country.version, freshness: data.country.freshness }] : []),
    ...(data.industry && data.industry.freshness !== "current" ? [{ source: "industry" as const, version: data.industry.version, freshness: data.industry.freshness }] : []),
    ...(data.method.freshness !== "current" ? [{ source: "method" as const, version: data.method.version, freshness: data.method.freshness }] : []),
  ];

  // Kontrollsignaler gir oppfølging, aldri et nivå.
  const controlSignals: ControlSignal[] = [];
  for (const r of definition.ruleDefinitions) {
    if (r.kind !== "control_signal") continue;
    if (r.factor === "registry_status" && input.registry) {
      const flags = (
        [["bankrupt", input.registry.bankrupt], ["underLiquidation", input.registry.underLiquidation], ["underForcedLiquidation", input.registry.underForcedLiquidation], ["deleted", input.registry.deleted]] as const
      ).filter(([, on]) => on === true);
      if (flags.length) controlSignals.push({ ruleId: r.ruleId, factor: "registry_status", detail: flags.map(([name]) => name).join(", ") });
    }
    if (r.factor === "data_gap" && missingFields.length > 0) {
      controlSignals.push({ ruleId: r.ruleId, factor: "data_gap", detail: unique(missingFields.map((m) => m.field)).sort().join(", ") });
    }
  }

  const sortKey = (r: TriggeredRule) => `${r.ruleId}|${r.input}`;
  return {
    screeningLevel,
    dataQuality: screeningLevel === "unknown" ? "insufficient" : missingFields.length > 0 || staleSources.length > 0 ? "incomplete" : "complete",
    missingFields,
    triggeredRules: factors.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0)),
    controlSignals,
    staleSources,
  };
}
