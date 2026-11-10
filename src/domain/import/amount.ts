/**
 * Tolker beløp fra en importfil til øre (bigint), uten flyttall. Beløp som kan
 * leses på to måter gjettes aldri: de blir «tvetydig», og brukeren velger
 * desimaltegn for hele filen.
 */
import type { DecimalFormat } from "./limits";

export type AmountResult =
  | { kind: "empty" }
  /** Kan være negativt (kreditnota). */
  | { kind: "ok"; ore: bigint }
  | { kind: "ambiguous" }
  | { kind: "invalid"; reason: "format" | "currency" | "decimals" | "too_large" };

type Parts = { whole: string; fraction: string };

const escape = (char: string) => char.replace(/[.\\]/g, "\\$&");

/** Heltallsdel: bare sifre, eller grupper på tre med ett fast tusenskille («1 234 567»). */
function pattern(thousands: string[], decimal: string, fraction: string) {
  const whole = ["\\d+", ...thousands.map((t) => `[1-9]\\d{0,2}(?:${escape(t)}\\d{3})+`)].join("|");
  return new RegExp(`^(${whole})(?:${escape(decimal)}(${fraction}))?$`);
}

const COMMA = { strict: pattern([" ", "."], ",", "\\d{1,2}"), loose: pattern([" ", "."], ",", "\\d+") };
const DOT = { strict: pattern([" ", ","], ".", "\\d{1,2}"), loose: pattern([" ", ","], ".", "\\d+") };

function match(regex: RegExp, text: string): Parts | null {
  const m = regex.exec(text);
  return m ? { whole: m[1].replace(/\D/g, ""), fraction: m[2] ?? "" } : null;
}

/** Samme tall uavhengig av skrivemåte: «1 234,50» og «1234.5» gir samme nøkkel. */
const valueKey = (p: Parts) => `${BigInt(p.whole)}.${p.fraction.replace(/0+$/, "")}`;

export function parseAmount(raw: string, format: DecimalFormat): AmountResult {
  // Alle slags mellomrom (også harde, fra regneark) regnes som vanlig mellomrom.
  let text = raw.replace(/[\s    ]+/g, " ").replace(/−/g, "-").trim();
  if (text === "") return { kind: "empty" };

  let negative = false;
  const sign = () => {
    if (text.startsWith("-")) [negative, text] = [true, text.slice(1).trim()];
    else if (text.startsWith("+")) text = text.slice(1).trim();
  };
  const parenthesized = /^\((.+)\)$/.exec(text); // regnskapsformat for negative tall
  if (parenthesized) [negative, text] = [true, parenthesized[1].trim()];
  sign();
  text = text.replace(/^(?:kr\.?|nok)\s*/i, "").replace(/\s*(?:kr\.?|nok)$/i, "");
  if (!negative) sign();
  text = text.replace(/,-$/, ""); // «1 250,-»
  if (text.endsWith("-")) [negative, text] = [!negative, text.slice(0, -1).trim()]; // «1 250-»

  if (/eur|usd|sek|dkk|gbp|[€$£¥]/i.test(text)) return { kind: "invalid", reason: "currency" };

  const comma = { strict: match(COMMA.strict, text), loose: match(COMMA.loose, text) };
  const dot = { strict: match(DOT.strict, text), loose: match(DOT.loose, text) };
  let parts: Parts | null;
  let loose: Parts | null;
  if (format === "auto") {
    // «1.234» er 1 234 med punktum som tusenskille, men 1,234 med punktum som desimaltegn.
    if (comma.loose && dot.loose && valueKey(comma.loose) !== valueKey(dot.loose)) return { kind: "ambiguous" };
    [parts, loose] = [comma.strict ?? dot.strict, comma.loose ?? dot.loose];
  } else {
    ({ strict: parts, loose } = format === "comma" ? comma : dot);
  }
  if (!parts) return { kind: "invalid", reason: loose ? "decimals" : "format" };
  if (parts.whole.length > 15) return { kind: "invalid", reason: "too_large" };
  const ore = BigInt(parts.whole) * 100n + BigInt(parts.fraction.padEnd(2, "0"));
  return { kind: "ok", ore: negative ? -ore : ore };
}
