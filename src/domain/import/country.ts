import { isCountryCode } from "../suppliers/countries";
import { COUNTRY_NAMES } from "../suppliers/country-names";

/** Vanlige skrivemåter som ikke er det offisielle norske eller engelske navnet. */
const ALIASES: Record<string, string> = {
  uk: "GB",
  "great britain": "GB",
  turkey: "TR",
  "ivory coast": "CI",
  "czech republic": "CZ",
  "the netherlands": "NL",
  holland: "NL",
  "united states of america": "US",
};

const key = (text: string) => text.trim().toLocaleLowerCase("nb").replace(/\s+/g, " ").replace(/[’`´]/g, "'");

const BY_NAME = new Map<string, string>([
  ...Object.entries(COUNTRY_NAMES).flatMap(([code, names]) => names.map((name) => [key(name), code] as const)),
  ...Object.entries(ALIASES),
]);

/**
 * Land skrevet som ISO-kode («NO») eller som norsk eller engelsk navn («Norge»,
 * «Norway») → ISO-kode. Tom tekst gir null (ukjent), og tekst som ikke kjennes
 * igjen gir undefined, så raden kan få en synlig avklaring. Ingenting gjettes.
 */
export function parseCountry(raw: string): string | null | undefined {
  const text = key(raw);
  if (text === "") return null;
  const code = text.toUpperCase();
  return isCountryCode(code) ? code : BY_NAME.get(text);
}
