/**
 * Brreg-beriking mot lokal backend med ekte innloggede brukere og en falsk
 * Brreg-tjeneste på vertsmaskinen (port 38100; test-backenden peker dit via
 * BRREG_ENHET_URL, se scripts/local-convex.mjs). Retry-tidene (30 s, 2 min,
 * 8 min) er for lange til å vente ut her; grensene og stoppen testes med falske
 * klokker i tests/convex/enrichment.test.ts. Her sees det første forsøket, at
 * køen venter i stedet for å hamre, og at alt rundt fortsatt virker.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { enhetBody } from "../helpers/fake-brreg";
import { clientWithToken, errorOf, setupTwoTenants, type TwoTenants } from "../helpers/local-backend";

const FOUND = "920000010";
const MISSING = "920000029";
const RATE_LIMITED = "920000037";
const CONTRACT = "920000045";
const SLOW = "920000053";
const OTHER_TENANT = "920000061";
const DOUBLE = "920000088";

const calls: Record<string, number> = {};
let release: () => void = () => {};
let server: Server;

beforeAll(async () => {
  const gate = new Promise<void>((resolve) => (release = resolve));
  server = createServer(async (req, res) => {
    const orgNumber = req.url?.split("/").pop() ?? "";
    calls[orgNumber] = (calls[orgNumber] ?? 0) + 1;
    res.setHeader("content-type", "application/json");
    if (orgNumber === SLOW) await gate;
    if (orgNumber === RATE_LIMITED) return void res.writeHead(429).end();
    if (orgNumber === CONTRACT) return void res.writeHead(200).end(JSON.stringify({ organisasjonsnummer: orgNumber }));
    if ([FOUND, SLOW, OTHER_TENANT, DOUBLE].includes(orgNumber)) return void res.writeHead(200).end(enhetBody(orgNumber));
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(38100, "0.0.0.0", resolve));
});
afterAll(async () => {
  release();
  await new Promise((resolve) => server.close(resolve));
});

describe("Brreg-beriking mot lokal backend", () => {
  let env: TwoTenants;
  beforeAll(async () => {
    env = await setupTwoTenants();
  });
  const org = () => ({ organizationId: env.fx.orgA });
  const create = (name: string, registryOrgNumber?: string) =>
    env.a.mutation(api.suppliers.mutations.create, { ...org(), name, ...(registryOrgNumber && { registryOrgNumber }) });
  const info = (supplierId: string) => env.a.query(api.suppliers.enrichment.get, { ...org(), supplierId });
  async function until(supplierId: string, states: string[]) {
    for (let i = 0; i < 150; i++) {
      const current = await info(supplierId);
      if (states.includes(current.state)) return current;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Status ble aldri ${states.join("/")}`);
  }
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  test("norsk, ikke funnet og utenlandsk: hver får riktig status, og profilen er urørt", async () => {
    const [found, missing, foreign] = [await create("Funnet AS", FOUND), await create("Finnes ikke AS", MISSING), await create("Foreign Ltd")];
    await env.a.mutation(api.suppliers.enrichment.request, { ...org(), supplierId: found });
    await env.a.mutation(api.suppliers.enrichment.request, { ...org(), supplierId: missing });
    const result = await until(found, ["succeeded", "failed"]);
    expect(result).toMatchObject({ state: "succeeded", gaps: [], profile: { orgNumber: FOUND } });
    expect(result.suggestions.map((s) => s.field)).toEqual(["name", "registeredCountry", "industryCode"]);
    expect(await until(missing, ["not_found"])).toMatchObject({ state: "not_found", profile: null });
    expect(await info(foreign)).toMatchObject({ state: "not_applicable" });
    expect((await errorOf(env.a.mutation(api.suppliers.enrichment.request, { ...org(), supplierId: foreign }))).code).toBe("INVALID_INPUT");
    const detail = await env.a.query(api.suppliers.queries.get, { ...org(), supplierId: found });
    expect(detail.supplier).toMatchObject({ name: "Funnet AS", rowVersion: 1 });
    expect(detail.supplier.registeredCountry).toBeUndefined();
    expect(detail.supplier.industryCode).toBeUndefined();

    const log = await env.a.query(api.audit.queries.list, { ...org(), entityType: "supplier", paginationOpts: { numItems: 30, cursor: null } });
    const types = log.page.filter((e) => e.entityId === found).map((e) => e.eventType);
    expect(types).toEqual(expect.arrayContaining(["supplier.registry_requested", "supplier.registry_fetched"]));
  });

  test("import og redigering virker mens et oppslag pågår, og brukerens endring beholdes", async () => {
    const slow = await create("Treg Leverandør AS", SLOW);
    await env.a.mutation(api.suppliers.enrichment.request, { ...org(), supplierId: slow });
    await until(slow, ["queued"]);
    while ((calls[SLOW] ?? 0) === 0) await wait(50); // oppslaget er underveis og venter på tjenesten
    // Mens det pågår: andre leverandører kan opprettes, og brukeren retter navnet.
    const other = await create("Opprettet Under Henting AS");
    expect(await info(slow)).toMatchObject({ state: "queued" });
    await env.a.mutation(api.suppliers.mutations.update, { ...org(), supplierId: slow, expectedRowVersion: 1, name: "Mitt Navn AS", registryOrgNumber: SLOW, registeredCountry: "SE" });
    release();
    const done = await until(slow, ["succeeded"]);
    expect(done.suggestions).toEqual(expect.arrayContaining([{ field: "registeredCountry", current: "SE", proposed: "NO" }]));
    const detail = await env.a.query(api.suppliers.queries.get, { ...org(), supplierId: slow });
    expect(detail.supplier).toMatchObject({ name: "Mitt Navn AS", registeredCountry: "SE", rowVersion: 2 });
    expect(other).toBeTruthy();
  });

  test("429 gir ventetid i stedet for gjentatte kall, og status er «henter» med feilkode på jobben", async () => {
    const id = await create("Begrenset AS", RATE_LIMITED);
    await env.a.mutation(api.suppliers.enrichment.request, { ...org(), supplierId: id });
    while ((calls[RATE_LIMITED] ?? 0) === 0) await wait(50);
    await wait(2_000);
    expect(calls[RATE_LIMITED]).toBe(1); // neste forsøk er minst 30 sekunder unna
    expect(await info(id)).toMatchObject({ state: "queued" });
    const [job] = (await env.a.query(api.jobs.queries.list, org())).filter((j) => j.type === "brreg.enrich" && j.status !== "succeeded");
    expect(job).toMatchObject({ attempts: 1, maxAttempts: 4, errorCode: "BRREG_RATE_LIMITED" });
  });

  test("kontrakt som ikke stemmer gir «failed» med en gang, uten flere forsøk", async () => {
    const id = await create("Ny Kontrakt AS", CONTRACT);
    await env.a.mutation(api.suppliers.enrichment.request, { ...org(), supplierId: id });
    expect(await until(id, ["failed"])).toMatchObject({ state: "failed", errorCode: "BRREG_CONTRACT_CHANGED" });
    await wait(1_000);
    expect(calls[CONTRACT]).toBe(1);
  });

  test("to faner som ber om samme oppslag samtidig gir én jobb og ett kall", async () => {
    const id = await create("Dobbel AS", DOUBLE);
    const tabs = [env.a, clientWithToken(env.sessionA.token)];
    const before = calls[DOUBLE] ?? 0;
    const [first, second] = await Promise.all(tabs.map((tab) => tab.mutation(api.suppliers.enrichment.request, { ...org(), supplierId: id })));
    expect(second.jobId).toBe(first.jobId);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    await until(id, ["succeeded"]);
    expect(calls[DOUBLE]).toBe(before + 1);
  });

  test("organisasjon B kan ikke be om, lese eller godta for A sin leverandør, og kan ikke omgå via jobbendepunktet", async () => {
    const mine = await create("Min Leverandør AS", OTHER_TENANT);
    const asB = { organizationId: env.fx.orgB };
    for (const attempt of [
      env.b.mutation(api.suppliers.enrichment.request, { ...asB, supplierId: mine }),
      env.b.query(api.suppliers.enrichment.get, { ...asB, supplierId: mine }),
      env.b.mutation(api.suppliers.enrichment.applySuggestion, { ...asB, supplierId: mine, expectedRowVersion: 1, field: "name", expectedValue: "X" }),
    ]) {
      expect((await errorOf(attempt)).code).toBe("NOT_FOUND");
    }
    // Eget org.nr.-oppslag via det generelle endepunktet er stengt for produksjonstyper.
    const generic = env.a.mutation(api.jobs.mutations.enqueue, { ...org(), type: "brreg.enrich", inputRef: mine, idempotencyKey: "omgå" });
    expect((await errorOf(generic)).code).toBe("INVALID_INPUT");
    expect(await info(mine)).toMatchObject({ state: "not_fetched" });
    // B sin liste viser ingenting av A sine leverandører.
    const list = await env.b.query(api.suppliers.queries.list, { ...asB, paginationOpts: { numItems: 50, cursor: null } });
    expect(list.page.map((s) => s.id)).not.toContain(mine);
  });
});
