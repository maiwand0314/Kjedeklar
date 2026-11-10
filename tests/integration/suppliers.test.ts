/** Leverandørregisteret mot lokal backend med ekte innloggede brukere i to organisasjoner. */
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { clientWithToken, errorOf, setupTwoTenants, type TwoTenants } from "../helpers/local-backend";
import { SYNTHETIC_PERIOD, SYNTHETIC_SUPPLIER_PERIOD } from "../helpers/public-functions";

const { create, update, setArchived, savePeriod } = api.suppliers.mutations;
const { list, get } = api.suppliers.queries;

/** Gyldige syntetiske org.nr. (mod 11). */
const ORG_NUMBER = "920000002";
const OTHER_ORG_NUMBER = "920000010";
const SECRET_TEXT = "Syntetisk kjøpsbeskrivelse som ikke skal i loggen";
const firstPage = { numItems: 25, cursor: null };

const auditPage = (client: TwoTenants["a"], organizationId: string, entityType: "supplier" | "supplierPeriod") =>
  client.query(api.audit.queries.list, { organizationId, entityType, paginationOpts: { numItems: 25, cursor: null } });
const names = async (client: TwoTenants["a"], organizationId: string, archived = false) =>
  (await client.query(list, { organizationId, paginationOpts: firstPage, archived })).page.map((s) => s.name);

describe("leverandørregister mot lokal backend", () => {
  let env: TwoTenants;
  /** To klienter for samme bruker: én ConvexHttpClient sender mutasjoner i kø, ikke samtidig. */
  let twoTabs: TwoTenants["a"][];
  let supplierId: string;
  let periodA: string;
  let periodB: string;
  beforeAll(async () => {
    env = await setupTwoTenants();
    const { fx, a, b } = env;
    twoTabs = [a, clientWithToken(env.sessionA.token)];
    supplierId = await a.mutation(create, { organizationId: fx.orgA, name: "Syntetisk Tekstil AS", registryOrgNumber: ORG_NUMBER, registeredCountry: "NO" });
    periodA = await a.mutation(api.organizations.reportingPeriods.create, { organizationId: fx.orgA, ...SYNTHETIC_PERIOD });
    periodB = await b.mutation(api.organizations.reportingPeriods.create, { organizationId: fx.orgB, ...SYNTHETIC_PERIOD });
  });

  test("samme org.nr. er tillatt i en annen organisasjon, men avvises dobbelt i samme", async () => {
    const { fx, a, b } = env;
    await b.mutation(create, { organizationId: fx.orgB, name: "Samme nummer hos B AS", registryOrgNumber: ORG_NUMBER });
    expect(await errorOf(a.mutation(create, { organizationId: fx.orgA, name: "Kopi AS", registryOrgNumber: ORG_NUMBER }))).toMatchObject({
      code: "SUPPLIER_EXISTS",
    });
    expect(await names(a, fx.orgA)).toEqual(["Syntetisk Tekstil AS"]);
    expect(await names(b, fx.orgB)).toEqual(["Samme nummer hos B AS"]);
  });

  test("to samtidige opprettelser med samme org.nr. gir bare én leverandør", async () => {
    const { fx, a } = env;
    const outcomes = await Promise.all(
      twoTabs.map((tab, i) => errorOf(tab.mutation(create, { organizationId: fx.orgA, name: `Samtidig ${i} AS`, registryOrgNumber: OTHER_ORG_NUMBER }))),
    );
    expect(outcomes.map((o) => o.code).sort()).toEqual(["OK", "SUPPLIER_EXISTS"]);
    expect((await names(a, fx.orgA)).filter((n) => n.startsWith("Samtidig"))).toHaveLength(1);
  });

  test("innkjøpsdata: ukjent beløp, null kroner og eksakt stort beløp; norsk registrering gir ikke produksjonsland", async () => {
    const { fx, a } = env;
    const args = { organizationId: fx.orgA, supplierId, reportingPeriodId: periodA };
    expect((await a.query(get, args)).periodData).toBeNull();
    await a.mutation(savePeriod, { ...args, expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD, purchaseDescription: SECRET_TEXT });
    const unknown = await a.query(get, args);
    expect(unknown.supplier.registeredCountry).toBe("NO");
    expect(unknown.periodData).toEqual({ productionCountries: [], upstreamUnknown: true, purchaseDescription: SECRET_TEXT, rowVersion: 1 });

    await a.mutation(savePeriod, { ...args, expectedRowVersion: 1, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: 0n });
    expect((await a.query(get, args)).periodData?.spendOre).toBe(0n);
    const large = 99_999_999_999_999_999n;
    await a.mutation(savePeriod, { ...args, expectedRowVersion: 2, productionCountries: ["VN", "CN"], upstreamUnknown: false, spendOre: large, purchaseCategory: "Arbeidstøy" });
    expect((await a.query(get, args)).periodData).toEqual({
      spendOre: large,
      purchaseCategory: "Arbeidstøy",
      productionCountries: ["CN", "VN"],
      upstreamUnknown: false,
      rowVersion: 3,
    });
    // Profilen er et eget dokument og er ikke endret av innkjøpsdataene.
    expect((await a.query(get, args)).supplier).toMatchObject({ name: "Syntetisk Tekstil AS", rowVersion: 1 });
  });

  test("utdatert versjon gir konflikt fremfor datatap, også ved samtidige endringer", async () => {
    const { fx, a } = env;
    const target = { organizationId: fx.orgA, supplierId };
    const { rowVersion } = (await a.query(get, target)).supplier;
    const outcomes = await Promise.all(
      twoTabs.map((tab, i) => errorOf(tab.mutation(update, { ...target, expectedRowVersion: rowVersion, name: `Endret av fane ${i} AS`, registryOrgNumber: ORG_NUMBER }))),
    );
    expect(outcomes.map((o) => o.code).sort()).toEqual(["CONFLICT", "OK"]);
    const after = (await a.query(get, target)).supplier;
    expect(after.rowVersion).toBe(rowVersion + 1);
    expect(after.name).toMatch(/^Endret av fane [01] AS$/);

    // Innkjøpsdata: to faner lagrer fra samme versjon.
    const args = { ...target, reportingPeriodId: periodA };
    const current = (await a.query(get, args)).periodData!;
    const saves = await Promise.all(
      twoTabs.map((tab, i) => errorOf(tab.mutation(savePeriod, { ...args, expectedRowVersion: current.rowVersion, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: BigInt(i + 1) }))),
    );
    expect(saves.map((o) => o.code).sort()).toEqual(["CONFLICT", "OK"]);
    expect((await a.query(get, args)).periodData?.rowVersion).toBe(current.rowVersion + 1);
  });

  test("fremmed periode- og leverandørreferanse avvises av getOwned, og ingenting lekker eller endres", async () => {
    const { fx, a, b } = env;
    const before = await a.query(get, { organizationId: fx.orgA, supplierId, reportingPeriodId: periodA });
    const data = { expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: 1n };
    // A kobler egen leverandør til B sin periode.
    expect(await errorOf(a.mutation(savePeriod, { organizationId: fx.orgA, supplierId, reportingPeriodId: periodB, ...data }))).toMatchObject({
      code: "NOT_FOUND",
      data: { code: "NOT_FOUND", message: "Ikke funnet." },
    });
    expect((await errorOf(a.query(get, { organizationId: fx.orgA, supplierId, reportingPeriodId: periodB }))).code).toBe("NOT_FOUND");
    // B i egen organisasjon med A sin leverandør, og B direkte mot A sin organisasjon.
    for (const organizationId of [fx.orgB, fx.orgA]) {
      const target = { organizationId, supplierId };
      const reportingPeriodId = organizationId === fx.orgB ? periodB : periodA;
      expect((await errorOf(b.query(get, target))).code).toBe("NOT_FOUND");
      expect((await errorOf(b.mutation(update, { ...target, expectedRowVersion: before.supplier.rowVersion, name: "Kapret AS" }))).code).toBe("NOT_FOUND");
      expect((await errorOf(b.mutation(setArchived, { ...target, expectedRowVersion: before.supplier.rowVersion, archived: true }))).code).toBe("NOT_FOUND");
      expect((await errorOf(b.mutation(savePeriod, { ...target, reportingPeriodId, ...data }))).code).toBe("NOT_FOUND");
    }
    expect((await errorOf(b.query(list, { organizationId: fx.orgA, paginationOpts: firstPage }))).code).toBe("NOT_FOUND");
    expect((await errorOf(b.mutation(create, { organizationId: fx.orgA, name: "Inntrenger AS" }))).code).toBe("NOT_FOUND");
    expect(await names(b, fx.orgB)).toEqual(["Samme nummer hos B AS"]);
    expect(await a.query(get, { organizationId: fx.orgA, supplierId, reportingPeriodId: periodA })).toEqual(before);
  });

  test("arkivering bevarer historikken og kan angres", async () => {
    const { fx, a } = env;
    const target = { organizationId: fx.orgA, supplierId };
    const args = { ...target, reportingPeriodId: periodA };
    const before = await a.query(get, args);
    const { rowVersion } = await a.mutation(setArchived, { ...target, expectedRowVersion: before.supplier.rowVersion, archived: true });
    expect(await names(a, fx.orgA)).not.toContain(before.supplier.name);
    expect(await names(a, fx.orgA, true)).toEqual([before.supplier.name]);
    const archived = await a.query(get, args);
    expect(archived.supplier.status).toBe("archived");
    expect(archived.periodData).toEqual(before.periodData);
    await a.mutation(setArchived, { ...target, expectedRowVersion: rowVersion, archived: false });
    expect(await names(a, fx.orgA)).toContain(before.supplier.name);
  });

  test("alle endringer står i revisjonsloggen, uten kjøpsbeskrivelsen", async () => {
    const { fx, a, b } = env;
    const supplierLog = await auditPage(a, fx.orgA, "supplier");
    const own = supplierLog.page.filter((e) => e.entityId === supplierId).map((e) => e.eventType);
    // Nyeste først.
    expect(own).toEqual(["supplier.restored", "supplier.archived", "supplier.updated", "supplier.created"]);
    const periodLog = await auditPage(a, fx.orgA, "supplierPeriod");
    expect(periodLog.page.map((e) => e.eventType)).toEqual(Array(4).fill("supplier_period.saved"));
    expect(periodLog.page.some((e) => e.safeDiff.spendOre?.to === "99999999999999999")).toBe(true);
    expect(JSON.stringify([supplierLog.page, periodLog.page])).not.toContain("Syntetisk kjøpsbeskrivelse");
    // B ser bare egne hendelser.
    expect((await auditPage(b, fx.orgB, "supplier")).page.map((e) => e.eventType)).toEqual(["supplier.created"]);
    expect((await auditPage(b, fx.orgB, "supplierPeriod")).page).toEqual([]);
  });

  test("uten innlogging avvises alle seks funksjonene", async () => {
    const { fx, anonymous } = env;
    const target = { organizationId: fx.orgA, supplierId };
    const calls = [
      () => anonymous.query(list, { organizationId: fx.orgA, paginationOpts: firstPage }),
      () => anonymous.query(get, target),
      () => anonymous.mutation(create, { organizationId: fx.orgA, name: "Anonym AS" }),
      () => anonymous.mutation(update, { ...target, expectedRowVersion: 1, name: "Anonym AS" }),
      () => anonymous.mutation(setArchived, { ...target, expectedRowVersion: 1, archived: true }),
      () => anonymous.mutation(savePeriod, { ...target, reportingPeriodId: periodA, expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD }),
    ];
    for (const call of calls) expect((await errorOf(call())).code).toBe("UNAUTHENTICATED");
  });
});
