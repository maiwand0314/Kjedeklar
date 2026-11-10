/**
 * Bekreftet CSV-import mot lokal backend med ekte innloggede brukere: Convex
 * sine transaksjonsgrenser med 2 000 oppføringer, samtidige kall, feil midt i
 * importen, gjentatt fil, endrede valg, konflikt og fremmed organisasjon.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { clientWithToken, errorOf, runInternal, setupTwoTenants, type TwoTenants } from "../helpers/local-backend";
import { SYNTHETIC_PERIOD } from "../helpers/public-functions";

const { prepare } = api.suppliers.import.prepare;
const { list, get, rows, setPolicy, decide, startCommit, commitChunk } = api.suppliers.import.batches;
const suppliersApi = api.suppliers.mutations;
const bytes = (csv: string) => new TextEncoder().encode(csv).buffer;
const page = (numItems = 500) => ({ numItems, cursor: null });
const ORG = ["920000002", "920000010", "920000029"];

describe("CSV-import mot lokal backend", () => {
  let env: TwoTenants;
  let twoTabs: TwoTenants["a"][];
  let periodA: string;
  let periodB: string;
  beforeAll(async () => {
    env = await setupTwoTenants();
    twoTabs = [env.a, clientWithToken(env.sessionA.token)];
    periodA = await env.a.mutation(api.organizations.reportingPeriods.create, { organizationId: env.fx.orgA, ...SYNTHETIC_PERIOD });
    periodB = await env.b.mutation(api.organizations.reportingPeriods.create, { organizationId: env.fx.orgB, ...SYNTHETIC_PERIOD });
  });

  const org = () => ({ organizationId: env.fx.orgA });
  async function prepared(csv: string, extra: Record<string, unknown> = {}) {
    const result = await env.a.action(prepare, { ...org(), file: bytes(csv), fileName: "syntetisk.csv", reportingPeriodId: periodA, ...extra });
    if (result.status !== "ok") throw new Error(result.message);
    return result.batchId as string;
  }
  const batchOf = (batchId: string) => env.a.query(get, { ...org(), batchId });
  const entriesOf = async (batchId: string, numItems = 500) => (await env.a.query(rows, { ...org(), batchId, paginationOpts: page(numItems) })).page;
  /**
   * Gjennomfører til importen er ferdig. Når to faner kjører samtidig, lar Convex
   * bare én transaksjon vinne; den andre får en samtidighetsfeil og prøver på
   * nytt, slik grensesnittet også gjør.
   */
  async function finish(batchId: string, client = env.a) {
    for (let collisions = 0; ; ) {
      try {
        const step = await client.mutation(commitChunk, { ...org(), batchId });
        if (step.done) return { ...step, collisions };
      } catch (error) {
        if (!String(error).includes("OptimisticConcurrencyControlFailure") || ++collisions > 200) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 80));
      }
    }
  }
  const supplierNames = async (search: string) =>
    (await env.a.query(api.suppliers.queries.list, { ...org(), search, paginationOpts: page(2500) })).page.map((s) => s.name);
  const spendOf = async (supplierId: string) =>
    (await env.a.query(api.suppliers.queries.get, { ...org(), supplierId, reportingPeriodId: periodA })).periodData?.spendOre;

  test("2 000 oppføringer: grunnlaget lagres og importen gjennomføres innenfor Convex sine grenser, av to samtidige faner", async () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `Masse ${String(i).padStart(4, "0")} AS;${i + 1}`);
    const batchId = await prepared(`Navn;Beløp\n${lines.join("\n")}\n`);
    expect(await batchOf(batchId)).toMatchObject({ status: "draft", rowCount: 2000, entryCount: 2000, undecided: 0, kindCounts: { new_clean: 2000 } });

    // To samtidige bekreftelser (dobbeltklikk), og to faner som gjennomfører samtidig.
    const confirmed = await Promise.all(twoTabs.map((tab) => errorOf(tab.mutation(startCommit, { ...org(), batchId, expectedRowVersion: 1 }))));
    expect(confirmed.map((c) => c.code)).toEqual(["OK", "OK"]);
    const [first, second] = await Promise.all(twoTabs.map((tab) => finish(batchId, tab)));
    expect(first.result).toEqual({ created: 2000, updated: 0, unchanged: 0, skipped: 0, conflicts: 0 });
    expect(second.result).toEqual(first.result);
    expect(first.processed).toBe(2000);
    expect(await batchOf(batchId)).toMatchObject({ status: "committed", processed: 2000 });

    // Hver oppføring er behandlet nøyaktig én gang: 2 000 leverandører, ingen dubletter.
    const names = await supplierNames("Masse");
    expect(names).toHaveLength(2000);
    expect(new Set(names).size).toBe(2000);
    const sample = (await entriesOf(batchId, 2000)).filter((e) => [2, 1001, 2001].includes(e.rowNumber));
    expect(sample.map((e) => [e.rowNumber, e.outcome, e.supplier?.name])).toEqual([
      [2, "created", "Masse 0000 AS"],
      [1001, "created", "Masse 0999 AS"],
      [2001, "created", "Masse 1999 AS"],
    ]);
    expect(await spendOf(sample[2].supplier!.id)).toBe(200_000n);
    // Bekreftelsen er logget én gang, og hvert stykke én gang.
    const log = await env.a.query(api.audit.queries.list, { ...org(), entityType: "importBatch", paginationOpts: page(100) });
    const events = log.page.filter((e) => e.entityId === batchId).map((e) => e.eventType);
    expect(events.filter((e) => e === "import.confirmed")).toHaveLength(1);
    expect(events.filter((e) => e === "import.applied")).toHaveLength(20);
  }, 120_000);

  test("feil midt i importen: stykket rulles tilbake, importen står som ikke fullført og kan fortsettes", async () => {
    const lines = Array.from({ length: 150 }, (_, i) => `Avbrudd ${String(i).padStart(3, "0")} AS;10`);
    const batchId = await prepared(`Navn;Beløp\n${lines.join("\n")}\n`);
    const broken = (await entriesOf(batchId)).find((e) => e.rowNumber === 131)!;
    await env.a.mutation(startCommit, { ...org(), batchId, expectedRowVersion: 1 });
    expect(await env.a.mutation(commitChunk, { ...org(), batchId })).toMatchObject({ done: false, processed: 100 });

    // Oppføring 130 i andre stykke blir ugyldig etter 29 vellykkede i samme transaksjon.
    runInternal("ops/testing:setImportRowName", { rowId: broken.id, name: "" });
    expect((await errorOf(env.a.mutation(commitChunk, { ...org(), batchId }))).code).toBe("INVALID_INPUT");
    expect(await batchOf(batchId)).toMatchObject({ status: "committing", processed: 100, entryCount: 150, result: { created: 100 } });
    expect(await supplierNames("Avbrudd")).toHaveLength(100);
    expect((await env.a.query(list, org())).find((b) => b.id === batchId)).toMatchObject({ status: "committing", processed: 100 });

    runInternal("ops/testing:setImportRowName", { rowId: broken.id, name: "Avbrudd 129 AS" });
    expect(await finish(batchId)).toMatchObject({ done: true, processed: 150, result: { created: 150, conflicts: 0 } });
    expect(new Set(await supplierNames("Avbrudd")).size).toBe(150);
  });

  test("gjentatt fil og endrede valg: samme utkast gjenbrukes, og ny import av samme fil dobler ikke beløpene", async () => {
    const csv = `Navn;Orgnr;Leverandør-ID;Beløp\nGjentatt Orgnr AS;${ORG[0]};;1.000\nGjentatt ID AS;;G-1;2 000\n`;
    const draft = await prepared(csv);
    // Dobbeltklikk på «Klargjør import»: to samtidige kall gir ett utkast.
    const again = await Promise.all(twoTabs.map((tab) => tab.action(prepare, { ...org(), file: bytes(csv), fileName: "syntetisk.csv", reportingPeriodId: periodA })));
    expect(again.map((r) => (r.status === "ok" ? r.batchId : r.message))).toEqual([draft, draft]);
    // Endret desimaltegn eller kolonnevalg er et annet grunnlag.
    const comma = await prepared(csv, { decimal: "comma" });
    const withoutAmount = await prepared(csv, { mapping: { name: 0, registryOrgNumber: 1, externalKey: 2 } });
    expect(new Set([draft, comma, withoutAmount]).size).toBe(3);
    expect((await entriesOf(draft)).map((e) => e.issues.map((i) => i.code))).toEqual([["amount_ambiguous"], []]);
    expect((await entriesOf(comma)).map((e) => e.values.spendOre)).toEqual([100_000n, 200_000n]);

    await env.a.mutation(startCommit, { ...org(), batchId: comma, expectedRowVersion: 1 });
    expect((await finish(comma)).result).toMatchObject({ created: 2 });
    const [byOrg, byKey] = (await entriesOf(comma)).map((e) => e.supplier!.id);
    expect([await spendOf(byOrg), await spendOf(byKey)]).toEqual([100_000n, 200_000n]);

    // Samme fil og valg en gang til: nytt grunnlag som peker på den første importen, og alt krever valg.
    const repeat = await prepared(csv, { decimal: "comma" });
    expect(repeat).not.toBe(comma);
    expect(await batchOf(repeat)).toMatchObject({ repeatsCommittedAt: expect.any(Number), kindCounts: { known: 2, new_clean: 0 }, undecided: 2 });
    expect((await errorOf(env.a.mutation(startCommit, { ...org(), batchId: repeat, expectedRowVersion: 1 }))).code).toBe("IMPORT_UNDECIDED");
    const { rowVersion } = await env.a.mutation(setPolicy, { ...org(), batchId: repeat, expectedRowVersion: 1, policy: { known: "update" } });
    await env.a.mutation(startCommit, { ...org(), batchId: repeat, expectedRowVersion: rowVersion });
    expect((await finish(repeat)).result).toEqual({ created: 0, updated: 0, unchanged: 2, skipped: 0, conflicts: 0 });
    expect([await spendOf(byOrg), await spendOf(byKey)]).toEqual([100_000n, 200_000n]);
    expect(await supplierNames("Gjentatt")).toHaveLength(2);
  });

  test("leverandør endret etter grunnlaget gir konflikt på oppføringen, ikke overskriving", async () => {
    const supplierId = await env.a.mutation(suppliersApi.create, { ...org(), name: "Konflikt AS", registryOrgNumber: ORG[1] });
    await env.a.mutation(suppliersApi.savePeriod, { ...org(), supplierId, reportingPeriodId: periodA, expectedRowVersion: 0, productionCountries: [], upstreamUnknown: true, spendOre: 500n });
    const batchId = await prepared(`Navn;Orgnr;Beløp\nKonflikt AS;${ORG[1]};9 000\nUberørt AS;;1\n`);
    const { rowVersion } = await env.a.mutation(setPolicy, { ...org(), batchId, expectedRowVersion: 1, policy: { known: "update" } });
    // En annen fane endrer beløpet etter at grunnlaget er laget, men før bekreftelsen.
    await twoTabs[1].mutation(suppliersApi.savePeriod, { ...org(), supplierId, reportingPeriodId: periodA, expectedRowVersion: 1, productionCountries: [], upstreamUnknown: true, spendOre: 777n });
    await env.a.mutation(startCommit, { ...org(), batchId, expectedRowVersion: rowVersion });
    expect((await finish(batchId)).result).toEqual({ created: 1, updated: 0, unchanged: 0, skipped: 0, conflicts: 1 });
    expect(await spendOf(supplierId)).toBe(777n);
    expect((await entriesOf(batchId)).map((e) => [e.rowNumber, e.outcome])).toEqual([
      [2, "conflict"],
      [3, "created"],
    ]);
  });

  test("fremmed batch, periode og leverandør kan ikke importeres, og ingenting lekker", async () => {
    const { fx, a, b, anonymous } = env;
    const foreignSupplier = await b.mutation(suppliersApi.create, { organizationId: fx.orgB, name: "Navnelik AS" });
    const own = await a.mutation(suppliersApi.create, { ...org(), name: "Navnelik AS" });
    const batchId = await prepared("Navn;Beløp\nNAVNELIK A/S;40\n");
    const [entry] = await entriesOf(batchId);
    // Forslaget inneholder bare egen leverandør.
    expect(entry.candidates.map((c) => c.id)).toEqual([own]);
    const pick = (targetSupplierId: string) => errorOf(a.mutation(decide, { ...org(), batchId, rowId: entry.id, expectedRowVersion: 1, decision: "update", targetSupplierId }));
    expect(await pick(foreignSupplier)).toMatchObject({ code: "NOT_FOUND", data: { code: "NOT_FOUND", message: "Ikke funnet." } });

    // A sitt grunnlag for B sin periode, og B mot A sitt grunnlag i begge organisasjoner.
    expect((await errorOf(a.action(prepare, { ...org(), file: bytes("Navn\nA AS\n"), fileName: "a.csv", reportingPeriodId: periodB }))).code).toBe("NOT_FOUND");
    for (const organizationId of [fx.orgB, fx.orgA]) {
      const attempts = [
        () => b.query(get, { organizationId, batchId }),
        () => b.query(rows, { organizationId, batchId, paginationOpts: page() }),
        () => b.mutation(setPolicy, { organizationId, batchId, expectedRowVersion: 1, policy: { unclear: "skip" } }),
        () => b.mutation(decide, { organizationId, batchId, rowId: entry.id, expectedRowVersion: 1, decision: "skip" }),
        () => b.mutation(startCommit, { organizationId, batchId, expectedRowVersion: 1 }),
        () => b.mutation(commitChunk, { organizationId, batchId }),
      ];
      for (const attempt of attempts) expect((await errorOf(attempt())).code).toBe("NOT_FOUND");
    }
    expect(await b.query(list, { organizationId: fx.orgB })).toEqual([]);
    expect((await errorOf(anonymous.mutation(commitChunk, { ...org(), batchId }))).code).toBe("UNAUTHENTICATED");
    expect(await batchOf(batchId)).toMatchObject({ status: "draft", rowVersion: 1, undecided: 1 });
    expect(await spendOf(own)).toBeUndefined();
  });
});
