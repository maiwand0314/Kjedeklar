/**
 * Kontrakt mellom Next.js-proxyen (/api/auth/*) og Better Auth i Convex for
 * klient-IP i ratebegrensningen. Ren TypeScript, brukes av begge sider.
 *
 * Next.js setter CLIENT_IP_HEADER og PROXY_SECRET_HEADER. Convex godtar
 * klient-IP-en bare når hemmeligheten stemmer; ellers fjernes headeren og
 * forespørselen havner i Better Auths felles bøtte for ukjent IP. Da kan ingen
 * forfalske IP-adresser ved å kalle Convex direkte.
 */
export const CLIENT_IP_HEADER = "x-kjedeklar-client-ip";
export const PROXY_SECRET_HEADER = "x-kjedeklar-proxy-secret";

/** Konstant-tid sammenligning av to strenger. */
export function constantTimeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Fjerner klient-IP med mindre proxy-hemmeligheten stemmer. Fjerner alltid hemmeligheten. */
export function sanitizeProxyHeaders(headers: Headers, expectedSecret: string | undefined): Headers {
  const result = new Headers(headers);
  const provided = result.get(PROXY_SECRET_HEADER);
  result.delete(PROXY_SECRET_HEADER);
  const trusted =
    !!expectedSecret && expectedSecret.length >= 32 && !!provided && constantTimeEqual(provided, expectedSecret);
  if (!trusted) result.delete(CLIENT_IP_HEADER);
  return result;
}
