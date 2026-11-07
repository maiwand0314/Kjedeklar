/**
 * Godtar bare interne stier vi selv sender brukeren til etter innlogging, for å
 * hindre åpne omdirigeringer (`?neste=https://...` eller `//evil`).
 */
const ALLOWED = [/^\/$/, /^\/o\/[a-z0-9]{1,64}$/, /^\/invitasjon$/];

export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  return ALLOWED.some((pattern) => pattern.test(value)) ? value : "/";
}
