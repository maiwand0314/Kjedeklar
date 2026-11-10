/**
 * Atomisk lagring: feiler revisjonsloggen, lagres ingen endring i leverandør
 * eller innkjøpsdata. Egen fil fordi writeAudit byttes ut for hele filen.
 */
import { expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { SYNTHETIC_PERIOD, SYNTHETIC_SUPPLIER, SYNTHETIC_SUPPLIER_DOC, SYNTHETIC_SUPPLIER_PERIOD } from "../helpers/public-functions";
import { setupTest, twoTenants } from "./setup";

vi.mock("../../convex/lib/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../convex/lib/audit")>()),
  writeAudit: async () => {
    throw new Error("Revisjonsloggen feilet (test)");
  },
}));

const { create, update, setArchived, savePeriod } = api.suppliers.mutations;

async function setup() {
  const t = setupTest();
  const fx = await twoTenants(t);
  const ids = await t.run(async (ctx) => ({
    supplierId: await ctx.db.insert("suppliers", { organizationId: fx.orgA, ...SYNTHETIC_SUPPLIER_DOC, createdAt: Date.now(), createdBy: "oppsett" }),
    reportingPeriodId: await ctx.db.insert("reportingPeriods", { organizationId: fx.orgA, ...SYNTHETIC_PERIOD, status: "open", createdAt: Date.now(), createdBy: "oppsett" }),
  }));
  const before = await t.run((ctx) => ctx.db.query("suppliers").collect());
  return { t, fx, ...ids, before, a: t.withIdentity(fx.userA.identity) };
}

test("feil i revisjonsloggen ruller tilbake ny leverandør", async () => {
  const { t, fx, a, before } = await setup();
  await expect(a.mutation(create, { organizationId: fx.orgA, name: "Ny AS" })).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await t.run((ctx) => ctx.db.query("suppliers").collect())).toEqual(before);
});

test("feil i revisjonsloggen ruller tilbake endring og arkivering", async () => {
  const { t, fx, a, supplierId, before } = await setup();
  const target = { organizationId: fx.orgA, supplierId, expectedRowVersion: 1 };
  await expect(a.mutation(update, { ...target, ...SYNTHETIC_SUPPLIER, name: "Endret AS" })).rejects.toThrow(/Revisjonsloggen feilet/);
  await expect(a.mutation(setArchived, { ...target, archived: true })).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await t.run((ctx) => ctx.db.query("suppliers").collect())).toEqual(before);
});

test("feil i revisjonsloggen ruller tilbake innkjøpsdata", async () => {
  const { t, fx, a, supplierId, reportingPeriodId } = await setup();
  await expect(
    a.mutation(savePeriod, { organizationId: fx.orgA, supplierId, reportingPeriodId, expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD, spendOre: 1n }),
  ).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await t.run((ctx) => ctx.db.query("supplierPeriods").collect())).toEqual([]);
});
