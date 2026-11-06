import { ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { ConvexHttpClient } from "convex/browser";
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  anonymousClient,
  clientFor,
  createTenantFixture,
  TEST_BACKEND,
  type TenantFixture,
} from "../helpers/local-backend";

async function errorCodeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ConvexError) return (error.data as { code: string }).code;
    return `ERROR:${(error as Error).message}`;
  }
  return "OK";
}

const current = api.organizations.queries.current;
const org = (id: string) => ({ organizationId: id as Id<"organizations"> });

describe("tenant-isolasjon mot lokal Convex-backend", () => {
  let fx: TenantFixture;
  let a: ConvexHttpClient;
  let b: ConvexHttpClient;

  beforeAll(async () => {
    fx = createTenantFixture();
    a = await clientFor(fx.userA.email, fx.password);
    b = await clientFor(fx.userB.email, fx.password);
  });

  test("bruker A leser org A", async () => {
    const result = await a.query(current, org(fx.orgA));
    expect(result.id).toBe(fx.orgA);
    expect(result.name).toMatch(/^Org A /);
  });

  test("bruker A kan ikke lese org B gjennom samme funksjon", async () => {
    expect(await errorCodeOf(a.query(current, org(fx.orgB)))).toBe("NOT_FOUND");
  });

  test("inaktivt medlemskap gir samme avslag som fremmed organisasjon", async () => {
    expect(await errorCodeOf(a.query(current, org(fx.orgC)))).toBe("NOT_FOUND");
  });

  test("uinnlogget kall avvises", async () => {
    expect(await errorCodeOf(anonymousClient().query(current, org(fx.orgA)))).toBe(
      "UNAUTHENTICATED",
    );
  });

  test("organisasjonsvelgeren viser bare egne aktive organisasjoner", async () => {
    const mine = await a.query(api.organizations.queries.listMine, {});
    expect(mine.map((o) => o.id)).toEqual([fx.orgA]);
  });

  test("samtidige kall fra to brukere får hver sin tenant", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        i % 2 === 0 ? a.query(current, org(fx.orgA)) : b.query(current, org(fx.orgB)),
      ),
    );
    results.forEach((r, i) => expect(r.id).toBe(i % 2 === 0 ? fx.orgA : fx.orgB));
    expect(await errorCodeOf(b.query(current, org(fx.orgA)))).toBe("NOT_FOUND");
  });

  test("interne funksjoner kan ikke kalles av innlogget bruker", async () => {
    const internalBootstrap = makeFunctionReference<"mutation">(
      "ops/organizations:ensureOrganizationWithMember",
    );
    const code = await errorCodeOf(
      a.mutation(internalBootstrap, {
        name: "Kapret",
        country: "NO",
        userId: fx.userA.userId,
        membershipStatus: "active",
      }),
    );
    // Backenden skjuler detaljer (REDACT_LOGS_TO_CLIENT); det viktige er avslag
    // og at ingen organisasjon eller medlemskap ble opprettet.
    expect(code).not.toBe("OK");
    const mine = await a.query(api.organizations.queries.listMine, {});
    expect(mine.map((o) => o.name)).not.toContain("Kapret");
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
    await expect(clientFor(fx.userA.email, `${fx.password}x`)).rejects.toThrow(/Innlogging feilet/);
  });
});
