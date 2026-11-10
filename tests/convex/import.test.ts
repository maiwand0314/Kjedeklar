/** Bekreftet CSV-import: grunnlag uten råfil, valg, bekreftelse, stykkevis gjennomføring, konflikter og idempotens. */
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { SYNTHETIC_PERIOD } from "../helpers/public-functions";
import { expectAppError, setupTest, twoTenants, type TestConvex } from "./setup";

const { prepare } = api.suppliers.import.prepare;
const { list, get, rows, setPolicy, decide, startCommit, commitChunk } = api.suppliers.import.batches;
const suppliersApi = api.suppliers.mutations;

type Fixture = Awaited<ReturnType<typeof twoTenants>>;
const asA = (t: TestConvex, fx: Fixture) => t.withIdentity(fx.userA.identity);
const asB = (t: TestConvex, fx: Fixture) => t.withIdentity(fx.userB.identity);
const bytes = (csv: string) => new TextEncoder().encode(csv).buffer;
const all = <T extends keyof typeof schema.tables>(t: TestConvex, table: T) => t.run((ctx) => ctx.db.query(table).collect());
const firstPage = { numItems: 500, cursor: null };

/** Gyldige syntetiske org.nr. (mod 11). */
const ORG = ["920000002", "920000010", "920000029", "920000037"];

async function start() {
  const t = setupTest();
  const fx = await twoTenants(t);
  const [periodA, periodB] = await t.run((ctx) =>
    Promise.all(
      [fx.orgA, fx.orgB].map((organizationId) =>
        ctx.db.insert("reportingPeriods", { organizationId, ...SYNTHETIC_PERIOD, status: "open", createdAt: Date.now(), createdBy: "oppsett" }),
      ),
    ),
  );
  return { t, fx, periodA, periodB };
}
type Env = Awaited<ReturnType<typeof start>>;

async function prepared(env: Env, csv: string, extra: Record<string, unknown> = {}) {
  const result = await asA(env.t, env.fx).action(prepare, {
    organizationId: env.fx.orgA,
    file: bytes(csv),
    fileName: "syntetisk.csv",
    reportingPeriodId: env.periodA,
    ...extra,
  });
  if (result.status !== "ok") throw new Error(`Avvist: ${result.message}`);
  return result.batchId;
}
const batchOf = (env: Env, batchId: string) => asA(env.t, env.fx).query(get, { organizationId: env.fx.orgA, batchId });
const entriesOf = async (env: Env, batchId: string) =>
  (await asA(env.t, env.fx).query(rows, { organizationId: env.fx.orgA, batchId, paginationOpts: firstPage })).page;

/** Bekrefter og gjennomfører til importen er ferdig. Gir antall kall til commitChunk. */
async function commit(env: Env, batchId: string) {
  const { rowVersion } = await batchOf(env, batchId);
  await asA(env.t, env.fx).mutation(startCommit, { organizationId: env.fx.orgA, batchId, expectedRowVersion: rowVersion });
  for (let calls = 1; ; calls++) {
    const step = await asA(env.t, env.fx).mutation(commitChunk, { organizationId: env.fx.orgA, batchId });
    if (step.done) return { calls, ...step };
  }
}
const spendOf = async (env: Env, supplierId: string) =>
  (await all(env.t, "supplierPeriods")).find((p) => p.supplierId === supplierId && p.reportingPeriodId === env.periodA)?.spendOre;

describe("importgrunnlag", () => {
  test("lagrer normaliserte oppføringer og aldri råfilen", async () => {
    const env = await start();
    // «Merknad» er ikke valgt som kolonne, og org.nr. står med mellomrom i filen.
    const csv = "Navn;Organisasjonsnummer;Beløp;Merknad\nSyntetisk Tekstil AS;920 000 002;1 250,50;RAATEKST-MARKOR\n";
    const batchId = await prepared(env, csv);

    const [batch] = await all(env.t, "importBatches");
    expect(batch).toMatchObject({
      _id: batchId,
      organizationId: env.fx.orgA,
      reportingPeriodId: env.periodA,
      status: "draft",
      mappingVersion: "csv-import-v1",
      fileName: "syntetisk.csv",
      rowCount: 1,
      entryCount: 1,
      kindCounts: { new_clean: 1, new_warning: 0, known: 0, unclear: 0, error: 0 },
      createdBy: env.fx.userA.userId,
    });
    expect(batch.fileHash).toMatch(/^[0-9a-f]{64}$/);
    expect(batch.idempotencyKey).toBe(`${env.periodA}:${batch.normalizedHash}`);
    expect(batch.expiresAt - batch.createdAt).toBe(24 * 60 * 60 * 1000);
    expect(await all(env.t, "importRows")).toMatchObject([
      { batchId, rowNumber: 2, values: { name: "Syntetisk Tekstil AS", registryOrgNumber: "920000002", spendOre: 125_050n }, kind: "new_clean" },
    ]);

    const stored = JSON.stringify(
      await env.t.run(async (ctx) => [
        await Promise.all(Object.keys(schema.tables).map((table) => ctx.db.query(table as "importRows").collect())),
        await ctx.db.system.query("_storage").collect(),
      ]),
      (_key, value) => (typeof value === "bigint" ? String(value) : value),
    );
    for (const raw of ["RAATEKST-MARKOR", "920 000 002", "1 250,50", "Merknad"]) expect(stored, raw).not.toContain(raw);
    expect(await env.t.run((ctx) => ctx.db.system.query("_storage").collect())).toEqual([]);
    // Ingen leverandørdata er endret av grunnlaget, og opprettelsen er logget.
    expect(await all(env.t, "suppliers")).toEqual([]);
    expect((await all(env.t, "auditEvents")).map((e) => [e.eventType, e.entityId, e.safeDiff])).toEqual([
      ["import.created", batchId, { status: { to: "draft" }, rowCount: { to: 1 }, entryCount: { to: 1 } }],
    ]);
  });

  test("samme fil, valg og periode gir samme grunnlag; endret valg eller periode gir et nytt", async () => {
    const env = await start();
    const csv = "Navn;Beløp\nA AS;1.234\nB AS;50\n";
    const first = await prepared(env, csv);
    expect(await prepared(env, csv)).toBe(first);
    expect(await all(env.t, "importRows")).toHaveLength(2);

    const otherDecimal = await prepared(env, csv, { decimal: "comma" });
    const otherMapping = await prepared(env, csv, { mapping: { name: 0 } });
    const secondPeriod = await env.t.run((ctx) =>
      ctx.db.insert("reportingPeriods", { organizationId: env.fx.orgA, startDate: "2026-01-01", endDate: "2026-12-31", publicationDueDate: "2027-06-30", status: "open", createdAt: Date.now(), createdBy: "oppsett" }),
    );
    const otherPeriod = await prepared(env, csv, { reportingPeriodId: secondPeriod });
    expect(new Set([first, otherDecimal, otherMapping, otherPeriod]).size).toBe(4);
    expect((await asA(env.t, env.fx).query(list, { organizationId: env.fx.orgA })).map((b) => b.id)).toEqual([otherPeriod, otherMapping, otherDecimal, first]);
  });

  test("avvist fil, manglende navnekolonne og fremmed eller ugyldig periode gir ikke noe grunnlag", async () => {
    const env = await start();
    const call = (extra: Record<string, unknown>) =>
      asA(env.t, env.fx).action(prepare, { organizationId: env.fx.orgA, file: bytes("Navn\nA AS\n"), fileName: "a.csv", reportingPeriodId: env.periodA, ...extra });
    expect(await call({ file: bytes("") })).toMatchObject({ status: "rejected", message: "Filen er tom." });
    expect(await call({ file: bytes("Kolonne\nA AS\n") })).toMatchObject({ status: "rejected", message: expect.stringMatching(/navnet/) });
    for (const reportingPeriodId of [env.periodB, "ikke-en-id", env.fx.orgA]) await expectAppError(call({ reportingPeriodId }), "NOT_FOUND");
    await expectAppError(asB(env.t, env.fx).action(prepare, { organizationId: env.fx.orgA, file: bytes("Navn\nA AS\n"), fileName: "a.csv", reportingPeriodId: env.periodA }), "NOT_FOUND");
    expect(await all(env.t, "importBatches")).toEqual([]);
    expect(await all(env.t, "importRows")).toEqual([]);
  });
});

/** En fil med én oppføring av hver type, og leverandørene den treffer. */
async function mixed() {
  const env = await start();
  const a = asA(env.t, env.fx);
  const create = (profile: { name: string; registryOrgNumber?: string; externalKey?: string }) =>
    a.mutation(suppliersApi.create, { organizationId: env.fx.orgA, ...profile });
  const ids = {
    byOrg: await create({ name: "Kjent På Orgnr AS", registryOrgNumber: ORG[0] }),
    byKey: await create({ name: "Kjent På ID AS", externalKey: "L-2" }),
    byName: await create({ name: "Navnetreff AS" }),
    other: await create({ name: "Uvedkommende AS" }),
    foreign: await asB(env.t, env.fx).mutation(suppliersApi.create, { organizationId: env.fx.orgB, name: "Navnetreff AS" }),
  };
  await a.mutation(suppliersApi.savePeriod, { organizationId: env.fx.orgA, supplierId: ids.byOrg, reportingPeriodId: env.periodA, expectedRowVersion: 0, productionCountries: ["VN"], upstreamUnknown: false, spendOre: 100_000n, purchaseCategory: "Gammel kategori" });
  const csv = [
    "Navn;Orgnr;Leverandør-ID;Land;Beløp;Kategori",
    "Helt Ny AS;;;Norge;500;Kontor", // 2 ny
    "Ny Med Avklaring AS;;;Kinna;700;", // 3 ny med avklaring
    `Filnavn For Kjent AS;${ORG[0]};;;2 000,50;Arbeidstøy`, // 4 kjent på org.nr.
    "Kjent På ID AS;;L-2;;;", // 5 kjent på ID, uten beløp
    "NAVNETREFF A/S;;;;300;", // 6 navnetreff
    `Summert AS;${ORG[1]};;;100;`, // 7 + 8 slås sammen
    `Summert AS;${ORG[1]};;;250,25;`,
    ";;;;900;", // 9 feil: navn mangler
  ].join("\n");
  const batchId = await prepared(env, `${csv}\n`);
  return { env, a, ids, batchId, target: { organizationId: env.fx.orgA, batchId } };
}

describe("valg før import", () => {
  test("hver oppføring får type, forslag og tillatte valg; uten valg kan ikke importen bekreftes", async () => {
    const { env, a, ids, batchId, target } = await mixed();
    expect((await entriesOf(env, batchId)).map((e) => [e.rowNumber, e.kind, e.matchKind, e.candidates.map((c) => c.id), e.decision])).toEqual([
      [2, "new_clean", "new", [], "create"],
      [3, "new_warning", "new", [], undefined],
      [4, "known", "org_number", [ids.byOrg], undefined],
      [5, "known", "external_key", [ids.byKey], undefined],
      [6, "unclear", "name", [ids.byName], undefined],
      [7, "new_warning", "new", [], undefined],
      [9, "error", "none", [], undefined],
    ]);
    const batch = await batchOf(env, batchId);
    expect(batch).toMatchObject({ status: "draft", expired: false, rowCount: 8, entryCount: 7, undecided: 6, rowVersion: 1 });
    expect(batch.kindCounts).toEqual({ new_clean: 1, new_warning: 2, known: 2, unclear: 1, error: 1 });
    await expectAppError(a.mutation(startCommit, { ...target, expectedRowVersion: 1 }), "IMPORT_UNDECIDED");

    // Fellesvalg dekker én type om gangen; importen kan først bekreftes når alt er avklart.
    let { rowVersion } = await a.mutation(setPolicy, { ...target, expectedRowVersion: 1, policy: { known: "update", new_warning: "create", error: "skip" } });
    expect((await batchOf(env, batchId)).undecided).toBe(1);
    await expectAppError(a.mutation(startCommit, { ...target, expectedRowVersion: rowVersion }), "IMPORT_UNDECIDED");
    const unclear = (await entriesOf(env, batchId)).find((e) => e.kind === "unclear")!;
    ({ rowVersion } = await a.mutation(decide, { ...target, rowId: unclear.id, expectedRowVersion: rowVersion, decision: "update", targetSupplierId: ids.byName }));
    expect(await batchOf(env, batchId)).toMatchObject({ undecided: 0, rowVersion: 3 });
    expect((await entriesOf(env, batchId)).map((e) => [e.rowNumber, e.decision, e.ownDecision])).toEqual([
      [2, "create", false],
      [3, "create", false],
      [4, "update", false],
      [5, "update", false],
      [6, "update", true],
      [7, "create", false],
      [9, "skip", false],
    ]);
    // Valgene alene har ikke endret noen leverandør.
    expect(await all(env.t, "suppliers")).toHaveLength(5);
  });

  test("ugyldige valg avvises: feil type, leverandør utenfor forslagene, fremmed leverandør og oppføring fra annet grunnlag", async () => {
    const { env, a, ids, batchId, target } = await mixed();
    const entries = await entriesOf(env, batchId);
    const row = (kind: string, n = 0) => entries.filter((e) => e.kind === kind)[n].id;
    const attempt = (rowId: string, decision: "create" | "update" | "skip", targetSupplierId?: string) =>
      a.mutation(decide, { ...target, rowId, expectedRowVersion: 1, decision, targetSupplierId });

    await expectAppError(attempt(row("error"), "create"), "INVALID_INPUT"); // feilrader kan bare utelates
    await expectAppError(attempt(row("known"), "create"), "INVALID_INPUT"); // ville blitt en dublett
    await expectAppError(attempt(row("new_warning"), "update"), "INVALID_INPUT");
    await expectAppError(attempt(row("unclear"), "update"), "INVALID_INPUT"); // mangler leverandør
    await expectAppError(attempt(row("unclear"), "update", ids.other), "INVALID_INPUT"); // egen, men ikke foreslått
    await expectAppError(attempt(row("known"), "update", ids.byKey), "INVALID_INPUT"); // annen kjent leverandør
    for (const foreign of [ids.foreign, "ikke-en-id", env.fx.orgA]) await expectAppError(attempt(row("unclear"), "update", foreign), "NOT_FOUND");

    const otherBatch = await prepared(env, "Navn\nAnnet Grunnlag AS\n");
    const [otherRow] = await entriesOf(env, otherBatch);
    await expectAppError(attempt(otherRow.id, "skip"), "NOT_FOUND");
    await expectAppError(attempt("ikke-en-id", "skip"), "NOT_FOUND");
    // Utdatert versjon, og en annen organisasjon.
    await expectAppError(a.mutation(decide, { ...target, rowId: row("known"), expectedRowVersion: 7, decision: "skip" }), "CONFLICT");
    await expectAppError(a.mutation(setPolicy, { ...target, expectedRowVersion: 7, policy: {} }), "CONFLICT");
    for (const organizationId of [env.fx.orgB, env.fx.orgA]) {
      const b = asB(env.t, env.fx);
      await expectAppError(b.mutation(decide, { organizationId, batchId, rowId: row("known"), expectedRowVersion: 1, decision: "skip" }), "NOT_FOUND");
      await expectAppError(b.mutation(setPolicy, { organizationId, batchId, expectedRowVersion: 1, policy: { known: "skip" } }), "NOT_FOUND");
      await expectAppError(b.query(get, { organizationId, batchId }), "NOT_FOUND");
      await expectAppError(b.query(rows, { organizationId, batchId, paginationOpts: firstPage }), "NOT_FOUND");
      await expectAppError(b.mutation(startCommit, { organizationId, batchId, expectedRowVersion: 1 }), "NOT_FOUND");
      await expectAppError(b.mutation(commitChunk, { organizationId, batchId }), "NOT_FOUND");
    }
    expect((await entriesOf(env, batchId)).every((e) => !e.ownDecision)).toBe(true);
    expect((await batchOf(env, batchId)).rowVersion).toBe(1);

    // Et valg kan angres: oppføringen blir uavklart igjen.
    const { rowVersion } = await attempt(row("known"), "skip");
    await a.mutation(decide, { ...target, rowId: row("known"), expectedRowVersion: rowVersion, decision: null });
    const cleared = (await entriesOf(env, batchId)).find((e) => e.id === row("known"))!;
    expect([cleared.decision, cleared.ownDecision]).toEqual([undefined, false]);
  });
});

describe("bekreftelse og gjennomføring", () => {
  async function decided() {
    const m = await mixed();
    let { rowVersion } = await m.a.mutation(setPolicy, { ...m.target, expectedRowVersion: 1, policy: { known: "update", new_warning: "create", error: "skip" } });
    const unclear = (await entriesOf(m.env, m.batchId)).find((e) => e.kind === "unclear")!;
    ({ rowVersion } = await m.a.mutation(decide, { ...m.target, rowId: unclear.id, expectedRowVersion: rowVersion, decision: "update", targetSupplierId: m.ids.byName }));
    return { ...m, rowVersion };
  }

  test("oppretter, oppdaterer og utelater etter valgene; beløp erstattes, summeres ikke, og profilen røres ikke", async () => {
    const { env, ids, batchId } = await decided();
    const done = await commit(env, batchId);
    expect(done).toMatchObject({ calls: 1, done: true, processed: 7, entryCount: 7, result: { created: 3, updated: 2, unchanged: 1, skipped: 1, conflicts: 0 } });

    const suppliers = await all(env.t, "suppliers");
    const byName = (name: string) => suppliers.find((s) => s.name === name && s.organizationId === env.fx.orgA)!;
    expect(suppliers.filter((s) => s.organizationId === env.fx.orgA).map((s) => s.name).sort()).toEqual(
      ["Helt Ny AS", "Kjent På ID AS", "Kjent På Orgnr AS", "Navnetreff AS", "Ny Med Avklaring AS", "Summert AS", "Uvedkommende AS"].sort(),
    );
    // Ny leverandør: profil fra filen, ukjent land forblir ukjent, og innkjøp for perioden.
    expect(byName("Helt Ny AS")).toMatchObject({ registeredCountry: "NO", status: "active", rowVersion: 1, createdBy: env.fx.userA.userId });
    expect(byName("Ny Med Avklaring AS")).not.toHaveProperty("registeredCountry");
    expect(byName("Summert AS")).toMatchObject({ registryOrgNumber: ORG[1] });
    expect(await spendOf(env, byName("Summert AS")._id)).toBe(35_025n); // 100 + 250,25
    expect(await spendOf(env, byName("Helt Ny AS")._id)).toBe(50_000n);

    // Kjent leverandør: beløpet er erstattet (ikke lagt til 1 000 kr), kategorien fra filen, resten bevart.
    const periods = await all(env.t, "supplierPeriods");
    expect(periods.find((p) => p.supplierId === ids.byOrg)).toMatchObject({ spendOre: 200_050n, purchaseCategory: "Arbeidstøy", productionCountries: ["VN"], upstreamUnknown: false, rowVersion: 2 });
    // Navnet i filen overskriver ikke leverandørens navn, og profilversjonen er uendret.
    expect(byName("Kjent På Orgnr AS")).toMatchObject({ _id: ids.byOrg, rowVersion: 1 });
    expect(suppliers.some((s) => s.name === "Filnavn For Kjent AS")).toBe(false);
    // Uten beløp i filen er det ingenting å oppdatere, og navnetreffet er oppdatert på valgt leverandør.
    expect(periods.find((p) => p.supplierId === ids.byKey)).toBeUndefined();
    expect(periods.find((p) => p.supplierId === ids.byName)).toMatchObject({ spendOre: 30_000n, productionCountries: [], upstreamUnknown: true, rowVersion: 1 });

    expect((await entriesOf(env, batchId)).map((e) => [e.rowNumber, e.outcome, e.supplier?.name, e.previousSpendOre])).toEqual([
      [2, "created", "Helt Ny AS", undefined],
      [3, "created", "Ny Med Avklaring AS", undefined],
      [4, "updated", "Kjent På Orgnr AS", 100_000n],
      [5, "unchanged", "Kjent På ID AS", undefined],
      [6, "updated", "Navnetreff AS", undefined],
      [7, "created", "Summert AS", undefined],
      [9, "skipped", undefined, undefined],
    ]);
    expect(await batchOf(env, batchId)).toMatchObject({ status: "committed", processed: 7, committedAt: expect.any(Number) });

    // Revisjonslogg per batch: opprettet, bekreftet med fellesvalgene, og gjennomført med antall.
    const events = (await all(env.t, "auditEvents")).filter((e) => e.entityType === "importBatch");
    expect(events.map((e) => [e.eventType, e.entityId, e.actorId])).toEqual([
      ["import.created", batchId, env.fx.userA.userId],
      ["import.confirmed", batchId, env.fx.userA.userId],
      ["import.applied", batchId, env.fx.userA.userId],
    ]);
    expect(events[1].safeDiff).toEqual({
      status: { from: "draft", to: "committing" },
      entryCount: { to: 7 },
      policyKnown: { to: "update" },
      policyNewWarning: { to: "create" },
      policyError: { to: "skip" },
    });
    expect(events[2].safeDiff).toEqual({
      status: { from: "committing", to: "committed" },
      processed: { from: 0, to: 7 },
      created: { from: 0, to: 3 },
      updated: { from: 0, to: 2 },
      unchanged: { from: 0, to: 1 },
      skipped: { from: 0, to: 1 },
    });
    expect(JSON.stringify(events)).not.toMatch(/Helt Ny|Summert|Navnetreff/);
  });

  test("dobbeltklikk og nye forsøk: bekreftelse og gjennomføring kan gjentas uten ny virkning", async () => {
    const { env, a, batchId, target, rowVersion } = await decided();
    const first = await a.mutation(startCommit, { ...target, expectedRowVersion: rowVersion });
    // Samme klikk en gang til, også med en utdatert versjon.
    expect(await a.mutation(startCommit, { ...target, expectedRowVersion: 1 })).toEqual(first);
    const done = await a.mutation(commitChunk, target);
    const snapshot = { suppliers: await all(env.t, "suppliers"), periods: await all(env.t, "supplierPeriods"), audit: await all(env.t, "auditEvents") };
    expect(await a.mutation(commitChunk, target)).toEqual(done);
    expect(await a.mutation(startCommit, { ...target, expectedRowVersion: rowVersion })).toEqual({ status: "committed" });
    expect({ suppliers: await all(env.t, "suppliers"), periods: await all(env.t, "supplierPeriods"), audit: await all(env.t, "auditEvents") }).toEqual(snapshot);
    // Etter bekreftelsen er valgene frosset.
    await expectAppError(a.mutation(setPolicy, { ...target, expectedRowVersion: rowVersion, policy: {} }), "CONFLICT");
    expect((await batchOf(env, batchId)).status).toBe("committed");
  });

  test("identisk fil for samme periode en gang til gir ingen nye leverandører og ikke dobbelt beløp", async () => {
    const env = await start();
    const a = asA(env.t, env.fx);
    const csv = `Navn;Orgnr;Leverandør-ID;Beløp\nMed Orgnr AS;${ORG[0]};;1 000\nMed ID AS;;L-7;2 000\nBare Navn AS;;;3 000\n`;
    const first = await prepared(env, csv);
    await commit(env, first);
    const before = { suppliers: await all(env.t, "suppliers"), periods: await all(env.t, "supplierPeriods") };
    expect(before.suppliers).toHaveLength(3);

    // Ny opplasting av samme fil: et nytt grunnlag som sier at innholdet er importert før.
    const second = await prepared(env, csv);
    expect(second).not.toBe(first);
    expect(await batchOf(env, second)).toMatchObject({ repeatsCommittedAt: expect.any(Number), kindCounts: { new_clean: 0, new_warning: 0, known: 2, unclear: 1, error: 0 }, undecided: 3 });
    // Ingenting skjer uten uttrykkelige valg.
    await expectAppError(a.mutation(startCommit, { organizationId: env.fx.orgA, batchId: second, expectedRowVersion: 1 }), "IMPORT_UNDECIDED");
    let { rowVersion } = await a.mutation(setPolicy, { organizationId: env.fx.orgA, batchId: second, expectedRowVersion: 1, policy: { known: "update" } });
    const unclear = (await entriesOf(env, second)).find((e) => e.kind === "unclear")!;
    ({ rowVersion } = await a.mutation(decide, { organizationId: env.fx.orgA, batchId: second, rowId: unclear.id, expectedRowVersion: rowVersion, decision: "update", targetSupplierId: unclear.candidates[0].id }));
    const done = await commit(env, second);
    expect(done.result).toEqual({ created: 0, updated: 0, unchanged: 3, skipped: 0, conflicts: 0 });
    expect({ suppliers: await all(env.t, "suppliers"), periods: await all(env.t, "supplierPeriods") }).toEqual(before);
  });

  test("utløpt grunnlag og grunnlag fra en eldre versjon kan ikke bekreftes eller endres", async () => {
    const env = await start();
    const a = asA(env.t, env.fx);
    const batchId = await prepared(env, "Navn\nA AS\n");
    const target = { organizationId: env.fx.orgA, batchId: batchId as string };
    const patch = (fields: Record<string, unknown>) => env.t.run((ctx) => ctx.db.patch("importBatches", batchId as Id<"importBatches">, fields));

    await patch({ expiresAt: Date.now() - 1 });
    await expectAppError(a.mutation(startCommit, { ...target, expectedRowVersion: 1 }), "IMPORT_EXPIRED");
    await expectAppError(a.mutation(setPolicy, { ...target, expectedRowVersion: 1, policy: {} }), "IMPORT_EXPIRED");
    expect(await batchOf(env, batchId)).toMatchObject({ status: "draft", expired: true });
    // Samme fil på nytt gir et ferskt grunnlag, ikke det utløpte.
    expect(await prepared(env, "Navn\nA AS\n")).not.toBe(batchId);

    await patch({ expiresAt: Date.now() + 60_000, mappingVersion: "csv-import-v0" });
    await expectAppError(a.mutation(startCommit, { ...target, expectedRowVersion: 1 }), "IMPORT_EXPIRED");
    await expectAppError(a.mutation(commitChunk, target), "CONFLICT"); // ikke bekreftet
    expect(await all(env.t, "suppliers")).toEqual([]);
  });

  test("endret leverandør eller endret beløp etter grunnlaget gir konflikt på oppføringen, og resten gjennomføres", async () => {
    const { env, a, ids, batchId } = await decided();
    // Etter at grunnlaget ble laget: profilen til én leverandør endres, beløpet til en annen, og en ny får samme org.nr. som en rad.
    await a.mutation(suppliersApi.update, { organizationId: env.fx.orgA, supplierId: ids.byName, expectedRowVersion: 1, name: "Navnetreff Nytt Navn AS" });
    await a.mutation(suppliersApi.savePeriod, { organizationId: env.fx.orgA, supplierId: ids.byOrg, reportingPeriodId: env.periodA, expectedRowVersion: 1, productionCountries: ["VN"], upstreamUnknown: false, spendOre: 999n });
    const racing = await a.mutation(suppliersApi.create, { organizationId: env.fx.orgA, name: "Kom Først AS", registryOrgNumber: ORG[1] });

    const done = await commit(env, batchId);
    expect(done.result).toEqual({ created: 2, updated: 0, unchanged: 1, skipped: 1, conflicts: 3 });
    expect((await entriesOf(env, batchId)).filter((e) => e.outcome === "conflict").map((e) => [e.rowNumber, e.supplier?.id])).toEqual([
      [4, ids.byOrg],
      [6, ids.byName],
      [7, undefined],
    ]);
    // Det som ble endret i mellomtiden, står urørt.
    expect(await spendOf(env, ids.byOrg)).toBe(999n);
    expect(await spendOf(env, ids.byName)).toBeUndefined();
    expect(await spendOf(env, racing)).toBeUndefined();
    expect((await all(env.t, "suppliers")).filter((s) => s.registryOrgNumber === ORG[1])).toHaveLength(1);
  });

  test("to oppføringer mot samme leverandør: den første oppdaterer, den andre får konflikt", async () => {
    const env = await start();
    const a = asA(env.t, env.fx);
    const supplierId = await a.mutation(suppliersApi.create, { organizationId: env.fx.orgA, name: "Felles AS" });
    const batchId = await prepared(env, "Navn;Beløp\nFelles AS;100\nFELLES A/S;200\n");
    let rowVersion = 1;
    for (const entry of await entriesOf(env, batchId)) {
      ({ rowVersion } = await a.mutation(decide, { organizationId: env.fx.orgA, batchId, rowId: entry.id, expectedRowVersion: rowVersion, decision: "update", targetSupplierId: supplierId }));
    }
    expect((await commit(env, batchId)).result).toMatchObject({ updated: 1, conflicts: 1 });
    expect(await spendOf(env, supplierId)).toBe(10_000n);
  });

  test("stor import går i stykker på 100; et avbrudd står som ikke fullført og kan fortsettes", async () => {
    const env = await start();
    const a = asA(env.t, env.fx);
    const lines = Array.from({ length: 250 }, (_, i) => `Stor ${String(i).padStart(3, "0")} AS;${i + 1}`);
    const batchId = await prepared(env, `Navn;Beløp\n${lines.join("\n")}\n`);
    const target = { organizationId: env.fx.orgA, batchId };
    await a.mutation(startCommit, { ...target, expectedRowVersion: 1 });

    expect(await a.mutation(commitChunk, target)).toMatchObject({ done: false, processed: 100, entryCount: 250, result: { created: 100 } });
    // «Avbrudd»: ingen flere kall. Importen vises som ikke fullført, med det som er gjort.
    expect(await batchOf(env, batchId)).toMatchObject({ status: "committing", processed: 100, entryCount: 250 });
    expect((await asA(env.t, env.fx).query(list, { organizationId: env.fx.orgA }))[0]).toMatchObject({ id: batchId, status: "committing", processed: 100 });
    expect(await all(env.t, "suppliers")).toHaveLength(100);
    expect((await entriesOf(env, batchId)).filter((e) => e.outcome).length).toBe(100);

    expect(await a.mutation(commitChunk, target)).toMatchObject({ done: false, processed: 200 });
    expect(await a.mutation(commitChunk, target)).toMatchObject({ done: true, processed: 250, result: { created: 250, updated: 0, unchanged: 0, skipped: 0, conflicts: 0 } });
    expect(await all(env.t, "suppliers")).toHaveLength(250);
    expect((await all(env.t, "supplierPeriods")).reduce((sum, p) => sum + (p.spendOre ?? 0n), 0n)).toBe(BigInt((250 * 251) / 2) * 100n);
    expect((await all(env.t, "auditEvents")).filter((e) => e.eventType === "import.applied").map((e) => e.safeDiff.processed)).toEqual([
      { from: 0, to: 100 },
      { from: 100, to: 200 },
      { from: 200, to: 250 },
    ]);
  });
});

describe("leverandør-ID er unik per organisasjon", () => {
  test("samme ID avvises i samme organisasjon, også ved endring, men er tillatt i en annen", async () => {
    const env = await start();
    const a = asA(env.t, env.fx);
    const first = await a.mutation(suppliersApi.create, { organizationId: env.fx.orgA, name: "Første AS", externalKey: "L-1" });
    await asB(env.t, env.fx).mutation(suppliersApi.create, { organizationId: env.fx.orgB, name: "Hos B AS", externalKey: "L-1" });
    await expectAppError(a.mutation(suppliersApi.create, { organizationId: env.fx.orgA, name: "Kopi AS", externalKey: " L-1 " }), "SUPPLIER_KEY_EXISTS");
    const second = await a.mutation(suppliersApi.create, { organizationId: env.fx.orgA, name: "Andre AS", externalKey: "L-2" });
    await expectAppError(a.mutation(suppliersApi.update, { organizationId: env.fx.orgA, supplierId: second, expectedRowVersion: 1, name: "Andre AS", externalKey: "L-1" }), "SUPPLIER_KEY_EXISTS");
    // Leverandøren kan beholde sin egen ID.
    expect(await a.mutation(suppliersApi.update, { organizationId: env.fx.orgA, supplierId: first, expectedRowVersion: 1, name: "Første Nytt Navn AS", externalKey: "L-1" })).toEqual({ rowVersion: 2 });
  });
});
