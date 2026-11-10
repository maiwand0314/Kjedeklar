/**
 * Forhåndsvisning av CSV-import mot lokal backend med ekte innloggede brukere.
 * Viser at parseren kjører i Convex sin kjøretid, at en fil på grensen går
 * gjennom, og at verken matching eller svar krysser organisasjoner.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { MAX_FILE_BYTES, MAX_ROWS } from "../../src/domain/import/limits";
import { errorOf, setupTwoTenants, type TwoTenants } from "../helpers/local-backend";

const { preview } = api.suppliers.import.actions;
const { create } = api.suppliers.mutations;
const fixture = (path: string) => new Uint8Array(readFileSync(path)).buffer;
const TEMPLATE = fixture("public/maler/leverandorer-mal.csv");
const firstPage = { numItems: 50, cursor: null };

describe("forhåndsvisning av CSV mot lokal backend", () => {
  let env: TwoTenants;
  let ownSupplier: string;
  let foreignSuppliers: string[];
  beforeAll(async () => {
    env = await setupTwoTenants();
    const { fx, a, b } = env;
    ownSupplier = await a.mutation(create, { organizationId: fx.orgA, name: "Finnes Hos A AS", registryOrgNumber: "920000002" });
    // B har samme org.nr., leverandør-ID og navn som radene i malen.
    foreignSuppliers = await Promise.all([
      b.mutation(create, { organizationId: fx.orgB, name: "B Sin Tekstil AS", registryOrgNumber: "920000002" }),
      b.mutation(create, { organizationId: fx.orgB, name: "B Sin Rens ANS", externalKey: "L-1002" }),
      b.mutation(create, { organizationId: fx.orgB, name: "Syntetisk Elektronikk Ltd" }),
    ]);
  });

  const state = async (client: TwoTenants["a"], organizationId: string) => ({
    suppliers: await client.query(api.suppliers.queries.list, { organizationId, paginationOpts: firstPage }),
    archived: await client.query(api.suppliers.queries.list, { organizationId, paginationOpts: firstPage, archived: true }),
    audit: await client.query(api.audit.queries.list, { organizationId, paginationOpts: firstPage }),
  });

  test("malen leses i Convex sin kjøretid: BOM, semikolon, norske beløp og eksakte øre", async () => {
    const { fx, a } = env;
    const result = await a.action(preview, { organizationId: fx.orgA, file: TEMPLATE });
    if (result.status !== "ok") throw new Error(result.code);
    expect(result).toMatchObject({ delimiter: ";", problems: [], rowCount: 3, summary: { ready: 3, clarify: 0, error: 0 } });
    expect(result.headers[0]).toBe("Navn"); // ingen BOM foran første overskrift
    expect(result.rows.map((r) => [r.values.name, r.values.registeredCountry, r.values.spendOre])).toEqual([
      ["Syntetisk Tekstil AS", "NO", 125_000_050n],
      ["Syntetisk Rens ANS", "NO", 8_430_000n],
      ["Syntetisk Elektronikk Ltd", "CN", 41_200_000n],
    ]);
    const exact = await a.action(preview, { organizationId: fx.orgA, file: fixture("tests/fixtures/csv/belop.csv") });
    if (exact.status !== "ok") throw new Error(exact.code);
    // 2^53 + 1 øre kommer uendret gjennom Convex og tilbake.
    expect(exact.rows[0].values).toEqual({ name: "Eksakt AS", spendOre: 9_007_199_254_740_993n });
    expect(exact.summary).toEqual({ ready: 6, clarify: 4, error: 3, proposedNew: 13, proposedExisting: 0, proposedUnclear: 0 });
  });

  test("matching foreslås bare mot egne leverandører, og svaret inneholder ingenting fra den andre organisasjonen", async () => {
    const { fx, a, b } = env;
    const forA = await a.action(preview, { organizationId: fx.orgA, file: TEMPLATE });
    if (forA.status !== "ok") throw new Error(forA.code);
    expect(forA.rows.map((r) => r.match)).toEqual([
      { kind: "org_number", suppliers: [{ id: ownSupplier, name: "Finnes Hos A AS", archived: false }] },
      { kind: "new" },
      { kind: "new" },
    ]);
    const serialized = JSON.stringify(forA, (_key, value) => (typeof value === "bigint" ? String(value) : value));
    for (const foreign of [...foreignSuppliers, "B Sin"]) expect(serialized).not.toContain(foreign);

    // Samme fil hos B gir B sine treff: org.nr., leverandør-ID og navn.
    const forB = await b.action(preview, { organizationId: fx.orgB, file: TEMPLATE });
    if (forB.status !== "ok") throw new Error(forB.code);
    expect(forB.rows.map((r) => [r.match.kind, "suppliers" in r.match ? r.match.suppliers.map((s) => s.id) : []])).toEqual([
      ["org_number", [foreignSuppliers[0]]],
      ["external_key", [foreignSuppliers[1]]],
      ["name", [foreignSuppliers[2]]],
    ]);
  });

  test("en fil på grensen (2 000 rader, like under 2 MiB) går gjennom; én byte over avvises", async () => {
    const { fx, a } = env;
    // Lange beskrivelser fyller filen opp mot grensen.
    const padding = "x".repeat(1000);
    const lines = Array.from({ length: MAX_ROWS }, (_, i) => `Grense ${i} AS;${i * 100},50;${padding}`);
    const large = new TextEncoder().encode(`Navn;Beløp;Beskrivelse\n${lines.join("\n")}\n`);
    expect(large.byteLength).toBeGreaterThan(MAX_FILE_BYTES * 0.95);
    expect(large.byteLength).toBeLessThanOrEqual(MAX_FILE_BYTES);
    const result = await a.action(preview, { organizationId: fx.orgA, file: large.buffer });
    if (result.status !== "ok") throw new Error(result.code);
    expect(result.rows).toHaveLength(MAX_ROWS);
    expect(result.rows[MAX_ROWS - 1]).toMatchObject({ rowNumber: MAX_ROWS + 1, values: { name: `Grense ${MAX_ROWS - 1} AS`, spendOre: 19_990_050n } });
    expect(result.summary.ready).toBe(MAX_ROWS);

    const tooLarge = new Uint8Array(MAX_FILE_BYTES + 1).fill(0x41);
    expect(await a.action(preview, { organizationId: fx.orgA, file: tooLarge.buffer })).toMatchObject({ status: "rejected", code: "too_large" });
    const tooMany = new TextEncoder().encode(`Navn\n${Array.from({ length: MAX_ROWS + 1 }, (_, i) => `Rad ${i} AS`).join("\n")}\n`);
    expect(await a.action(preview, { organizationId: fx.orgA, file: tooMany.buffer })).toMatchObject({ status: "rejected", code: "too_many_rows" });
    expect(await a.action(preview, { organizationId: fx.orgA, file: fixture("tests/fixtures/csv/latin1.csv") })).toMatchObject({
      status: "rejected",
      code: "not_utf8",
    });
  });

  test("forhåndsvisning endrer ingenting: leverandører og revisjonslogg er som før", async () => {
    const { fx, a, b } = env;
    const before = { a: await state(a, fx.orgA), b: await state(b, fx.orgB) };
    for (const file of [TEMPLATE, fixture("tests/fixtures/csv/feilfil.csv"), fixture("tests/fixtures/csv/ubetrodd-tekst.csv")]) {
      await a.action(preview, { organizationId: fx.orgA, file });
    }
    expect({ a: await state(a, fx.orgA), b: await state(b, fx.orgB) }).toEqual(before);
    expect(before.a.suppliers.page.map((s) => s.name)).toEqual(["Finnes Hos A AS"]);
  });

  test("fremmed organisasjon og manglende innlogging avvises", async () => {
    const { fx, b, anonymous } = env;
    expect(await errorOf(b.action(preview, { organizationId: fx.orgA, file: TEMPLATE }))).toMatchObject({
      code: "NOT_FOUND",
      data: { code: "NOT_FOUND", message: "Ikke funnet." },
    });
    expect((await errorOf(anonymous.action(preview, { organizationId: fx.orgA, file: TEMPLATE }))).code).toBe("UNAUTHENTICATED");
  });
});
