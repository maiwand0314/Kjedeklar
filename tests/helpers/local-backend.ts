/**
 * Hjelpere for tester mot den lokale test-backenden (docker compose: convex-test).
 * Bruker Convex CLI med admin key fra .env.convex-test.local for interne
 * fixtures, og ekte Better Auth-innlogging for brukerkall.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";

export const TEST_BACKEND = {
  url: "http://127.0.0.1:3220",
  siteUrl: "http://127.0.0.1:3221",
  appOrigin: "http://localhost:3100",
  envFile: ".env.convex-test.local",
};

export function assertTestBackendConfigured() {
  if (!existsSync(TEST_BACKEND.envFile)) {
    throw new Error(
      `${TEST_BACKEND.envFile} mangler. Kjør \`pnpm convex:deploy:test\` (krever docker compose up -d convex-test).`,
    );
  }
  const content = readFileSync(TEST_BACKEND.envFile, "utf8");
  if (!content.includes(`CONVEX_SELF_HOSTED_URL=${TEST_BACKEND.url}`)) {
    throw new Error("Testene nekter å kjøre: env-filen peker ikke på lokal test-backend.");
  }
}

/** Kjører en intern funksjon på test-backenden via Convex CLI. */
export function runInternal<T>(functionName: string, args: Record<string, unknown>): T {
  assertTestBackendConfigured();
  const out = execFileSync(
    "pnpm",
    ["exec", "convex", "run", functionName, JSON.stringify(args), "--env-file", TEST_BACKEND.envFile],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return JSON.parse(out) as T;
}

export type TenantFixture = {
  userA: { email: string; userId: string };
  userB: { email: string; userId: string };
  orgA: string;
  orgB: string;
  orgC: string;
  password: string;
};

export function createTenantFixture(): TenantFixture {
  const suffix = randomBytes(6).toString("hex");
  const password = randomBytes(18).toString("base64url");
  const fixture = runInternal<Omit<TenantFixture, "password">>("ops/testing:createTenantFixture", {
    suffix,
    password,
  });
  return { ...fixture, password };
}

/** Logger inn via Better Auth på test-backenden og returnerer en Convex-JWT. */
export async function signInForToken(email: string, password: string): Promise<string> {
  // Better Auth sin innloggingsratebegrensning er på også i test. Ved 429 venter
  // vi den tiden serveren oppgir i stedet for å skru vernet av.
  let signIn: Response;
  for (let attempt = 0; ; attempt++) {
    signIn = await fetch(`${TEST_BACKEND.siteUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: TEST_BACKEND.appOrigin },
      body: JSON.stringify({ email, password }),
    });
    if (signIn.status !== 429 || attempt >= 3) break;
    const retryAfter = Number(signIn.headers.get("x-retry-after") ?? "10");
    await new Promise((r) => setTimeout(r, (Math.min(retryAfter, 20) + 1) * 1000));
  }
  if (!signIn.ok) throw new Error(`Innlogging feilet: ${signIn.status}`);
  const cookie = signIn.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const tokenResponse = await fetch(`${TEST_BACKEND.siteUrl}/api/auth/convex/token`, {
    headers: { cookie, origin: TEST_BACKEND.appOrigin },
  });
  const { token } = (await tokenResponse.json()) as { token?: string };
  if (!token) throw new Error("Fikk ikke Convex-token.");
  return token;
}

export async function clientFor(email: string, password: string) {
  const client = new ConvexHttpClient(TEST_BACKEND.url);
  client.setAuth(await signInForToken(email, password));
  return client;
}

export function anonymousClient() {
  return new ConvexHttpClient(TEST_BACKEND.url);
}
