/**
 * Tenant-isolasjon mot lokal Convex-backend med ekte Better Auth-innlogging.
 * Dette er beviset for tenantgrensen; convex-test er bare rask støtte.
 * Se docs/decisions/0002-tenant-boundary.md.
 */
import { ConvexClient, type ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { internalFunctions, type FunctionKind } from "../helpers/convex-functions";
import {
  clientWithToken,
  errorOf,
  runInternal,
  setupTwoTenants,
  signIn,
  TEST_BACKEND,
  type TwoTenants,
} from "../helpers/local-backend";
import { messagesTo } from "../helpers/mailpit";
import { syntheticCountry } from "../helpers/risk-data";
import {
  reviewedPublicFunctions,
  SYNTHETIC_REGISTRY_PROFILE,
  type PublicFunctionReview,
} from "../helpers/public-functions";

const current = api.organizations.queries.current;
const listMine = api.organizations.queries.listMine;
const org = (id: string) => ({ organizationId: id });

function callPublic(client: ConvexHttpClient, review: PublicFunctionReview, args: Record<string, unknown>) {
  if (review.kind === "query") return client.query(review.ref, args);
  if (review.kind === "mutation") return client.mutation(review.ref, args);
  return client.action(review.ref, args);
}

function callByPath(client: ConvexHttpClient, kind: FunctionKind, path: string, args: Record<string, unknown>) {
  if (kind === "query") return client.query(makeFunctionReference<"query">(path), args);
  if (kind === "mutation") return client.mutation(makeFunctionReference<"mutation">(path), args);
  return client.action(makeFunctionReference<"action">(path), args);
}

async function waitFor(condition: () => boolean, timeoutMs = 15_000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("Tidsavbrudd i waitFor");
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Gyldig risikodatafil som en klient ikke skal kunne importere. Unikt navn per kjøring, siden test-backenden består mellom kjøringer. */
const probeRiskPayload = await syntheticCountry(`kapret-${Date.now()}`);

describe("tenant-isolasjon mot lokal Convex-backend", () => {
  let env: TwoTenants;

  beforeAll(async () => {
    env = await setupTwoTenants();
  });

  test("bruker A leser org A", async () => {
    const result = await env.a.query(current, org(env.fx.orgA));
    expect(result.id).toBe(env.fx.orgA);
    expect(result.name).toMatch(/^Org A /);
  });

  describe.each(
    Object.entries(reviewedPublicFunctions).filter(([, r]) => r.boundary === "tenant"),
  )("%s", (_path, review) => {
    test("fremmed, inaktiv, ugyldig og annen tabell gir identisk avslag", async () => {
      const { fx, a } = env;
      const candidates = [fx.orgB, fx.orgC, "ikke-en-id", fx.userA.userId, `${fx.orgB}x`];
      const results = [];
      for (const candidate of candidates) {
        results.push(await errorOf(callPublic(a, review, { ...review.sampleArgs, organizationId: candidate })));
      }
      expect(results[0]).toEqual({ code: "NOT_FOUND", data: { code: "NOT_FOUND", message: "Ikke funnet." } });
      for (const r of results) expect(r).toEqual(results[0]);
    });

    test("uten sesjon avvises", async () => {
      const r = await errorOf(callPublic(env.anonymous, review, { ...review.sampleArgs, organizationId: env.fx.orgA }));
      expect(r.code).toBe("UNAUTHENTICATED");
    });
  });

  describe.each(
    Object.entries(reviewedPublicFunctions).filter(([, r]) => r.boundary === "user"),
  )("%s", (_path, review) => {
    test("uten sesjon avvises", async () => {
      expect((await errorOf(callPublic(env.anonymous, review, review.sampleArgs))).code).toBe("UNAUTHENTICATED");
    });
  });

  test("organisasjonsvelgeren viser bare egne aktive organisasjoner", async () => {
    const { fx, a, b } = env;
    expect((await a.query(listMine, {})).map((o) => o.id)).toEqual([fx.orgA]);
    expect((await b.query(listMine, {})).map((o) => o.id).sort()).toEqual([fx.orgB, fx.orgC].sort());
  });

  test("samtidige kall fra to brukere får hver sin tenant, også ved blandede forsøk", async () => {
    const { fx, a, b } = env;
    const calls = Array.from({ length: 24 }, (_, i) => {
      switch (i % 4) {
        case 0:
          return errorOf(a.query(current, org(fx.orgA))).then((r) => ({ i, r, want: "OK" }));
        case 1:
          return errorOf(b.query(current, org(fx.orgB))).then((r) => ({ i, r, want: "OK" }));
        case 2:
          return errorOf(a.query(current, org(fx.orgB))).then((r) => ({ i, r, want: "NOT_FOUND" }));
        default:
          return errorOf(b.query(current, org(fx.orgA))).then((r) => ({ i, r, want: "NOT_FOUND" }));
      }
    });
    const results = await Promise.all(calls);
    for (const { i, r, want } of results) expect(r.code, `kall ${i}`).toBe(want);
    const reads = await Promise.all([
      a.query(current, org(fx.orgA)),
      b.query(current, org(fx.orgB)),
      a.query(current, org(fx.orgA)),
      b.query(current, org(fx.orgB)),
    ]);
    expect(reads.map((r) => r.id)).toEqual([fx.orgA, fx.orgB, fx.orgA, fx.orgB]);
  });

  test("bytte av bruker i samme klient gir ny tenantkontekst", async () => {
    const { fx, sessionA, sessionB } = env;
    const client = clientWithToken(sessionA.token);
    expect((await client.query(current, org(fx.orgA))).id).toBe(fx.orgA);

    client.setAuth(sessionB.token);
    expect((await errorOf(client.query(current, org(fx.orgA)))).code).toBe("NOT_FOUND");
    expect((await client.query(current, org(fx.orgB))).id).toBe(fx.orgB);

    client.clearAuth();
    expect((await errorOf(client.query(current, org(fx.orgB)))).code).toBe("UNAUTHENTICATED");
    expect((await errorOf(client.query(listMine, {}))).code).toBe("UNAUTHENTICATED");

    client.setAuth(sessionA.token);
    expect((await client.query(listMine, {})).map((o) => o.id)).toEqual([fx.orgA]);
  });

  /**
   * Én probe per intern funksjon: argumenter som ville lyktes om funksjonen var
   * offentlig, og en kontroll av at kallet ikke hadde effekt. Nye interne
   * funksjoner må få en probe her (testen under feiler ellers).
   */
  const internalProbes: Record<
    string,
    { args: (env: TwoTenants) => Record<string, unknown>; verifyNoEffect: (env: TwoTenants) => Promise<void> }
  > = {
    "ops/organizations:createWorkspace": {
      args: ({ fx }) => ({ name: "Kapret AS", country: "NO", userId: fx.userA.userId }),
      verifyNoEffect: async ({ fx, a }) => {
        expect((await a.query(listMine, {})).map((o) => o.id)).toEqual([fx.orgA]);
      },
    },
    "ops/organizations:setMembership": {
      args: ({ fx }) => ({ organizationId: fx.orgB, userId: fx.userA.userId, status: "active" }),
      verifyNoEffect: async ({ fx, a }) => {
        expect((await errorOf(a.query(current, org(fx.orgB)))).code).toBe("NOT_FOUND");
      },
    },
    "ops/organizations:organizationIdsForUser": {
      // Query: et vellykket kall ville returnert B sine organisasjoner. Avslaget er beviset.
      args: ({ fx }) => ({ userId: fx.userB.userId }),
      verifyNoEffect: async () => {},
    },
    "ops/seed:seedDev": {
      // Har i tillegg miljøsperre (KJEDEKLAR_ENV=development); test-backenden er `test`.
      args: () => ({}),
      verifyNoEffect: async ({ fx, a }) => {
        expect((await a.query(listMine, {})).map((o) => o.id)).toEqual([fx.orgA]);
      },
    },
    "ops/workspaces:provision": {
      args: () => ({ organizationName: "Kapret AS", adminEmail: "kapret-provision@mailtest.example" }),
      verifyNoEffect: async () => {
        await new Promise((r) => setTimeout(r, 1000));
        expect(await messagesTo("kapret-provision@mailtest.example")).toEqual([]);
      },
    },
    "email/actions:sendAuthEmail": {
      args: () => ({ kind: "reset", to: "kapret-epost@mailtest.example", sealedUrl: "a.b" }),
      verifyNoEffect: async () => {
        await new Promise((r) => setTimeout(r, 1000));
        expect(await messagesTo("kapret-epost@mailtest.example")).toEqual([]);
      },
    },
    "email/actions:sendInvitation": {
      args: ({ fx }) => ({ invitationId: fx.orgA }),
      verifyNoEffect: async () => {},
    },
    "suppliers/import/internal:suppliersForMatching": {
      // Query: et vellykket kall ville returnert B sine leverandører. Avslaget er beviset.
      args: ({ fx }) => ({ organizationId: fx.orgB, paginationOpts: { numItems: 5, cursor: null } }),
      verifyNoEffect: async () => {},
    },
    "suppliers/import/store:createBatch": {
      args: ({ fx }) => ({
        organizationId: fx.orgB,
        userId: fx.userA.userId,
        reportingPeriodId: "ukjent",
        fileName: "kapret.csv",
        fileHash: "0".repeat(64),
        normalizedHash: "1".repeat(64),
        mapping: { name: 0 },
        rowCount: 1,
        entryCount: 1,
      }),
      verifyNoEffect: async () => {},
    },
    "suppliers/import/store:addEntries": {
      args: ({ fx }) => ({ organizationId: fx.orgB, batchId: fx.orgB, entries: [] }),
      verifyNoEffect: async () => {},
    },
    "suppliers/import/store:finalizeBatch": {
      args: ({ fx }) => ({
        organizationId: fx.orgB,
        userId: fx.userA.userId,
        batchId: fx.orgB,
        kindCounts: { new_clean: 0, new_warning: 0, known: 0, unclear: 0, error: 0 },
      }),
      verifyNoEffect: async () => {},
    },
    "risk/internal:importVersion": {
      args: () => ({ operator: "kapret", payload: probeRiskPayload }),
      // Hadde en klient kommet gjennom, ville versjonen alt finnes og operatørens import avvises.
      verifyNoEffect: async () => {
        expect(runInternal<{ status: string }>("risk/internal:importVersion", { operator: "kontroll", payload: probeRiskPayload }).status).toBe("imported");
      },
    },
    "risk/internal:engineData": {
      // Query: et vellykket kall ville gitt klienten innholdet i de aktive risikodataene. Avslaget er beviset.
      args: () => ({}),
      verifyNoEffect: async () => {},
    },
    "risk/internal:activateVersion": {
      args: () => ({ operator: "kapret", kind: "country", version: "finnes-ikke" }),
      verifyNoEffect: async () => {},
    },
    "jobs/internal:begin": {
      args: ({ fx }) => ({ jobId: fx.orgA }),
      verifyNoEffect: async () => {},
    },
    "jobs/internal:attemptFailed": {
      args: ({ fx }) => ({ jobId: fx.orgA, attempt: 1, errorCode: "KAPRET" }),
      verifyNoEffect: async () => {},
    },
    "jobs/internal:complete": {
      args: ({ fx }) => ({ jobId: fx.orgA, output: { echoed: "kapret" } }),
      verifyNoEffect: async () => {},
    },
    "jobs/internal:completed": {
      args: ({ fx }) => ({ workId: "kapret", context: { jobId: fx.orgA }, result: { kind: "success", returnValue: null } }),
      verifyNoEffect: async () => {},
    },
    "jobs/run:run": {
      args: ({ fx }) => ({ jobId: fx.orgA }),
      verifyNoEffect: async () => {},
    },
    "jobs/testHandler:probeControl": {
      // Query: et vellykket kall ville lest en leverandør i B. Avslaget er beviset.
      args: ({ fx }) => ({ organizationId: fx.orgB, supplierId: fx.orgB }),
      verifyNoEffect: async () => {},
    },
    "invitations/internal:findValid": {
      // Query: et vellykket kall ville bekreftet et token. Avslaget er beviset.
      args: () => ({ token: "x".repeat(43) }),
      verifyNoEffect: async () => {},
    },
    "invitations/internal:attachToken": {
      args: ({ fx }) => ({ invitationId: fx.orgA, tokenHash: "0".repeat(64) }),
      verifyNoEffect: async () => {},
    },
    "invitations/internal:consumeForUser": {
      args: ({ fx }) => ({ invitationId: fx.orgB, tokenHash: "0".repeat(64), userId: fx.userA.userId }),
      verifyNoEffect: async ({ fx, a }) => {
        expect((await a.query(listMine, {})).map((o) => o.id)).toEqual([fx.orgA]);
      },
    },
    "ops/testing:setImportRowName": {
      args: ({ fx }) => ({ rowId: fx.orgA, name: "Kapret AS" }),
      verifyNoEffect: async () => {},
    },
    "ops/testing:setPeriodCountries": {
      args: ({ fx }) => ({ supplierId: fx.orgA, reportingPeriodId: fx.orgA, productionCountries: ["XA"] }),
      verifyNoEffect: async () => {},
    },
    "ops/testing:seedSuppliersForRisk": {
      args: ({ fx }) => ({ organizationId: fx.orgB, reportingPeriodId: fx.orgB, from: 0, count: 1 }),
      verifyNoEffect: async () => {},
    },
    "ops/testing:expireInvitation": {
      args: ({ fx }) => ({ invitationId: fx.orgA }),
      verifyNoEffect: async () => {},
    },
    "ops/testing:createUnverifiedUser": {
      args: () => ({ email: "kapret-ubekreftet@mailtest.example", password: "kapret-passord-123" }),
      verifyNoEffect: async () => {
        // Finnes ikke: feil passord/ukjent bruker gir 401, ikke 403 (ubekreftet).
        await expect(signIn("kapret-ubekreftet@mailtest.example", "kapret-passord-123")).rejects.toThrow(
          /Innlogging feilet: 401/,
        );
      },
    },
    "lib/tenantAction:resolve": {
      // Query: et vellykket kall ville gitt tenantkontekst for en annen org.
      args: ({ fx }) => ({ organizationId: fx.orgB }),
      verifyNoEffect: async () => {},
    },
    "suppliers/enrichmentJob:orgNumberFor": {
      // Query: et vellykket kall ville gitt org.nr. for en leverandør i en annen organisasjon.
      args: ({ fx }) => ({ organizationId: fx.orgA, supplierId: "ukjent" }),
      verifyNoEffect: async () => {},
    },
    "organizations/registryInternal:storePreview": {
      args: ({ fx }) => ({
        organizationId: fx.orgA,
        fetchedBy: fx.userA.userId,
        fetchedAt: Date.now(),
        profile: { ...SYNTHETIC_REGISTRY_PROFILE, name: "Kapret AS" },
        payloadHash: "0".repeat(64),
        mappingVersion: "brreg-enhet-v1",
      }),
      verifyNoEffect: async ({ fx, a }) => {
        expect((await a.query(api.organizations.registry.current, org(fx.orgA))).snapshotId).toBeNull();
      },
    },
    "ops/testing:auditRollbackProbe": {
      args: ({ fx }) => ({ organizationId: fx.orgA, name: "Kapret", fail: false }),
      verifyNoEffect: async ({ fx, a }) => {
        expect((await a.query(current, org(fx.orgA))).name).toMatch(/^Org A /);
      },
    },
    "ops/testing:createTenantFixture": {
      args: () => ({ suffix: "kapret", password: "kapret-passord-123" }),
      verifyNoEffect: async () => {
        await expect(signIn("a-kapret@tenant-a.example", "kapret-passord-123")).rejects.toThrow(/Innlogging feilet/);
      },
    },
  };

  test("alle interne funksjoner har en probe", () => {
    expect(Object.keys(internalProbes).sort()).toEqual(internalFunctions().map((f) => f.path));
  });

  test.each(internalFunctions().map((f) => [f.path, f] as const))(
    "%s kan ikke kalles uten admin key",
    async (path, f) => {
      const probe = internalProbes[path];
      expect(probe, `mangler probe for ${path}`).toBeDefined();
      for (const client of [env.a, env.b, env.anonymous]) {
        const r = await errorOf(callByPath(client, f.kind, path, probe.args(env)));
        expect(r.code, path).not.toBe("OK");
      }
      await probe.verifyNoEffect(env);
    },
  );

  test("Better Auth-komponentens funksjoner kan ikke kalles fra klient", async () => {
    const attempts: Array<[FunctionKind, string, Record<string, unknown>]> = [
      ["query", "betterAuth/adapter:findMany", { input: { model: "user" }, paginationOpts: { cursor: null, numItems: 10 } }],
      ["query", "betterAuth/adapter:findOne", { input: { model: "session", where: [] } }],
      ["mutation", "betterAuth/adapter:create", { input: { model: "user", data: {} } }],
      ["query", "adapter:findMany", { input: { model: "user" }, paginationOpts: { cursor: null, numItems: 10 } }],
    ];
    for (const client of [env.a, env.anonymous]) {
      for (const [kind, path, args] of attempts) {
        expect((await errorOf(callByPath(client, kind, path, args))).code, path).not.toBe("OK");
      }
    }
  });

  test("Better Auth har ingen admin- eller organisasjonsendepunkter å tildele seg rolle med", async () => {
    const headers = {
      "content-type": "application/json",
      origin: TEST_BACKEND.appOrigin,
      cookie: env.sessionA.cookie,
    };
    const probes: Array<[string, string, unknown]> = [
      ["GET", "/api/auth/admin/list-users", undefined],
      ["POST", "/api/auth/admin/set-role", { userId: env.fx.userA.userId, role: "admin" }],
      ["POST", "/api/auth/organization/create", { name: "Kapret", slug: "kapret" }],
      ["POST", "/api/auth/organization/set-active", { organizationId: env.fx.orgB }],
    ];
    for (const [method, path, body] of probes) {
      const response = await fetch(`${TEST_BACKEND.siteUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      expect(response.status, `${method} ${path}`).toBe(404);
    }
    // Uansett hva Better Auth svarer, gir det ingen tilgang i appen.
    expect((await errorOf(env.a.query(current, org(env.fx.orgB)))).code).toBe("NOT_FOUND");
  });

  test("JWKS-endepunktet tåler samtidige oppslag og kan ikke brukes opp av klienter", async () => {
    // Regresjon: en delt ratebegrensningsteller på JWKS ga HTTP 500 under samtidige
    // tokenverifiseringer, og over 100 oppslag per 10 s ville blokkert alle brukere.
    const statuses: number[] = [];
    for (let batch = 0; batch < 4; batch++) {
      const responses = await Promise.all(
        Array.from({ length: 30 }, () => fetch(`${TEST_BACKEND.siteUrl}/api/auth/convex/jwks`)),
      );
      for (const r of responses) {
        statuses.push(r.status);
        const body = (await r.json()) as { keys?: unknown[] };
        expect(body.keys?.length).toBeGreaterThan(0);
      }
    }
    expect(statuses.filter((s) => s !== 200)).toEqual([]);
    // Innlogget bruk virker fortsatt etter 120 oppslag.
    expect((await env.a.query(current, org(env.fx.orgA))).id).toBe(env.fx.orgA);
  });

  test("uinnloggede tokenoppslag kan ikke blokkere token for innloggede brukere", async () => {
    // Regresjon: tokenendepunktet delte én ratebegrensningsteller for alle. 120
    // oppslag uten sesjon ville brukt den opp, og innloggede brukere ble sendt ut.
    const statuses: number[] = [];
    for (let batch = 0; batch < 4; batch++) {
      const responses = await Promise.all(
        Array.from({ length: 30 }, () =>
          fetch(`${TEST_BACKEND.siteUrl}/api/auth/convex/token`, {
            headers: { origin: TEST_BACKEND.appOrigin },
          }),
        ),
      );
      statuses.push(...responses.map((r) => r.status));
    }
    expect(statuses.filter((s) => s === 429)).toEqual([]);
    const own = await fetch(`${TEST_BACKEND.siteUrl}/api/auth/convex/token`, {
      headers: { cookie: env.sessionA.cookie, origin: TEST_BACKEND.appOrigin },
    });
    expect(own.status).toBe(200);
    expect(((await own.json()) as { token?: string }).token).toBeTruthy();
  });

  test("åpen registrering er slått av", async () => {
    const response = await fetch(`${TEST_BACKEND.siteUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: TEST_BACKEND.appOrigin },
      body: JSON.stringify({ email: "ny@tenant-x.example", password: "abcdefghijkl", name: "Ny" }),
    });
    expect(response.ok).toBe(false);
  });

  test("feil passord gir ingen token", async () => {
    await expect(signIn(env.fx.userA.email, `${env.fx.password}x`)).rejects.toThrow(/Innlogging feilet/);
  });
});

describe("etter at et medlemskap er deaktivert", () => {
  let env: TwoTenants;
  let live: ConvexClient | undefined;

  beforeAll(async () => {
    env = await setupTwoTenants();
  });

  afterAll(async () => {
    await live?.close();
  });

  function newWorkspaceForA(name: string): Id<"organizations"> {
    return runInternal<Id<"organizations">>("ops/organizations:createWorkspace", {
      name: `${name} ${env.fx.orgA}`,
      country: "NO",
      userId: env.fx.userA.userId,
    });
  }

  function deactivateA(organizationId: string) {
    runInternal("ops/organizations:setMembership", {
      organizationId,
      userId: env.fx.userA.userId,
      status: "inactive",
    });
  }

  test("samme token mister tilgang ved neste kall", async () => {
    const orgD = newWorkspaceForA("Org D");
    expect((await env.a.query(current, org(orgD))).id).toBe(orgD);
    expect((await env.a.query(listMine, {})).map((o) => o.id)).toContain(orgD);

    deactivateA(orgD);

    expect(await errorOf(env.a.query(current, org(orgD)))).toEqual(
      await errorOf(env.a.query(current, org(env.fx.orgB))),
    );
    expect((await env.a.query(listMine, {})).map((o) => o.id)).not.toContain(orgD);
    // Andre medlemskap er upåvirket.
    expect((await env.a.query(current, org(env.fx.orgA))).id).toBe(env.fx.orgA);
  });

  test("et åpent live-abonnement får avslag når medlemskapet deaktiveres", async () => {
    const orgE = newWorkspaceForA("Org E");
    live = new ConvexClient(TEST_BACKEND.url);
    live.setAuth(async () => env.sessionA.token);
    const updates: Array<{ id: string } | { error: string }> = [];
    live.onUpdate(
      current,
      org(orgE),
      (result) => updates.push({ id: result.id }),
      (error) => updates.push({ error: error instanceof ConvexError ? (error.data as { code: string }).code : error.message }),
    );
    await waitFor(() => updates.length > 0);
    expect(updates[0]).toEqual({ id: orgE });

    deactivateA(orgE);

    await waitFor(() => updates.some((u) => "error" in u));
    expect(updates.at(-1)).toEqual({ error: "NOT_FOUND" });
  });
});
