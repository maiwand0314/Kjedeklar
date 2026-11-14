/**
 * Kundens vurdering av en screening (oppgave 16): begrunnelse, effektivt nivå og
 * prioritert rekkefølge. Ren logikk uten Convex og Next.js. Se beslutning 0014.
 *
 * Screeningen (motorens nivå) endres aldri av dette. Kundens bekreftelse eller
 * overstyring er et eget valg ved siden av, og begge vises alltid samtidig.
 */
export type ScreeningLevel = "low" | "moderate" | "high" | "unknown";
export type ReviewDecision = "confirm" | "override" | "revoke";
/** Hva kunden kan velge ved overstyring. «Ukjent» er ikke et valg: det er mangel på vurdering. */
export const OVERRIDE_LEVELS = ["low", "moderate", "high"] as const;

export const RATIONALE_MIN_CHARS = 20;
export const RATIONALE_MIN_WORDS = 4;
export const RATIONALE_MAX_CHARS = 2000;

export type RationaleCheck = { ok: true; text: string } | { ok: false; reason: "too_short" | "too_few_words" | "repetitive" | "too_long" };

/**
 * En begrunnelse må være en forklaring, ikke et tegn eller en tom frase. Kontrollen er bevisst enkel og kan ikke
 * avgjøre om innholdet er riktig: den stopper bare det åpenbart tomme. Resten er kundens ansvar.
 */
export function checkRationale(raw: string): RationaleCheck {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length > RATIONALE_MAX_CHARS) return { ok: false, reason: "too_long" };
  if (text.length < RATIONALE_MIN_CHARS) return { ok: false, reason: "too_short" };
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length < RATIONALE_MIN_WORDS) return { ok: false, reason: "too_few_words" };
  // «ok ok ok ok ok» og «aaaa aaaa aaaa aaaa»: færre enn tre ulike ord.
  if (new Set(words).size < 3) return { ok: false, reason: "repetitive" };
  return { ok: true, text };
}

export const RATIONALE_MESSAGES = {
  too_short: `Begrunnelsen må være på minst ${RATIONALE_MIN_CHARS} tegn.`,
  too_few_words: `Begrunnelsen må bestå av minst ${RATIONALE_MIN_WORDS} ord.`,
  repetitive: "Begrunnelsen gjentar de samme ordene. Forklar hvorfor du bekrefter, overstyrer eller trekker tilbake.",
  too_long: `Begrunnelsen kan være på høyst ${RATIONALE_MAX_CHARS} tegn.`,
} as const;

export type ReviewState = "none" | "confirmed" | "overridden" | "revoked" | "outdated";

/**
 * Kundens gjeldende vurdering. `outdated`: vurderingen gjelder en eldre screening, eller screeningen er selv utdatert
 * fordi grunnlaget er endret. Da er det ingen gjeldende kundevurdering før den bekreftes på nytt (`level: null`).
 * Tilbaketrukket vurdering gir heller ingen kundevurdering.
 */
export function effectiveReview(
  screeningLevel: ScreeningLevel | null,
  review: { decision: ReviewDecision; chosenLevel?: ScreeningLevel; assessmentId: string } | null,
  assessment: { id: string; status: "current" | "stale" } | null,
): { state: ReviewState; level: ScreeningLevel | null } {
  if (!review) return { state: "none", level: null };
  if (review.decision === "revoke") return { state: "revoked", level: null };
  if (!assessment || screeningLevel === null || review.assessmentId !== assessment.id || assessment.status === "stale") {
    return { state: "outdated", level: null };
  }
  return review.decision === "override"
    ? { state: "overridden", level: review.chosenLevel ?? screeningLevel }
    : { state: "confirmed", level: screeningLevel };
}

/** Nøkkelen en leverandør listes under. «Ikke vurdert» er en egen gruppe, aldri lav. */
export type ListLevel = ScreeningLevel | "not_assessed";

export const DEFAULT_PRIORITY_ORDER: readonly ScreeningLevel[] = ["high", "unknown", "moderate", "low"];

/**
 * Rekkefølgen gruppene vises i: metodens `priorityOrder`, med «ikke vurdert» rett etter «ukjent» (begge krever
 * oppfølging, og ingen av dem skal ligge bak lav). Mangler metoden eller et nivå, brukes standardrekkefølgen.
 */
export function groupOrder(priorityOrder: readonly string[] | undefined): ListLevel[] {
  const known = (priorityOrder ?? []).filter((l): l is ScreeningLevel => (DEFAULT_PRIORITY_ORDER as readonly string[]).includes(l));
  const levels = [...known, ...DEFAULT_PRIORITY_ORDER.filter((l) => !known.includes(l))];
  const at = levels.indexOf("unknown");
  return [...levels.slice(0, at + 1), "not_assessed", ...levels.slice(at + 1)];
}

export type PrioritySortable = { id: string; nameKey: string; level: ListLevel; spendOre: bigint | null };

/**
 * Risikoprioritert rekkefølge: først nivå (gruppene i `groupOrder`), deretter innkjøpsbeløp fallende innenfor samme
 * nivå. Kjent beløp (også 0) kommer før ukjent beløp. Beløpet kan altså aldri flytte en leverandør til et annet nivå.
 * Likt beløp sorteres etter navn og id, så rekkefølgen er stabil.
 */
export function prioritySort<T extends PrioritySortable>(rows: readonly T[], order: readonly ListLevel[]): T[] {
  const rank = (l: ListLevel) => order.indexOf(l);
  return [...rows].sort((a, b) => {
    if (a.level !== b.level) return rank(a.level) - rank(b.level);
    if (a.spendOre !== b.spendOre) {
      if (a.spendOre === null) return 1;
      if (b.spendOre === null) return -1;
      return a.spendOre > b.spendOre ? -1 : 1;
    }
    return a.nameKey < b.nameKey ? -1 : a.nameKey > b.nameKey ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
