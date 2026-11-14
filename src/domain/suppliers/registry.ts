/**
 * Brreg-beriking av leverandører: status og forslag. Registerverdier er alltid
 * forslag som brukeren bekrefter; ingenting i leverandørprofilen overskrives
 * av en jobb. Registerstatus (konkurs, avvikling) er et kontrollsignal og ikke
 * en risikovurdering, og den bor i snapshotet, ikke her.
 */
import type { RegistryProfile } from "../brreg/enhet";
import { nameKey } from "./supplier";

export type RegistryEnrichmentState = "queued" | "succeeded" | "not_found" | "removed" | "failed";
/** Det brukeren ser per leverandør. «not_applicable» = uten norsk org.nr.; «not_fetched» = ikke hentet for dette org.nr. */
export type RegistryState = RegistryEnrichmentState | "not_applicable" | "not_fetched";

export const REGISTRY_STATE_LABELS: Record<RegistryState, string> = {
  not_applicable: "Ikke relevant (uten norsk org.nr.)",
  not_fetched: "Ikke hentet",
  queued: "Henter fra Enhetsregisteret",
  succeeded: "Hentet",
  not_found: "Ikke funnet i Enhetsregisteret",
  removed: "Fjernet fra registeret",
  failed: "Henting feilet",
};

export function registryStateOf(supplier: {
  registryOrgNumber?: string;
  registryEnrichment?: { orgNumber: string; state: RegistryEnrichmentState };
}): RegistryState {
  if (!supplier.registryOrgNumber) return "not_applicable";
  const e = supplier.registryEnrichment;
  // Et oppslag for et annet org.nr. sier ingenting om dette.
  return e && e.orgNumber === supplier.registryOrgNumber ? e.state : "not_fetched";
}

export type RegistrySuggestion = { field: "name" | "registeredCountry" | "industryCode"; current: string | null; proposed: string };

/**
 * Forskjeller mellom leverandøren og siste hentede registerprofil. Fyller aldri
 * ut stille: også tomme felt er forslag. Manglende næringskode gir ikke forslag
 * (feltet forblir ukjent). Utenlandske foretak registrert i Norge (NUF) får
 * ikke «NO» foreslått, siden registreringslandet da er uklart.
 */
export function registrySuggestions(
  supplier: { name: string; registeredCountry?: string; industryCode?: string },
  profile: RegistryProfile,
): RegistrySuggestion[] {
  const out: RegistrySuggestion[] = [];
  if (nameKey(supplier.name) !== nameKey(profile.name)) out.push({ field: "name", current: supplier.name, proposed: profile.name });
  if (profile.legalForm !== "NUF" && supplier.registeredCountry !== "NO") {
    out.push({ field: "registeredCountry", current: supplier.registeredCountry ?? null, proposed: "NO" });
  }
  if (profile.industryCode && supplier.industryCode !== profile.industryCode) {
    out.push({ field: "industryCode", current: supplier.industryCode ?? null, proposed: profile.industryCode });
  }
  return out;
}

/** Feilkodene fra jobben, på norsk. Koden er alt som lagres; teksten er bare visning. */
export const REGISTRY_ERROR_TEXT: Record<string, string> = {
  BRREG_RATE_LIMITED: "Enhetsregisteret ba om å vente (for mange oppslag). Prøv igjen senere.",
  BRREG_TIMEOUT: "Enhetsregisteret svarte ikke i tide. Prøv igjen senere.",
  BRREG_UNAVAILABLE: "Enhetsregisteret var ikke tilgjengelig. Prøv igjen senere.",
  BRREG_CONTRACT_CHANGED: "Svaret fra Enhetsregisteret hadde et uventet format og ble ikke brukt.",
};
export const registryErrorText = (code: string | null) => (code && REGISTRY_ERROR_TEXT[code]) || "Henting feilet av en uventet grunn.";

export const SUGGESTION_LABELS = {
  name: "Navn",
  registeredCountry: "Registreringsland",
  industryCode: "Næringskode",
} as const;
