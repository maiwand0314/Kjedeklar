import { wrapDatabaseWriter } from "convex-helpers/server/rowLevelSecurity";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RLS_CONFIG, tenantRules } from "../../convex/lib/rls";
import { api } from "../../convex/_generated/api";
import aksjeselskap from "../fixtures/brreg/enhet-aksjeselskap.json";
import utenNaeringskode from "../fixtures/brreg/enhet-uten-naeringskode.json";
import { expectAppError, setupTest, twoTenants, type TestConvex } from "./setup";

const { lookup, confirm, current } = api.organizations.registry;
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.useRealTimers();
});

/** Falsk Brreg: svarer med gitt fixture for riktig org.nr., ellers 404. */
function fakeBrreg(fixtures: Array<{ organisasjonsnummer: string }>) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    const match = fixtures.find((f) => String(url).endsWith(`/${f.organisasjonsnummer}`));
    return match ? new Response(JSON.stringify(match), { status: 200 }) : new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
  return calls;
}

async function lookupAsA(t: TestConvex, fx: Awaited<ReturnType<typeof twoTenants>>, orgNumber: string) {
  return await t.withIdentity(fx.userA.identity).action(lookup, { organizationId: fx.orgA, orgNumber });
}

const auditOf = (t: TestConvex) => t.run((ctx) => ctx.db.query("auditEvents").collect());

describe("oppslag", () => {
  test("gyldig oppslag lagrer bare forhåndsvisning med kilde og hentetid", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    fakeBrreg([aksjeselskap]);
    const result = await lookupAsA(t, fx, "920 000 002");
    if (result.kind !== "found") throw new Error(result.kind);
    expect(result.profile).toMatchObject({ orgNumber: "920000002", name: "SYNTETISK TESTVARER AS", industryCode: "46.900" });
    expect(result.gaps).toEqual([]);
    const snapshot = await t.run((ctx) => ctx.db.get("registrySnapshots", result.snapshotId));
    expect(snapshot).toMatchObject({
      organizationId: fx.orgA,
      source: "brreg-enhetsregisteret",
      status: "preview",
      fetchedBy: fx.userA.userId,
      mappingVersion: "brreg-enhet-v1",
    });
    expect(snapshot?.sourcePayloadHash).toMatch(/^[0-9a-f]{64}$/);
    // Ingenting er endret på organisasjonen før bekreftelse.
    expect(await t.withIdentity(fx.userA.identity).query(current, { organizationId: fx.orgA })).toMatchObject({
      name: "Org A",
      snapshotId: null,
      profile: null,
    });
    expect(await auditOf(t)).toEqual([]);
  });

  test("ugyldig org.nr. stoppes uten kall til registeret", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    const calls = fakeBrreg([aksjeselskap]);
    expect(await lookupAsA(t, fx, "920000003")).toEqual({ kind: "invalid_org_number" });
    expect(calls).toEqual([]);
  });

  test("ukjent org.nr. gir not_found, og manglende næringskode blir datamangel", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    fakeBrreg([utenNaeringskode]);
    expect(await lookupAsA(t, fx, "920000002")).toEqual({ kind: "not_found" });
    const result = await lookupAsA(t, fx, "931234560");
    if (result.kind !== "found") throw new Error(result.kind);
    expect(result.gaps).toEqual(["Næringskode mangler i registeret."]);
  });

  test("registeret utilgjengelig gir unavailable, ikke feil", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    // fetch er stoppet i setup.ts (nettverksfeil)
    expect(await lookupAsA(t, fx, "920000002")).toEqual({ kind: "unavailable", reason: "network" });
  });
});

describe("bekreftelse", () => {
  async function preview(
    t: TestConvex,
    fx: Awaited<ReturnType<typeof twoTenants>>,
    fixture: { organisasjonsnummer: string } = aksjeselskap,
  ) {
    fakeBrreg([fixture]);
    const result = await lookupAsA(t, fx, fixture.organisasjonsnummer);
    if (result.kind !== "found") throw new Error(result.kind);
    return result.snapshotId;
  }

  test("lagrer opplysninger, snapshot og revisjonslogg sammen; visningsnavn beholdes", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    const snapshotId = await preview(t, fx);
    const asA = t.withIdentity(fx.userA.identity);
    await asA.mutation(confirm, { organizationId: fx.orgA, snapshotId, expectedCurrentSnapshotId: null, useRegistryName: false });

    const after = await asA.query(current, { organizationId: fx.orgA });
    expect(after).toMatchObject({ name: "Org A", snapshotId, profile: { orgNumber: "920000002" } });
    expect(after.fetchedAt).toBeTypeOf("number");
    expect(after.confirmedAt).toBeTypeOf("number");
    expect((await t.run((ctx) => ctx.db.get("registrySnapshots", snapshotId)))?.status).toBe("confirmed");

    const [event] = await auditOf(t);
    expect(event).toMatchObject({
      eventType: "organization.registry_confirmed",
      actorId: fx.userA.userId,
      safeDiff: {
        orgNumber: { to: "920000002" },
        legalForm: { to: "AS" },
        industryCode: { to: "46.900" },
      },
    });
    expect(event.safeDiff.name).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain("Testgata");
  });

  test("navnet fra registeret brukes bare når brukeren velger det", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    const snapshotId = await preview(t, fx);
    await t.withIdentity(fx.userA.identity).mutation(confirm, {
      organizationId: fx.orgA, snapshotId, expectedCurrentSnapshotId: null, useRegistryName: true,
    });
    expect((await t.run((ctx) => ctx.db.get("organizations", fx.orgA)))?.name).toBe("SYNTETISK TESTVARER AS");
    expect((await auditOf(t))[0].safeDiff.name).toEqual({ from: "Org A", to: "SYNTETISK TESTVARER AS" });
  });

  test("tidligere bekreftede verdier overskrives ikke stille", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    const asA = t.withIdentity(fx.userA.identity);
    const first = await preview(t, fx);
    await asA.mutation(confirm, { organizationId: fx.orgA, snapshotId: first, expectedCurrentSnapshotId: null, useRegistryName: false });

    // En annen fane så fortsatt «ingen bekreftet» og prøver å bekrefte et nytt oppslag.
    const second = await preview(t, fx, utenNaeringskode);
    await expectAppError(
      asA.mutation(confirm, { organizationId: fx.orgA, snapshotId: second, expectedCurrentSnapshotId: null, useRegistryName: false }),
      "CONFLICT",
    );
    expect((await asA.query(current, { organizationId: fx.orgA })).profile?.orgNumber).toBe("920000002");
    expect(await auditOf(t)).toHaveLength(1);

    // Med riktig gjeldende verdi er endringen eksplisitt og logges.
    await asA.mutation(confirm, { organizationId: fx.orgA, snapshotId: second, expectedCurrentSnapshotId: first, useRegistryName: false });
    const events = await auditOf(t);
    expect(events[1].safeDiff).toMatchObject({ orgNumber: { from: "920000002", to: "931234560" }, industryCode: { from: "46.900" } });
  });

  test("brukt eller for gammel forhåndsvisning avvises", async () => {
    vi.useFakeTimers();
    const t = setupTest();
    const fx = await twoTenants(t);
    const asA = t.withIdentity(fx.userA.identity);
    const snapshotId = await preview(t, fx);
    await asA.mutation(confirm, { organizationId: fx.orgA, snapshotId, expectedCurrentSnapshotId: null, useRegistryName: false });
    await expectAppError(
      asA.mutation(confirm, { organizationId: fx.orgA, snapshotId, expectedCurrentSnapshotId: snapshotId, useRegistryName: false }),
      "PREVIEW_EXPIRED",
    );
    const old = await preview(t, fx);
    vi.advanceTimersByTime(31 * 60 * 1000);
    await expectAppError(
      asA.mutation(confirm, { organizationId: fx.orgA, snapshotId: old, expectedCurrentSnapshotId: snapshotId, useRegistryName: false }),
      "PREVIEW_EXPIRED",
    );
  });

  test("bekreftet snapshot er historikk og kan ikke endres fra tenantfunksjoner", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    const snapshotId = await preview(t, fx);
    await t.withIdentity(fx.userA.identity).mutation(confirm, {
      organizationId: fx.orgA, snapshotId, expectedCurrentSnapshotId: null, useRegistryName: false,
    });
    await t.run(async (ctx) => {
      const db = wrapDatabaseWriter({}, ctx.db, tenantRules({ organizationId: fx.orgA }), RLS_CONFIG);
      await expect(db.patch("registrySnapshots", snapshotId, { status: "preview" })).rejects.toThrow();
    });
    expect((await t.run((ctx) => ctx.db.get("registrySnapshots", snapshotId)))?.status).toBe("confirmed");
  });

  test("forhåndsvisning fra en annen organisasjon kan ikke bekreftes", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    const snapshotOfA = await preview(t, fx);
    await expectAppError(
      t.withIdentity(fx.userB.identity).mutation(confirm, {
        organizationId: fx.orgB, snapshotId: snapshotOfA, expectedCurrentSnapshotId: null, useRegistryName: true,
      }),
      "NOT_FOUND",
    );
    expect((await t.run((ctx) => ctx.db.get("organizations", fx.orgB)))?.name).toBe("Org B");
    expect((await t.run((ctx) => ctx.db.get("registrySnapshots", snapshotOfA)))?.status).toBe("preview");
  });
});
