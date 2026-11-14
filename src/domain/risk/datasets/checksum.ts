/**
 * Checksum for en manifestfil: SHA-256 av kanonisk JSON (sorterte nøkler, linjene
 * sortert) av alt unntatt selve `checksum`-feltet. Alt som kan endre hva
 * dataene betyr, inkludert review og godkjenning, er med. Checksummen er et
 * integritetsvern mot utilsiktet endring, ikke en signatur.
 */
import type { RiskManifest } from "./schema.ts";

/** JSON med sorterte nøkler og uten `undefined`. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Linjerekkefølgen i filen skal ikke påvirke checksummen. */
export async function manifestChecksum(manifest: Omit<RiskManifest, "checksum"> | RiskManifest): Promise<string> {
  const { checksum: _ignored, ...rest } = manifest as RiskManifest;
  void _ignored;
  const body: Record<string, unknown> = { ...rest };
  if ("entries" in rest) body.entries = rest.entries.map(canonicalJson).sort();
  return await sha256(canonicalJson(body));
}
