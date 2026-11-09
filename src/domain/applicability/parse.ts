/**
 * Tolker tall slik brukeren skriver dem i et norsk skjema. Tom verdi er ukjent
 * (null), ugyldig verdi gir undefined, så kalleren kan vise en feil.
 */
const cleaned = (input: string) => input.replace(/[\s  ]/g, "").replace(",", ".");

/** Kroner (inntil to desimaler) → øre. «70 000 000» → 7000000000n. */
export function parseKronerToOre(input: string): bigint | null | undefined {
  const value = cleaned(input);
  if (value === "") return null;
  const match = /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return undefined;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "0").padEnd(2, "0"));
}

/** Årsverk med inntil to desimaler, f.eks. «49,5». */
export function parseFte(input: string): number | null | undefined {
  const value = cleaned(input);
  if (value === "") return null;
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return undefined;
  return Number(value);
}
