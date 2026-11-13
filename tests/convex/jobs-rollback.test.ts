/**
 * Atomisk opprettelse: feiler revisjonsloggen, finnes verken jobben eller
 * arbeidet i køen. Egen fil fordi writeAudit byttes ut for hele filen.
 */
import { expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { SYNTHETIC_SUPPLIER_DOC } from "../helpers/public-functions";
import { setupTest, twoTenants } from "./setup";

vi.mock("../../convex/lib/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../convex/lib/audit")>()),
  writeAudit: async () => {
    throw new Error("Revisjonsloggen feilet (test)");
  },
}));

test("feil i revisjonsloggen ruller tilbake jobben og køoppføringen", async () => {
  vi.useFakeTimers();
  const t = setupTest();
  const fx = await twoTenants(t);
  const inputRef = await t.run((ctx) => ctx.db.insert("suppliers", { organizationId: fx.orgA, ...SYNTHETIC_SUPPLIER_DOC, createdAt: 0, createdBy: "oppsett" }));
  await expect(
    t.withIdentity(fx.userA.identity).mutation(api.jobs.mutations.enqueue, { organizationId: fx.orgA, type: "test.probe", inputRef, idempotencyKey: "k" }),
  ).rejects.toThrow(/Revisjonsloggen feilet/);
  // Ingenting ble lagt i køen: selv når alt planlagt kjøres, finnes ingen jobb.
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run((ctx) => ctx.db.query("jobs").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
  vi.useRealTimers();
});
