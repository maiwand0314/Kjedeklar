import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { SYNTHETIC_PERIOD, SYNTHETIC_SUPPLIER, SYNTHETIC_SUPPLIER_PERIOD } from "../helpers/public-functions";
import { expectAppError, setupTest, twoTenants, type TestConvex } from "./setup";

const { create, update, setArchived, savePeriod } = api.suppliers.mutations;
const { list, get } = api.suppliers.queries;

type Fixture = Awaited<ReturnType<typeof twoTenants>>;
const asA = (t: TestConvex, fx: Fixture) => t.withIdentity(fx.userA.identity);
const asB = (t: TestConvex, fx: Fixture) => t.withIdentity(fx.userB.identity);
const suppliers = (t: TestConvex) => t.run((ctx) => ctx.db.query("suppliers").collect());
const periodRows = (t: TestConvex) => t.run((ctx) => ctx.db.query("supplierPeriods").collect());
const auditRows = (t: TestConvex) => t.run((ctx) => ctx.db.query("auditEvents").collect());

/** Gyldige syntetiske org.nr. (mod 11). */
const ORG_NUMBER = "920000002";
const OTHER_ORG_NUMBER = "920000010";
/** Fritekst som aldri skal havne i revisjonsloggen. */
const SECRET_TEXT = "Syntetisk kjøpsbeskrivelse som ikke skal i loggen";
const firstPage = { numItems: 25, cursor: null };

async function start() {
  const t = setupTest();
  const fx = await twoTenants(t);
  return { t, fx };
}

/** Én leverandør i A og én rapportperiode i hver organisasjon. */
async function withSupplier() {
  const { t, fx } = await start();
  const supplierId = await asA(t, fx).mutation(create, { organizationId: fx.orgA, ...SYNTHETIC_SUPPLIER });
  const [periodA, periodB] = await t.run((ctx) =>
    Promise.all(
      [fx.orgA, fx.orgB].map((organizationId) =>
        ctx.db.insert("reportingPeriods", { organizationId, ...SYNTHETIC_PERIOD, status: "open", createdAt: Date.now(), createdBy: "oppsett" }),
      ),
    ),
  );
  const args = { organizationId: fx.orgA, supplierId, reportingPeriodId: periodA };
  return { t, fx, supplierId, periodA, periodB, args };
}

describe("leverandørprofil", () => {
  test("opprettes med bare navn: resten er ukjent, og hendelsen logges", async () => {
    const { t, fx } = await start();
    const supplierId = await asA(t, fx).mutation(create, { organizationId: fx.orgA, name: "  Oslo   Bygg AS " });
    const [row] = await suppliers(t);
    expect(row).toMatchObject({ _id: supplierId, organizationId: fx.orgA, name: "Oslo Bygg AS", nameKey: "oslo bygg as", status: "active", rowVersion: 1, createdBy: fx.userA.userId });
    for (const field of ["registryOrgNumber", "externalKey", "registeredCountry", "industryCodeSystem", "industryCode", "archivedAt"]) {
      expect(row).not.toHaveProperty(field);
    }
    const [event] = await auditRows(t);
    expect(event).toMatchObject({
      organizationId: fx.orgA,
      actorId: fx.userA.userId,
      eventType: "supplier.created",
      entityType: "supplier",
      entityId: supplierId,
      safeDiff: { name: { to: "Oslo Bygg AS" }, status: { to: "active" } },
    });
  });

  test("samme org.nr. er tillatt i to organisasjoner, men avvises dobbelt i samme", async () => {
    const { t, fx } = await start();
    const first = await asA(t, fx).mutation(create, { organizationId: fx.orgA, name: "Første AS", registryOrgNumber: ORG_NUMBER });
    await asB(t, fx).mutation(create, { organizationId: fx.orgB, name: "Samme hos B AS", registryOrgNumber: ORG_NUMBER });
    // Også med mellomrom, og også når den første er arkivert.
    await expectAppError(asA(t, fx).mutation(create, { organizationId: fx.orgA, name: "Kopi AS", registryOrgNumber: "920 000 002" }), "SUPPLIER_EXISTS");
    await asA(t, fx).mutation(setArchived, { organizationId: fx.orgA, supplierId: first, expectedRowVersion: 1, archived: true });
    await expectAppError(asA(t, fx).mutation(create, { organizationId: fx.orgA, name: "Kopi AS", registryOrgNumber: ORG_NUMBER }), "SUPPLIER_EXISTS");
    expect((await suppliers(t)).map((s) => [s.organizationId, s.name]).sort()).toEqual(
      [
        [fx.orgA, "Første AS"],
        [fx.orgB, "Samme hos B AS"],
      ].sort(),
    );
  });

  test("endring kan ikke ta et org.nr. en annen leverandør har, men kan beholde sitt eget", async () => {
    const { t, fx } = await start();
    await asA(t, fx).mutation(create, { organizationId: fx.orgA, name: "Første AS", registryOrgNumber: ORG_NUMBER });
    const second = await asA(t, fx).mutation(create, { organizationId: fx.orgA, name: "Andre AS", registryOrgNumber: OTHER_ORG_NUMBER });
    const target = { organizationId: fx.orgA, supplierId: second, expectedRowVersion: 1 };
    await expectAppError(asA(t, fx).mutation(update, { ...target, name: "Andre AS", registryOrgNumber: ORG_NUMBER }), "SUPPLIER_EXISTS");
    expect(await asA(t, fx).mutation(update, { ...target, name: "Andre Nytt Navn AS", registryOrgNumber: OTHER_ORG_NUMBER })).toEqual({ rowVersion: 2 });
  });

  test("likt navn slås ikke sammen; det vises bare som forslag om mulig duplikat", async () => {
    const { t, fx } = await start();
    const first = await asA(t, fx).mutation(create, { organizationId: fx.orgA, name: "Oslo Bygg AS" });
    const second = await asA(t, fx).mutation(create, { organizationId: fx.orgA, name: "OSLO  BYGG as" });
    await asB(t, fx).mutation(create, { organizationId: fx.orgB, name: "Oslo Bygg AS" });
    expect(second).not.toBe(first);
    expect(await suppliers(t)).toHaveLength(3);
    const detail = await asA(t, fx).query(get, { organizationId: fx.orgA, supplierId: first });
    // Bare den andre i samme organisasjon, aldri B sin.
    expect(detail.sameName).toEqual([{ id: second, name: "OSLO BYGG as" }]);
  });

  test.each([
    [{ name: "  " }],
    [{ name: "A", registryOrgNumber: "920000003" }],
    [{ name: "A", registeredCountry: "Norge" }],
    [{ name: "A", industryCode: "46.900" }],
  ])("ugyldig profil %j lagrer ingenting", async (profile) => {
    const { t, fx } = await start();
    await expectAppError(asA(t, fx).mutation(create, { organizationId: fx.orgA, ...profile }), "INVALID_INPUT");
    expect(await suppliers(t)).toEqual([]);
    expect(await auditRows(t)).toEqual([]);
  });

  test("endring øker versjonen, fjerner felt som ikke lenger er oppgitt, og logger før og etter", async () => {
    const { t, fx } = await start();
    const supplierId = await asA(t, fx).mutation(create, {
      organizationId: fx.orgA,
      name: "Syntetisk Tekstil AS",
      registryOrgNumber: ORG_NUMBER,
      registeredCountry: "NO",
      industryCodeSystem: "SN2007",
      industryCode: "46.420",
    });
    await asA(t, fx).mutation(update, { organizationId: fx.orgA, supplierId, expectedRowVersion: 1, name: "Syntetisk Tekstil Norge AS", registeredCountry: "SE" });
    const [row] = await suppliers(t);
    expect(row).toMatchObject({ name: "Syntetisk Tekstil Norge AS", nameKey: "syntetisk tekstil norge as", registeredCountry: "SE", rowVersion: 2 });
    for (const field of ["registryOrgNumber", "industryCodeSystem", "industryCode"]) expect(row).not.toHaveProperty(field);
    const event = (await auditRows(t)).find((e) => e.eventType === "supplier.updated");
    expect(event?.safeDiff).toEqual({
      name: { from: "Syntetisk Tekstil AS", to: "Syntetisk Tekstil Norge AS" },
      registryOrgNumber: { from: ORG_NUMBER },
      registeredCountry: { from: "NO", to: "SE" },
      industryCodeSystem: { from: "SN2007" },
      industryCode: { from: "46.420" },
    });
  });

  test("utdatert versjon gir konflikt og endrer ingenting", async () => {
    const { t, fx, supplierId } = await withSupplier();
    const target = { organizationId: fx.orgA, supplierId };
    await asA(t, fx).mutation(update, { ...target, expectedRowVersion: 1, name: "Første endring AS" });
    await expectAppError(asA(t, fx).mutation(update, { ...target, expectedRowVersion: 1, name: "Utdatert endring AS" }), "CONFLICT");
    await expectAppError(asA(t, fx).mutation(setArchived, { ...target, expectedRowVersion: 1, archived: true }), "CONFLICT");
    expect(await suppliers(t)).toMatchObject([{ name: "Første endring AS", status: "active", rowVersion: 2 }]);
  });

  test("fremmed leverandør, ugyldig id og id fra en annen tabell gir samme avslag", async () => {
    const { t, fx, supplierId } = await withSupplier();
    for (const candidate of [supplierId, "ikke-en-id", fx.orgB]) {
      const target = { organizationId: fx.orgB, supplierId: candidate };
      await expectAppError(asB(t, fx).query(get, target), "NOT_FOUND");
      await expectAppError(asB(t, fx).mutation(update, { ...target, expectedRowVersion: 1, name: "Kapret AS" }), "NOT_FOUND");
      await expectAppError(asB(t, fx).mutation(setArchived, { ...target, expectedRowVersion: 1, archived: true }), "NOT_FOUND");
    }
    expect(await suppliers(t)).toMatchObject([{ ...SYNTHETIC_SUPPLIER, status: "active", rowVersion: 1 }]);
  });
});

describe("arkivering", () => {
  test("bevarer profil og innkjøpsdata, flytter leverandøren til arkivlisten og kan angres", async () => {
    const { t, fx, supplierId, args } = await withSupplier();
    await asA(t, fx).mutation(savePeriod, { ...args, expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: 50_000_00n });
    const target = { organizationId: fx.orgA, supplierId };
    // Status rører ingen profilfelt, så versjonen står: et åpent profilskjema får ikke falsk konflikt.
    expect(await asA(t, fx).mutation(setArchived, { ...target, expectedRowVersion: 1, archived: true })).toEqual({ rowVersion: 1 });

    const [archived] = await suppliers(t);
    expect(archived).toMatchObject({ ...SYNTHETIC_SUPPLIER, status: "archived", archivedAt: expect.any(Number), rowVersion: 1 });
    expect(await periodRows(t)).toMatchObject([{ supplierId, spendOre: 50_000_00n }]);
    const listed = (archivedOnly: boolean) => asA(t, fx).query(list, { organizationId: fx.orgA, paginationOpts: firstPage, archived: archivedOnly });
    expect((await listed(false)).page).toEqual([]);
    expect((await listed(true)).page).toMatchObject([{ id: supplierId }]);
    // Detaljsiden fungerer fortsatt, med innkjøpsdataene.
    expect((await asA(t, fx).query(get, args)).periodData).toMatchObject({ spendOre: 50_000_00n });

    // Samme tilstand en gang til er ingen endring og gir ingen ny hendelse.
    expect(await asA(t, fx).mutation(setArchived, { ...target, expectedRowVersion: 1, archived: true })).toEqual({ rowVersion: 1 });
    await asA(t, fx).mutation(setArchived, { ...target, expectedRowVersion: 1, archived: false });
    const [restored] = await suppliers(t);
    expect(restored).toMatchObject({ status: "active", rowVersion: 1 });
    expect(restored).not.toHaveProperty("archivedAt");
    const events = (await auditRows(t)).filter((e) => e.entityType === "supplier").map((e) => [e.eventType, e.safeDiff.status]);
    expect(events).toEqual([
      ["supplier.created", { to: "active" }],
      ["supplier.archived", { from: "active", to: "archived" }],
      ["supplier.restored", { from: "archived", to: "active" }],
    ]);
  });
});

describe("innkjøpsdata per rapportperiode", () => {
  test("ukjent beløp er noe annet enn null kroner, og store beløp lagres eksakt", async () => {
    const { t, fx, args } = await withSupplier();
    const saved = await asA(t, fx).mutation(savePeriod, { ...args, expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD });
    expect(saved.rowVersion).toBe(1);
    expect((await periodRows(t))[0]).not.toHaveProperty("spendOre");
    expect((await asA(t, fx).query(get, args)).periodData).toEqual({ ...SYNTHETIC_SUPPLIER_PERIOD, rowVersion: 1 });

    await asA(t, fx).mutation(savePeriod, { ...args, expectedRowVersion: 1, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: 0n });
    expect((await asA(t, fx).query(get, args)).periodData?.spendOre).toBe(0n);

    const large = 99_999_999_999_999_999n;
    await asA(t, fx).mutation(savePeriod, { ...args, expectedRowVersion: 2, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: large });
    expect((await asA(t, fx).query(get, args)).periodData?.spendOre).toBe(large);

    // Tilbake til ukjent: feltet fjernes, det settes ikke til null kroner.
    await asA(t, fx).mutation(savePeriod, { ...args, expectedRowVersion: 3, ...SYNTHETIC_SUPPLIER_PERIOD });
    expect(await periodRows(t)).toHaveLength(1);
    expect((await periodRows(t))[0]).not.toHaveProperty("spendOre");
  });

  test("norsk registrering gjør ikke produksjonslandet kjent", async () => {
    const { t, fx, supplierId, args } = await withSupplier();
    await asA(t, fx).mutation(update, { organizationId: fx.orgA, supplierId, expectedRowVersion: 1, ...SYNTHETIC_SUPPLIER, registeredCountry: "NO", registryOrgNumber: ORG_NUMBER });
    // Uten lagrede innkjøpsdata finnes ingen produksjonsland.
    expect((await asA(t, fx).query(get, args)).periodData).toBeNull();
    await asA(t, fx).mutation(savePeriod, { ...args, expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: 10_000_00n });
    const detail = await asA(t, fx).query(get, args);
    expect(detail.supplier.registeredCountry).toBe("NO");
    expect(detail.periodData).toMatchObject({ productionCountries: [], upstreamUnknown: true });
  });

  test("profilen er adskilt fra innkjøpsdata, og hver periode har sin egen rad", async () => {
    const { t, fx, supplierId, args } = await withSupplier();
    const secondPeriod = await t.run((ctx) =>
      ctx.db.insert("reportingPeriods", { organizationId: fx.orgA, startDate: "2026-01-01", endDate: "2026-12-31", publicationDueDate: "2027-06-30", status: "open", createdAt: Date.now(), createdBy: "oppsett" }),
    );
    const before = await suppliers(t);
    await asA(t, fx).mutation(savePeriod, { ...args, expectedRowVersion: 0, productionCountries: ["VN", "CN"], upstreamUnknown: false, spendOre: 125_050n, purchaseCategory: "Arbeidstøy" });
    await asA(t, fx).mutation(savePeriod, { ...args, reportingPeriodId: secondPeriod, expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: 0n });
    // Leverandørdokumentet er urørt, også versjonen.
    expect(await suppliers(t)).toEqual(before);
    expect((await periodRows(t)).map((r) => [r.reportingPeriodId, r.spendOre, r.productionCountries])).toEqual([
      [args.reportingPeriodId, 125_050n, ["CN", "VN"]],
      [secondPeriod, 0n, []],
    ]);
    expect((await asA(t, fx).query(get, { organizationId: fx.orgA, supplierId })).periodData).toBeNull();
    expect((await asA(t, fx).query(get, { ...args, reportingPeriodId: secondPeriod })).periodData).toMatchObject({ spendOre: 0n, rowVersion: 1 });
  });

  test("fremmed, ugyldig eller feil type periode og leverandør avvises likt, og ingenting lagres", async () => {
    const { t, fx, supplierId, periodA, periodB } = await withSupplier();
    const supplierB = await asB(t, fx).mutation(create, { organizationId: fx.orgB, name: "B sin leverandør AS" });
    const data = { expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: 1n };
    const attempts = [
      // A med fremmed, ugyldig og feil type periode
      { as: asA, organizationId: fx.orgA, supplierId, reportingPeriodId: periodB },
      { as: asA, organizationId: fx.orgA, supplierId, reportingPeriodId: "ikke-en-id" },
      { as: asA, organizationId: fx.orgA, supplierId, reportingPeriodId: supplierId },
      // A med fremmed leverandør og egen periode
      { as: asA, organizationId: fx.orgA, supplierId: supplierB, reportingPeriodId: periodA },
      // B i egen organisasjon med A sine id-er, og B mot A sin organisasjon
      { as: asB, organizationId: fx.orgB, supplierId, reportingPeriodId: periodB },
      { as: asB, organizationId: fx.orgB, supplierId: supplierB, reportingPeriodId: periodA },
      { as: asB, organizationId: fx.orgA, supplierId, reportingPeriodId: periodA },
    ];
    for (const { as, ...target } of attempts) {
      await expectAppError(as(t, fx).mutation(savePeriod, { ...target, ...data }), "NOT_FOUND");
      const { organizationId, supplierId: candidate, reportingPeriodId } = target;
      await expectAppError(as(t, fx).query(get, { organizationId, supplierId: candidate, reportingPeriodId }), "NOT_FOUND");
    }
    expect(await periodRows(t)).toEqual([]);
  });

  test("utdatert versjon gir konflikt fremfor å overskrive", async () => {
    const { t, fx, args } = await withSupplier();
    await asA(t, fx).mutation(savePeriod, { ...args, expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: 100n });
    for (const expectedRowVersion of [0, 2]) {
      await expectAppError(asA(t, fx).mutation(savePeriod, { ...args, expectedRowVersion, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: 999n }), "CONFLICT");
    }
    expect(await periodRows(t)).toMatchObject([{ spendOre: 100n, rowVersion: 1 }]);
  });

  test.each([
    ["negativt beløp", { spendOre: -1n }],
    ["ukjent landkode", { productionCountries: ["Kina"] }],
    ["for lang kategori", { purchaseCategory: "x".repeat(101) }],
  ])("ugyldige innkjøpsdata (%s) lagrer ingenting", async (_label, invalid) => {
    const { t, fx, args } = await withSupplier();
    await expectAppError(asA(t, fx).mutation(savePeriod, { ...args, expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD, ...invalid }), "INVALID_INPUT");
    expect(await periodRows(t)).toEqual([]);
  });

  test("revisjonsloggen har beløp, kategori og land, men aldri kjøpsbeskrivelsen", async () => {
    const { t, fx, args } = await withSupplier();
    const first = await asA(t, fx).mutation(savePeriod, { ...args, expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD, purchaseDescription: SECRET_TEXT });
    await asA(t, fx).mutation(savePeriod, {
      ...args,
      expectedRowVersion: 1,
      spendOre: 125_050n,
      purchaseCategory: "Arbeidstøy",
      purchaseDescription: `${SECRET_TEXT} (endret)`,
      productionCountries: ["VN", "CN"],
      upstreamUnknown: false,
    });
    const events = (await auditRows(t)).filter((e) => e.entityType === "supplierPeriod");
    expect(events.map((e) => [e.eventType, e.entityId, e.safeDiff])).toEqual([
      ["supplier_period.saved", first.supplierPeriodId, { upstreamUnknown: { to: true } }],
      [
        "supplier_period.saved",
        first.supplierPeriodId,
        {
          spendOre: { to: "125050" },
          purchaseCategory: { to: "Arbeidstøy" },
          productionCountries: { to: "CN, VN" },
          upstreamUnknown: { from: true, to: false },
        },
      ],
    ]);
    expect(JSON.stringify(await auditRows(t))).not.toContain("Syntetisk kjøpsbeskrivelse");
  });
});

describe("leverandørliste", () => {
  test("sortert på navn, paginert, med søk på starten av navnet og bare egne leverandører", async () => {
    const { t, fx } = await start();
    for (const name of ["Østfold Rens AS", "bergen Bygg AS", "Bergen Tekstil AS", "Alta Frakt AS"]) {
      await asA(t, fx).mutation(create, { organizationId: fx.orgA, name });
    }
    await asB(t, fx).mutation(create, { organizationId: fx.orgB, name: "Bergen hos B AS" });

    const page = (opts: { numItems: number; cursor: string | null }, search?: string) =>
      asA(t, fx).query(list, { organizationId: fx.orgA, paginationOpts: opts, search });
    const first = await page({ numItems: 3, cursor: null });
    expect(first.page.map((s) => s.name)).toEqual(["Alta Frakt AS", "bergen Bygg AS", "Bergen Tekstil AS"]);
    expect(first.isDone).toBe(false);
    const second = await page({ numItems: 3, cursor: first.continueCursor });
    expect(second.page.map((s) => s.name)).toEqual(["Østfold Rens AS"]);
    expect(second.isDone).toBe(true);

    expect((await page(firstPage, "  BERGEN ")).page.map((s) => s.name)).toEqual(["bergen Bygg AS", "Bergen Tekstil AS"]);
    expect((await page(firstPage, "bygg")).page).toEqual([]); // bare starten av navnet
    expect((await page(firstPage, "ø")).page.map((s) => s.name)).toEqual(["Østfold Rens AS"]);
    expect((await asB(t, fx).query(list, { organizationId: fx.orgB, paginationOpts: firstPage })).page.map((s) => s.name)).toEqual(["Bergen hos B AS"]);
  });
});
