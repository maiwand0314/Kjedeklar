/**
 * Livsløp for en dataversjon: `imported` → `active` → `retired`. Innholdet
 * endres aldri etter import; bare status og tidsstempler endres.
 *
 * - Aktivering av `production`-versjon krever avklart lisens, gjennomgang,
 *   godkjenning, gyldig review-dato og at checksum og mapping stemmer.
 * - `demo`-versjoner kan bare importeres og aktiveres i lokale miljøer, og
 *   leses aldri av kunder utenfor lokale miljøer.
 * - Utdatert review er en eksplisitt datakvalitetstilstand (`freshness`).
 * - Leses av kunder: bare `active` og `retired` (gamle vurderinger må kunne
 *   gjenskapes), aldri `imported`.
 */
export type DatasetStatus = "imported" | "active" | "retired";
export type DatasetEnvironment = "demo" | "production";

export type VersionFacts = {
  status: DatasetStatus;
  environment: DatasetEnvironment;
  licenseStatus?: "cleared" | "unclear" | "restricted";
  review?: { reviewDueAt: string };
  approval?: unknown;
};

export const todayUtc = (now: number) => new Date(now).toISOString().slice(0, 10);

/** `unreviewed`: ingen gjennomgang registrert. `review_overdue`: forfallsdatoen er passert. */
export type Freshness = "current" | "review_overdue" | "unreviewed";
export function datasetFreshness(version: Pick<VersionFacts, "review">, today: string): Freshness {
  if (!version.review) return "unreviewed";
  return version.review.reviewDueAt < today ? "review_overdue" : "current";
}

export type ActivationBlocker =
  | "NOT_IMPORTED"
  | "DEMO_NOT_ALLOWED"
  | "LICENSE_NOT_CLEARED"
  | "NOT_REVIEWED"
  | "NOT_APPROVED"
  | "REVIEW_OVERDUE"
  | "CHECKSUM_MISMATCH"
  | "INVALID_MAPPING";

/** Alt som hindrer aktivering. Tom liste betyr at versjonen kan aktiveres. */
export function activationBlockers(
  version: VersionFacts,
  check: { today: string; localEnvironment: boolean; checksumMatches: boolean; mappingValid: boolean },
): ActivationBlocker[] {
  const blockers: ActivationBlocker[] = [];
  if (version.status !== "imported") blockers.push("NOT_IMPORTED");
  if (!check.checksumMatches) blockers.push("CHECKSUM_MISMATCH");
  if (!check.mappingValid) blockers.push("INVALID_MAPPING");
  if (version.environment === "demo") {
    if (!check.localEnvironment) blockers.push("DEMO_NOT_ALLOWED");
    return blockers;
  }
  if (version.licenseStatus !== undefined && version.licenseStatus !== "cleared") blockers.push("LICENSE_NOT_CLEARED");
  if (!version.review) blockers.push("NOT_REVIEWED");
  else if (version.review.reviewDueAt < check.today) blockers.push("REVIEW_OVERDUE");
  if (!version.approval) blockers.push("NOT_APPROVED");
  return blockers;
}

/** Kan en kunde se versjonen? Demo bare i lokale miljøer; aldri uaktiverte (`imported`). */
export const visibleToTenants = (version: Pick<VersionFacts, "status" | "environment">, localEnvironment: boolean) =>
  version.status !== "imported" && (version.environment === "production" || localEnvironment);
