/**
 * Adapter til Enhetsregisteret. Kalles bare fra Convex-actions (nettverk).
 * Timeout per forsøk, begrenset retry ved 429/5xx/timeout, Zod-validering av
 * de valgte feltene. Returnerer et resultat i stedet for å kaste, så kalleren
 * kan vise en forståelig feil.
 */
import { BRREG_MAPPING_VERSION, enhetSchema, toProfile, type RegistryProfile } from "../../../src/domain/brreg/enhet";
import { sha256Hex } from "../../email/seal";
import { isLocalDeploymentUrl } from "../../ops/guard";

export const BRREG_ENHET_URL = "https://data.brreg.no/enhetsregisteret/api/enheter/";

export type BrregResult =
  | {
      kind: "found";
      profile: RegistryProfile;
      fetchedAt: number;
      payloadHash: string;
      mappingVersion: string;
    }
  | { kind: "not_found" } // 404
  | { kind: "removed" } // 410: fjernet av juridiske årsaker
  | { kind: "invalid" } // 400
  | { kind: "unavailable"; reason: "timeout" | "rate_limited" | "server_error" | "network" }
  | { kind: "contract_changed" }; // svaret matcher ikke kontrakten

/**
 * Integrasjonstester peker adapteren mot en falsk Brreg-tjeneste med
 * `BRREG_ENHET_URL`. Variabelen leses bare på en lokal test-backend; ellers
 * brukes alltid Enhetsregisteret.
 */
const enhetUrl = () => {
  const override = process.env.BRREG_ENHET_URL;
  return override && process.env.KJEDEKLAR_ENV === "test" && isLocalDeploymentUrl(process.env.CONVEX_CLOUD_URL) ? override : BRREG_ENHET_URL;
};

type Options = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  now?: () => number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchEnhet(orgNumber: string, options: Options = {}): Promise<BrregResult> {
  const { fetchImpl = fetch, timeoutMs = 5000, retries = 2, backoffMs = 300, now = Date.now } = options;
  let lastFailure: BrregResult = { kind: "unavailable", reason: "network" };

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoffMs * attempt);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${enhetUrl()}${orgNumber}`, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (response.status === 404) return { kind: "not_found" };
      if (response.status === 410) return { kind: "removed" };
      if (response.status === 400) return { kind: "invalid" };
      if (response.status === 429) {
        lastFailure = { kind: "unavailable", reason: "rate_limited" };
        continue;
      }
      if (response.status >= 500) {
        lastFailure = { kind: "unavailable", reason: "server_error" };
        continue;
      }
      if (!response.ok) return { kind: "contract_changed" };
      const text = await response.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return { kind: "contract_changed" };
      }
      const parsed = enhetSchema.safeParse(json);
      if (!parsed.success || parsed.data.organisasjonsnummer !== orgNumber) return { kind: "contract_changed" };
      return {
        kind: "found",
        profile: toProfile(parsed.data),
        fetchedAt: now(),
        payloadHash: await sha256Hex(text),
        mappingVersion: BRREG_MAPPING_VERSION,
      };
    } catch (error) {
      lastFailure = {
        kind: "unavailable",
        reason: (error as Error).name === "AbortError" ? "timeout" : "network",
      };
    } finally {
      clearTimeout(timer);
    }
  }
  return lastFailure;
}
