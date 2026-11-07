import "server-only";
import { isIP } from "node:net";
import { CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from "@/domain/auth-proxy";
import { handler } from "@/lib/auth-server";
import { serverEnv } from "@/lib/env";

/**
 * Proxy til Better Auth i Convex. Legger på klientens IP (for ratebegrensning
 * per IP) og proxy-hemmeligheten som beviser at IP-en kommer herfra. Verdier
 * klienten selv sender i disse headerne, fjernes alltid.
 */
function clientIp(headers: Headers, sourceHeader: string): string | undefined {
  const first = headers.get(sourceHeader)?.split(",")[0]?.trim();
  return first && isIP(first) ? first : undefined;
}

async function withProxyHeaders(request: Request): Promise<Request> {
  const env = serverEnv();
  const headers = new Headers(request.headers);
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(PROXY_SECRET_HEADER);
  const ip = clientIp(request.headers, env.AUTH_CLIENT_IP_SOURCE_HEADER);
  if (ip) headers.set(CLIENT_IP_HEADER, ip);
  headers.set(PROXY_SECRET_HEADER, env.AUTH_PROXY_SECRET);
  // Bufre body: auth-forespørsler er små JSON-meldinger, og en strømmet body
  // kan ikke uten videre gjenbrukes i en ny Request i Node.
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  return new Request(request.url, { method: request.method, headers, body });
}

export const GET = async (request: Request) => handler.GET(await withProxyHeaders(request));
export const POST = async (request: Request) => handler.POST(await withProxyHeaders(request));
