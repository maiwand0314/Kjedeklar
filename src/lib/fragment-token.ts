"use client";

/**
 * Engangstoken i lenker ligger i URL-fragmentet (`#token=...`), som nettleseren
 * aldri sender til en server, så det havner ikke i tilgangslogger. Vi leser det
 * og fjerner det fra adresselinjen og nettleserhistorikken.
 *
 * Idempotent per side: React StrictMode kaller initialisering to ganger, og
 * andre kall må få samme token selv om fragmentet allerede er fjernet.
 */
let taken: { path: string; token: string | null } | undefined;

export function takeFragmentToken(): string | null {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname;
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("token");
  if (fromHash) {
    window.history.replaceState(null, "", path + window.location.search);
    taken = { path, token: fromHash };
    return fromHash;
  }
  return taken?.path === path ? taken.token : null;
}
