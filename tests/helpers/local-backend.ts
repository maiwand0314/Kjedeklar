/**
 * Hjelpere for tester mot den lokale test-backenden (docker compose: convex-test).
 * Bruker Convex CLI med admin key fra .env.convex-test.local for interne
 * fixtures, og ekte Better Auth-innlogging for brukerkall.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

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
  const result = spawnSync(
    "pnpm",
    ["exec", "convex", "run", functionName, JSON.stringify(args), "--env-file", TEST_BACKEND.envFile],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const stdout = result.stdout.trim();
  if (result.status !== 0 || !stdout) {
    throw new Error(
      `convex run ${functionName} feilet (status ${result.status}): ${result.stderr.trim() || "(ingen stderr)"}`,
    );
  }
  return JSON.parse(stdout) as T;
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

export type Session = {
  /** Better Auth-sesjonscookie, slik nettleseren ville sendt den. */
  cookie: string;
  /** Convex-JWT utstedt for sesjonen. */
  token: string;
};

/** Logger inn via Better Auth på test-backenden og returnerer cookie og Convex-JWT. */
export async function signIn(email: string, password: string): Promise<Session> {
  // Better Auth sin innloggingsratebegrensning er på også i test. Ved 429 venter
  // vi den tiden serveren oppgir i stedet for å skru vernet av.
  let response: Response;
  for (let attempt = 0; ; attempt++) {
    response = await fetch(`${TEST_BACKEND.siteUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: TEST_BACKEND.appOrigin },
      body: JSON.stringify({ email, password }),
    });
    if (response.status !== 429 || attempt >= 3) break;
    const retryAfter = Number(response.headers.get("x-retry-after") ?? "10");
    await new Promise((r) => setTimeout(r, (Math.min(retryAfter, 20) + 1) * 1000));
  }
  if (!response.ok) throw new Error(`Innlogging feilet: ${response.status}`);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const tokenResponse = await fetch(`${TEST_BACKEND.siteUrl}/api/auth/convex/token`, {
    headers: { cookie, origin: TEST_BACKEND.appOrigin },
  });
  const { token } = (await tokenResponse.json()) as { token?: string };
  if (!token) throw new Error("Fikk ikke Convex-token.");
  return { cookie, token };
}

/** Logger inn og returnerer bare Convex-JWT. */
export async function signInForToken(email: string, password: string): Promise<string> {
  return (await signIn(email, password)).token;
}

export function clientWithToken(token: string) {
  const client = new ConvexHttpClient(TEST_BACKEND.url);
  client.setAuth(token);
  return client;
}

export async function clientFor(email: string, password: string) {
  return clientWithToken(await signInForToken(email, password));
}

export function anonymousClient() {
  return new ConvexHttpClient(TEST_BACKEND.url);
}

export type TwoTenants = {
  fx: TenantFixture;
  sessionA: Session;
  sessionB: Session;
  /** Klient innlogget som bruker A (aktiv i org A, inaktiv i org C). */
  a: ConvexHttpClient;
  /** Klient innlogget som bruker B (aktiv i org B og org C). */
  b: ConvexHttpClient;
  anonymous: ConvexHttpClient;
};

/**
 * Gjenbrukbar oppsett for to kunder med ekte innloggede brukere mot lokal
 * test-backend. Hver kall gir en fersk fixture med unik suffix.
 */
export async function setupTwoTenants(): Promise<TwoTenants> {
  const fx = createTenantFixture();
  const sessionA = await signIn(fx.userA.email, fx.password);
  const sessionB = await signIn(fx.userB.email, fx.password);
  return {
    fx,
    sessionA,
    sessionB,
    a: clientWithToken(sessionA.token),
    b: clientWithToken(sessionB.token),
    anonymous: anonymousClient(),
  };
}

/** Feilkoden fra en ConvexError, `OK` ved suksess, ellers `ERROR:<melding>`. */
export async function errorOf(
  promise: Promise<unknown>,
): Promise<{ code: string; data?: unknown }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) {
      return { code: (error.data as { code: string }).code, data: error.data };
    }
    return { code: `ERROR:${(error as Error).message}` };
  }
  return { code: "OK" };
}
