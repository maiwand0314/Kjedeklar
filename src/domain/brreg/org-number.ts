/** Norsk organisasjonsnummer: 9 siffer med mod 11-kontrollsiffer. */
const WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2];

/** Fjerner mellomrom; returnerer null hvis det ikke er nøyaktig 9 siffer med gyldig kontrollsiffer. */
export function normalizeOrgNumber(input: string): string | null {
  const digits = input.replace(/\s/g, "");
  if (!/^\d{9}$/.test(digits)) return null;
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const remainder = sum % 11;
  const check = remainder === 0 ? 0 : 11 - remainder;
  if (check === 10 || check !== Number(digits[8])) return null;
  return digits;
}
