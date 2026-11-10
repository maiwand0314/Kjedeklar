/** Forhåndsvisning av CSV-import: servergrenser, matching bare mot egne leverandører, og at ingenting lagres. */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { MAX_FILE_BYTES, MAX_ROWS } from "../../src/domain/import/limits";
import { SYNTHETIC_SUPPLIER_DOC } from "../helpers/public-functions";
import { expectAppError, setupTest, twoTenants, type TestConvex } from "./setup";

const { preview } = api.suppliers.import.actions;
const fixture = (path: string) => new Uint8Array(readFileSync(path)).buffer;
const TEMPLATE = fixture("public/maler/leverandorer-mal.csv");
const text = (csv: string) => new TextEncoder().encode(csv).buffer;

type Fixture = Awaited<ReturnType<typeof twoTenants>>;
const asA = (t: TestConvex, fx: Fixture) => t.withIdentity(fx.userA.identity);

async function start() {
  const t = setupTest();
  const fx = await twoTenants(t);
  return { t, fx };
}

const supplier = (organizationId: Fixture["orgA"], name: string, extra: Record<string, string> = {}) => ({
  organizationId,
  ...SYNTHETIC_SUPPLIER_DOC,
  name,
  nameKey: name.toLowerCase(),
  ...extra,
  createdAt: Date.now(),
  createdBy: "oppsett",
});

/** Alt som er lagret: hver tabell i skjemaet, fillagringen og planlagte funksjoner. */
const everything = (t: TestConvex) =>
  t.run(async (ctx) => ({
    tables: Object.fromEntries(
      await Promise.all(Object.keys(schema.tables).map(async (table) => [table, await ctx.db.query(table as "suppliers").collect()] as const)),
    ),
    storage: await ctx.db.system.query("_storage").collect(),
    scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
  }));

async function ok(t: TestConvex, fx: Fixture, args: Record<string, unknown>) {
  const result = await asA(t, fx).action(preview, { organizationId: fx.orgA, file: TEMPLATE, ...args });
  if (result.status !== "ok") throw new Error(`Avvist: ${result.code}`);
  return result;
}

describe("forhåndsvisning av CSV", () => {
  test("malen gir normaliserte rader, foreslått kolonnevalg og oppsummering", async () => {
    const { t, fx } = await start();
    const result = await ok(t, fx, {});
    expect(result).toMatchObject({
      delimiter: ";",
      headers: ["Navn", "Organisasjonsnummer", "Leverandør-ID", "Land", "Innkjøp (NOK)", "Kategori", "Beskrivelse"],
      mapping: { name: 0, registryOrgNumber: 1, externalKey: 2, registeredCountry: 3, spend: 4, purchaseCategory: 5, purchaseDescription: 6 },
      decimal: "auto",
      problems: [],
      rowCount: 3,
      summary: { ready: 3, clarify: 0, error: 0, proposedNew: 3, proposedExisting: 0, proposedUnclear: 0 },
    });
    expect(result.rows[0]).toEqual({
      rowNumber: 2,
      source: {
        name: "Syntetisk Tekstil AS",
        registryOrgNumber: "920000002",
        externalKey: "L-1001",
        registeredCountry: "Norge",
        spend: "1 250 000,50",
        purchaseCategory: "Arbeidstøy",
        purchaseDescription: "Arbeidsklær til lager",
      },
      values: {
        name: "Syntetisk Tekstil AS",
        registryOrgNumber: "920000002",
        externalKey: "L-1001",
        registeredCountry: "NO",
        spendOre: 125_000_050n,
        purchaseCategory: "Arbeidstøy",
        purchaseDescription: "Arbeidsklær til lager",
      },
      issues: [],
      match: { kind: "new" },
      status: "ready",
    });
  });

  test("matching foreslås bare mot egne leverandører, aldri en annen organisasjons", async () => {
    const { t, fx } = await start();
    const ids = await t.run(async (ctx) => ({
      own: await ctx.db.insert("suppliers", supplier(fx.orgA, "Finnes Hos A AS", { registryOrgNumber: "920000002" })),
      // B har både samme leverandør-ID og samme navn som rad 2 og 3 i malen.
      foreignKey: await ctx.db.insert("suppliers", supplier(fx.orgB, "B Sin Rens ANS", { externalKey: "L-1002" })),
      foreignName: await ctx.db.insert("suppliers", supplier(fx.orgB, "Syntetisk Elektronikk Ltd")),
      foreignOrg: await ctx.db.insert("suppliers", supplier(fx.orgB, "B Sin Tekstil AS", { registryOrgNumber: "920000002" })),
    }));
    const result = await ok(t, fx, {});
    expect(result.rows.map((r) => r.match)).toEqual([
      { kind: "org_number", suppliers: [{ id: ids.own, name: "Finnes Hos A AS", archived: false }] },
      { kind: "new" },
      { kind: "new" },
    ]);
    const serialized = JSON.stringify(result, (_key, value) => (typeof value === "bigint" ? String(value) : value));
    for (const foreign of [ids.foreignKey, ids.foreignName, ids.foreignOrg, "B Sin"]) expect(serialized).not.toContain(foreign);
  });

  test("leverandørene hentes side for side: treff finnes også når organisasjonen har flere enn én side", async () => {
    const { t, fx } = await start();
    await t.run(async (ctx) => {
      for (let i = 0; i < 520; i++) await ctx.db.insert("suppliers", supplier(fx.orgA, `Leverandør ${String(i).padStart(3, "0")} AS`));
      // Sorteres sist på navn, altså på andre side.
      await ctx.db.insert("suppliers", supplier(fx.orgA, "Å Siste AS", { externalKey: "L-1003" }));
    });
    const result = await ok(t, fx, {});
    expect(result.rows[2].match).toMatchObject({ kind: "external_key", suppliers: [{ name: "Å Siste AS" }] });
  });

  test("ingenting lagres: verken tabeller, fillagring, revisjonslogg eller planlagte jobber endres", async () => {
    const { t, fx } = await start();
    await t.run((ctx) => ctx.db.insert("suppliers", supplier(fx.orgA, "Finnes Hos A AS", { registryOrgNumber: "920000002" })));
    const before = await everything(t);
    await ok(t, fx, {});
    await ok(t, fx, { file: fixture("tests/fixtures/csv/feilfil.csv"), decimal: "comma" });
    await asA(t, fx).action(preview, { organizationId: fx.orgA, file: fixture("tests/fixtures/csv/latin1.csv") });
    const after = await everything(t);
    expect(after).toEqual(before);
    expect(after.storage).toEqual([]);
    expect(after.scheduled).toEqual([]);
    expect(after.tables.auditEvents).toEqual([]);
  });

  test("grensene håndheves på serveren: for stor fil, for mange rader og feil tegnsett avvises", async () => {
    const { t, fx } = await start();
    const rejected = async (file: ArrayBuffer) => {
      const result = await asA(t, fx).action(preview, { organizationId: fx.orgA, file });
      return result.status === "rejected" ? result.code : "ok";
    };
    expect(await rejected(new Uint8Array(MAX_FILE_BYTES + 1).fill(0x41).buffer)).toBe("too_large");
    const rows = (count: number) => text(`Navn\n${Array.from({ length: count }, (_, i) => `Leverandør ${i} AS`).join("\n")}\n`);
    expect(await rejected(rows(MAX_ROWS + 1))).toBe("too_many_rows");
    expect(await rejected(rows(MAX_ROWS))).toBe("ok");
    expect(await rejected(fixture("tests/fixtures/csv/latin1.csv"))).toBe("not_utf8");
    expect(await rejected(text(""))).toBe("empty");
  });

  test("brukerens valg av skilletegn, kolonner og desimaltegn brukes", async () => {
    const { t, fx } = await start();
    const file = text("a,b;c\nFørste AS,1.234;x\n");
    const auto = await ok(t, fx, { file });
    expect(auto).toMatchObject({ delimiter: ";", headers: ["a,b", "c"], problems: [expect.stringMatching(/navnet/)], rows: [] });
    const chosen = await ok(t, fx, { file, delimiter: ",", mapping: { name: 0, spend: 1 }, decimal: "comma" });
    expect(chosen).toMatchObject({ delimiter: ",", headers: ["a", "b;c"], problems: [] });
    // «1.234;x» er ikke et beløp; kolonnevalget styrer hva som tolkes.
    expect(chosen.rows[0]).toMatchObject({ values: { name: "Første AS" }, issues: [{ code: "amount_format", field: "spend" }] });
    const ambiguous = await ok(t, fx, { file: text("Navn;Beløp\nA AS;1.234\n") });
    expect(ambiguous.rows[0]).toMatchObject({ status: "clarify", issues: [{ code: "amount_ambiguous" }] });
    const resolved = await ok(t, fx, { file: text("Navn;Beløp\nA AS;1.234\n"), decimal: "comma" });
    expect(resolved.rows[0].values.spendOre).toBe(123_400n);
  });

  test("fremmed organisasjon avvises før filen leses", async () => {
    const { t, fx } = await start();
    await expectAppError(asA(t, fx).action(preview, { organizationId: fx.orgB, file: TEMPLATE }), "NOT_FOUND");
    await expectAppError(t.action(preview, { organizationId: fx.orgA, file: TEMPLATE }), "UNAUTHENTICATED");
  });
});
