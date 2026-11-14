/**
 * Brreg-beriking av leverandører: status per leverandør, retry med grenser,
 * brukerrettelser som ikke overskrives, forslag med kodeverk og hentetid,
 * tenantvern og revisjonslogg. Brreg er falsk (tests/helpers/fake-brreg.ts).
 */
import type { FunctionArgs } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { enhetBody, fakeBrreg, type FakeReply } from "../helpers/fake-brreg";
import { SYNTHETIC_SUPPLIER_DOC } from "../helpers/public-functions";
import { expectAppError, setupTest, twoTenants } from "./setup";

const realFetch = globalThis.fetch;
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = realFetch;
});

const [NO_A, NO_B, NO_C, NO_D] = ["920000010", "920000029", "920000037", "920000045"];
const ok = (orgNumber: string, overrides?: Record<string, unknown>): FakeReply => ({ status: 200, body: enhetBody(orgNumber, overrides) });

async function start(replies: Record<string, FakeReply[]> = {}) {
  const t = setupTest();
  const fx = await twoTenants(t);
  const brreg = fakeBrreg(replies);
  globalThis.fetch = brreg.impl;
  const a = t.withIdentity(fx.userA.identity);
  const b = t.withIdentity(fx.userB.identity);
  const supplier = (fields: Record<string, unknown> = {}, organizationId = fx.orgA) =>
    t.run((ctx) =>
      ctx.db.insert("suppliers", { organizationId, ...SYNTHETIC_SUPPLIER_DOC, createdAt: 0, createdBy: "oppsett", ...fields }) as Promise<Id<"suppliers">>,
    );
  const org = { organizationId: fx.orgA };
  const request = (supplierId: string) => a.mutation(api.suppliers.enrichment.request, { ...org, supplierId });
  const info = (supplierId: string) => a.query(api.suppliers.enrichment.get, { ...org, supplierId });
  const doc = (supplierId: Id<"suppliers">) => t.run((ctx) => ctx.db.get("suppliers", supplierId));
  const drain = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  const events = async () => (await t.run((ctx) => ctx.db.query("auditEvents").collect())).map((e) => [e.eventType, e.entityType] as const);
  const jobs = () => t.run((ctx) => ctx.db.query("jobs").collect());
  const snapshots = () => t.run((ctx) => ctx.db.query("registrySnapshots").collect());
  return { t, fx, a, b, org, brreg, supplier, request, info, doc, drain, events, jobs, snapshots };
}

describe("henting og status", () => {
  test("lykket henting gir snapshot, status og forslag, men endrer ikke profilen", async () => {
    const env = await start({ [NO_A]: [ok(NO_A)] });
    const id = await env.supplier({ name: "Testvarer AS", registryOrgNumber: NO_A });
    expect(await env.info(id)).toMatchObject({ state: "not_fetched", suggestions: [] });

    const { jobId, created } = await env.request(id);
    expect(created).toBe(true);
    expect(await env.info(id)).toMatchObject({ state: "queued" });
    await env.drain();

    const info = await env.info(id);
    expect(info).toMatchObject({ state: "succeeded", fetchedAt: expect.any(Number), gaps: [] });
    expect(info.suggestions).toEqual([
      { field: "name", current: "Testvarer AS", proposed: "SYNTETISK TESTVARER AS" },
      { field: "registeredCountry", current: null, proposed: "NO" },
      { field: "industryCode", current: null, proposed: "46.900" },
    ]);
    // Profilen er urørt: ingen registerverdi er skrevet inn, og versjonen er den samme.
    const supplier = await env.doc(id);
    expect(supplier).toMatchObject({ name: "Testvarer AS", rowVersion: 1, registryEnrichment: { state: "succeeded", jobId } });
    expect(supplier).not.toHaveProperty("registeredCountry");
    expect(supplier).not.toHaveProperty("industryCode");
    expect(await env.snapshots()).toMatchObject([
      { organizationId: env.fx.orgA, supplierId: id, orgNumber: NO_A, status: "fetched", mappingVersion: "brreg-enhet-v1", sourcePayloadHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
    ]);
    expect(await env.events()).toEqual([
      ["job.created", "job"],
      ["supplier.registry_requested", "supplier"],
      ["supplier.registry_fetched", "supplier"],
      ["job.succeeded", "job"],
    ]);
  });

  test("blanding: norsk funnet, ikke funnet i registeret, uten org.nr. og utenlandsk", async () => {
    const env = await start({ [NO_A]: [ok(NO_A)], [NO_B]: [{ status: 404 }], [NO_C]: [{ status: 410 }] });
    const found = await env.supplier({ name: "Funnet AS", registryOrgNumber: NO_A });
    const missing = await env.supplier({ name: "Finnes ikke AS", registryOrgNumber: NO_B });
    const removed = await env.supplier({ name: "Fjernet AS", registryOrgNumber: NO_C });
    const foreign = await env.supplier({ name: "Foreign Ltd", registeredCountry: "GB" });
    const manual = await env.supplier({ name: "Manuell AS" });

    expect(await env.a.mutation(api.suppliers.enrichment.requestMissing, env.org)).toEqual({ requested: 3, moreAvailable: false });
    await env.drain();
    expect(await env.brreg.calls).toEqual({ [NO_A]: 1, [NO_B]: 1, [NO_C]: 1 });

    const list = await env.a.query(api.suppliers.queries.list, { ...env.org, paginationOpts: { numItems: 10, cursor: null } });
    const state = (id: string) => list.page.find((s) => s.id === id)?.registryState;
    expect([found, missing, removed, foreign, manual].map(state)).toEqual(["succeeded", "not_found", "removed", "not_applicable", "not_applicable"]);
    // Utenlandske og manuelle leverandører fungerer som før: ingen jobb, ingen feil, ingen forslag.
    expect(await env.jobs()).toHaveLength(3);
    expect(await env.info(foreign)).toMatchObject({ state: "not_applicable", suggestions: [] });
    await expectAppError(env.request(manual), "INVALID_INPUT");
    // Et nytt «hent for alle» tar ikke de som alt har fått svar.
    expect(await env.a.mutation(api.suppliers.enrichment.requestMissing, env.org)).toEqual({ requested: 0, moreAvailable: false });
  });

  test("hent for alle tar høyst 50 om gangen og sier fra om resten", async () => {
    const env = await start({});
    for (let i = 0; i < 52; i++) await env.supplier({ name: `Bulk ${String(i).padStart(2, "0")} AS`, nameKey: `bulk ${String(i).padStart(2, "0")} as`, registryOrgNumber: NO_A });
    expect(await env.a.mutation(api.suppliers.enrichment.requestMissing, env.org)).toEqual({ requested: 50, moreAvailable: true });
    expect(await env.jobs()).toHaveLength(50);
    expect(await env.a.mutation(api.suppliers.enrichment.requestMissing, env.org)).toEqual({ requested: 2, moreAvailable: false });
  });

  test("dobbel forespørsel gir én jobb og ett oppslag; ny forespørsel etter svar gir ny henting", async () => {
    const env = await start({ [NO_A]: [ok(NO_A)] });
    const id = await env.supplier({ name: "Testvarer AS", registryOrgNumber: NO_A });
    const [first, second] = [await env.request(id), await env.request(id)];
    expect(second).toEqual({ jobId: first.jobId, created: false });
    await env.drain();
    expect(env.brreg.calls[NO_A]).toBe(1);
    const again = await env.request(id);
    expect(again.created).toBe(true);
    expect(again.jobId).not.toBe(first.jobId);
    await env.drain();
    expect(env.brreg.calls[NO_A]).toBe(2);
    expect(await env.snapshots()).toHaveLength(2);
  });

  test("manglende næringskode blir ikke et forslag eller en verdi, og vises som datamangel", async () => {
    const body = JSON.stringify({ ...JSON.parse(enhetBody(NO_A)), naeringskode1: undefined });
    const env = await start({ [NO_A]: [{ status: 200, body }] });
    const id = await env.supplier({ name: "Syntetisk Testvarer AS", registryOrgNumber: NO_A });
    await env.request(id);
    await env.drain();
    const info = await env.info(id);
    expect(info.gaps).toContain("Næringskode mangler i registeret.");
    expect(info.suggestions.map((s) => s.field)).toEqual(["registeredCountry"]);
    expect(await env.doc(id)).not.toHaveProperty("industryCode");
  });
});

describe("feil og retry", () => {
  test("429 prøves på nytt med grense; etter siste forsøk er statusen «failed», og oppslagene stopper", async () => {
    const env = await start({ [NO_A]: [{ status: 429 }] });
    const id = await env.supplier({ name: "Tregt AS", registryOrgNumber: NO_A });
    await env.request(id);
    await env.drain();
    expect(env.brreg.calls[NO_A]).toBe(4); // maxAttempts, ikke ett mer
    expect(await env.info(id)).toMatchObject({ state: "failed", errorCode: "BRREG_RATE_LIMITED" });
    expect(await env.jobs()).toMatchObject([{ status: "failed", attempts: 4, maxAttempts: 4, errorCode: "BRREG_RATE_LIMITED" }]);
    // Ingenting flere forsøk kommer, og leverandøren (importen) er urørt.
    await env.drain();
    expect(env.brreg.calls[NO_A]).toBe(4);
    expect(await env.doc(id)).toMatchObject({ name: "Tregt AS", rowVersion: 1, registryOrgNumber: NO_A });
    expect((await env.events()).filter(([type]) => type === "supplier.registry_fetched")).toHaveLength(1);
  });

  test("forbigående feil (429, timeout, 503, nett) gir delvis feil: de andre leverandørene får svar", async () => {
    const env = await start({
      [NO_A]: [{ status: 429 }, ok(NO_A)],
      [NO_B]: ["network", ok(NO_B)],
      [NO_C]: [{ status: 503 }, { status: 503 }, ok(NO_C)],
      [NO_D]: [{ status: 503 }],
    });
    const ids = [
      await env.supplier({ name: "A AS", registryOrgNumber: NO_A }),
      await env.supplier({ name: "B AS", registryOrgNumber: NO_B }),
      await env.supplier({ name: "C AS", registryOrgNumber: NO_C }),
      await env.supplier({ name: "D AS", registryOrgNumber: NO_D }),
    ];
    await env.a.mutation(api.suppliers.enrichment.requestMissing, env.org);
    await env.drain();
    expect(await Promise.all(ids.map(async (id) => (await env.info(id)).state))).toEqual(["succeeded", "succeeded", "succeeded", "failed"]);
    expect(await env.info(ids[3])).toMatchObject({ errorCode: "BRREG_UNAVAILABLE" });
  });

  test("timeout gir BRREG_TIMEOUT; kontrakten som ikke stemmer prøves ikke på nytt", async () => {
    const env = await start({ [NO_A]: ["hang"], [NO_B]: [{ status: 200, body: JSON.stringify({ organisasjonsnummer: NO_B }) }] });
    const hanging = await env.supplier({ name: "Henger AS", registryOrgNumber: NO_A });
    const changed = await env.supplier({ name: "Ny kontrakt AS", registryOrgNumber: NO_B });
    await env.request(hanging);
    await env.request(changed);
    // Timeout-timeren (8 s) er en falsk timer: kjør den, så oppslaget avbrytes.
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(9_000);
      await env.drain();
    }
    expect(await env.info(hanging)).toMatchObject({ state: "failed", errorCode: "BRREG_TIMEOUT" });
    expect(await env.info(changed)).toMatchObject({ state: "failed", errorCode: "BRREG_CONTRACT_CHANGED" });
    expect(env.brreg.calls[NO_B]).toBe(1);
  });

  test("feilet henting beholder siste vellykkede snapshot", async () => {
    const env = await start({ [NO_A]: [ok(NO_A), { status: 500 }] });
    const id = await env.supplier({ name: "Testvarer AS", registryOrgNumber: NO_A });
    await env.request(id);
    await env.drain();
    const before = await env.info(id);
    await env.request(id);
    expect((await env.info(id)).fetchedAt).toBe(before.fetchedAt); // mens den nye pågår
    await env.drain();
    expect(await env.info(id)).toMatchObject({ state: "failed", fetchedAt: before.fetchedAt, profile: before.profile });
  });
});

describe("brukerrettelser overskrives ikke", () => {
  test("redigering mens jobben kjører beholdes, og registerverdien blir et forslag", async () => {
    const env = await start({ [NO_A]: [ok(NO_A)] });
    const id = await env.supplier({ name: "Testvarer AS", registryOrgNumber: NO_A, registeredCountry: "SE", industryCodeSystem: "SN2007", industryCode: "47.110" });
    await env.request(id);
    // Brukeren retter navnet før køen har kjørt jobben.
    await env.a.mutation(api.suppliers.mutations.update, {
      ...env.org,
      supplierId: id,
      expectedRowVersion: 1,
      name: "Mitt eget navn AS",
      registryOrgNumber: NO_A,
      registeredCountry: "SE",
      industryCodeSystem: "SN2007",
      industryCode: "47.110",
    });
    await env.drain();
    expect(await env.doc(id)).toMatchObject({ name: "Mitt eget navn AS", registeredCountry: "SE", industryCode: "47.110", industryCodeSystem: "SN2007", rowVersion: 2 });
    expect((await env.info(id)).suggestions).toEqual([
      { field: "name", current: "Mitt eget navn AS", proposed: "SYNTETISK TESTVARER AS" },
      { field: "registeredCountry", current: "SE", proposed: "NO" },
      { field: "industryCode", current: "47.110", proposed: "46.900" },
    ]);
  });

  test("endret org.nr. mens jobben kjører: svaret for det gamle nummeret skrives ikke", async () => {
    const env = await start({ [NO_A]: [ok(NO_A)] });
    const id = await env.supplier({ name: "Testvarer AS", registryOrgNumber: NO_A });
    await env.request(id);
    await env.a.mutation(api.suppliers.mutations.update, { ...env.org, supplierId: id, expectedRowVersion: 1, name: "Testvarer AS", registryOrgNumber: NO_B });
    await env.drain();
    expect(await env.snapshots()).toEqual([]);
    expect(await env.info(id)).toMatchObject({ state: "not_fetched", profile: null, suggestions: [] });
  });

  test("å godta forslag endrer profilen med versjonssjekk, kilde, hentetid og revisjonslogg", async () => {
    const env = await start({ [NO_A]: [ok(NO_A)] });
    const id = await env.supplier({ name: "Testvarer AS", registryOrgNumber: NO_A });
    await env.request(id);
    await env.drain();
    const args = { ...env.org, supplierId: id, expectedRowVersion: 1 };
    const apply = (extra: Partial<FunctionArgs<typeof api.suppliers.enrichment.applySuggestion>>) =>
      env.a.mutation(api.suppliers.enrichment.applySuggestion, { ...args, ...extra } as FunctionArgs<typeof api.suppliers.enrichment.applySuggestion>);

    await expectAppError(apply({ field: "industryCode", expectedValue: "46.900" }), "INVALID_INPUT"); // kodeverket må velges
    await expectAppError(apply({ field: "industryCode", expectedValue: "99.999", industryCodeSystem: "SN2007" }), "CONFLICT"); // forslaget har endret seg
    await expectAppError(apply({ expectedRowVersion: 7, field: "registeredCountry", expectedValue: "NO" }), "CONFLICT");
    expect(await env.doc(id)).toMatchObject({ rowVersion: 1 });

    expect(await apply({ field: "industryCode", expectedValue: "46.900", industryCodeSystem: "SN2007" })).toEqual({ rowVersion: 2 });
    const supplier = await env.doc(id);
    const fetchedAt = (await env.snapshots())[0].fetchedAt;
    expect(supplier).toMatchObject({ industryCode: "46.900", industryCodeSystem: "SN2007", industryCodeSource: { fetchedAt }, rowVersion: 2 });
    expect((await env.info(id)).industryCodeSource).toEqual({ fetchedAt });
    const audit = (await env.t.run((ctx) => ctx.db.query("auditEvents").collect())).filter((e) => e.eventType === "supplier.updated");
    expect(audit).toMatchObject([{ reason: "Registerforslag godtatt: industryCode", actorType: "user", safeDiff: { industryCode: { to: "46.900" }, industryCodeSystem: { to: "SN2007" } } }]);

    // Samme forslag kan ikke godtas to ganger, og en kode endret for hånd mister kilden.
    await expectAppError(apply({ expectedRowVersion: 2, field: "industryCode", expectedValue: "46.900", industryCodeSystem: "SN2007" }), "CONFLICT");
    await env.a.mutation(api.suppliers.mutations.update, {
      ...env.org, supplierId: id, expectedRowVersion: 2, name: "Testvarer AS", registryOrgNumber: NO_A, industryCodeSystem: "SN2007", industryCode: "47.110",
    });
    expect(await env.doc(id)).not.toHaveProperty("industryCodeSource");
  });

  test("utenlandsk foretak registrert i Norge (NUF) får ikke registreringsland foreslått", async () => {
    const env = await start({ [NO_A]: [ok(NO_A, { organisasjonsform: { kode: "NUF", beskrivelse: "Norskregistrert utenlandsk foretak" } })] });
    const id = await env.supplier({ name: "Syntetisk Testvarer AS", registryOrgNumber: NO_A });
    await env.request(id);
    await env.drain();
    expect((await env.info(id)).suggestions.map((s) => s.field)).toEqual(["industryCode"]);
  });
});

describe("tenantvern og jobbgrenser", () => {
  test("fremmed leverandør gir samme «ikke funnet» for forespørsel, status og godkjenning", async () => {
    const env = await start({ [NO_A]: [ok(NO_A)] });
    const other = await env.supplier({ name: "Annen AS", registryOrgNumber: NO_A }, env.fx.orgB);
    const asB = { organizationId: env.fx.orgB };
    await expectAppError(env.request(other), "NOT_FOUND");
    await expectAppError(env.info(other), "NOT_FOUND");
    await expectAppError(env.a.mutation(api.suppliers.enrichment.applySuggestion, { ...env.org, supplierId: other, expectedRowVersion: 1, field: "name", expectedValue: "X" }), "NOT_FOUND");
    // Egen organisasjon kan fortsatt be om oppslag for sin egen leverandør.
    await env.b.mutation(api.suppliers.enrichment.request, { ...asB, supplierId: other });
    await env.drain();
    expect(await env.snapshots()).toMatchObject([{ organizationId: env.fx.orgB, supplierId: other }]);
    expect(env.brreg.calls[NO_A]).toBe(1);
  });

  test("hent for alle rører bare egen organisasjon", async () => {
    const env = await start({ [NO_A]: [ok(NO_A)] });
    const mine = await env.supplier({ name: "Min AS", registryOrgNumber: NO_A });
    const theirs = await env.supplier({ name: "Deres AS", registryOrgNumber: NO_A }, env.fx.orgB);
    expect(await env.a.mutation(api.suppliers.enrichment.requestMissing, env.org)).toEqual({ requested: 1, moreAvailable: false });
    await env.drain();
    expect(await env.doc(mine)).toHaveProperty("registryEnrichment");
    expect(await env.doc(theirs)).not.toHaveProperty("registryEnrichment");
  });

  test("brreg.enrich kan ikke opprettes via det generelle jobbendepunktet", async () => {
    const env = await start();
    const id = await env.supplier({ name: "Testvarer AS", registryOrgNumber: NO_A });
    await expectAppError(
      env.a.mutation(api.jobs.mutations.enqueue, { ...env.org, type: "brreg.enrich", inputRef: id, idempotencyKey: "omgå" }),
      "INVALID_INPUT",
    );
    expect(await env.jobs()).toEqual([]);
  });

  test("jobb med referanse til en annen organisasjons leverandør kjører ikke og gjør ingen oppslag", async () => {
    const env = await start({ [NO_A]: [ok(NO_A)] });
    const theirs = await env.supplier({ name: "Deres AS", registryOrgNumber: NO_A }, env.fx.orgB);
    const jobId = await env.t.run((ctx) =>
      ctx.db.insert("jobs", {
        organizationId: env.fx.orgA, type: "brreg.enrich", inputRef: theirs, idempotencyKey: "fremmed", status: "queued",
        attempts: 0, maxAttempts: 4, runAfter: 0, createdAt: 0, createdBy: "oppsett",
      }),
    );
    expect(await env.t.action(internal.jobs.run.run, { jobId })).toBeNull();
    expect(await env.jobs()).toMatchObject([{ status: "failed", errorCode: "INPUT_NOT_FOUND" }]);
    expect(env.brreg.calls).toEqual({});
    expect(await env.doc(theirs)).not.toHaveProperty("registryEnrichment");
  });

  test("orgNumberFor gir ingenting for en leverandør i en annen organisasjon", async () => {
    const env = await start();
    const theirs = await env.supplier({ name: "Deres AS", registryOrgNumber: NO_A }, env.fx.orgB);
    expect(await env.t.query(internal.suppliers.enrichmentJob.orgNumberFor, { organizationId: env.fx.orgA, supplierId: theirs })).toBeNull();
    expect(await env.t.query(internal.suppliers.enrichmentJob.orgNumberFor, { organizationId: env.fx.orgB, supplierId: theirs })).toBe(NO_A);
  });
});
