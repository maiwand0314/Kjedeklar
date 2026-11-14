/** Atomisk vurdering: feiler revisjonsloggen, lagres ingen vurderinger fra kjøringen. Egen fil fordi writeAudit byttes ut. */
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { SYNTHETIC_PERIOD, SYNTHETIC_SUPPLIER_DOC } from "../helpers/public-functions";
import { setupTest, twoTenants } from "./setup";

vi.mock("../../convex/lib/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../convex/lib/audit")>()),
  writeAudit: async () => {
    throw new Error("Revisjonsloggen feilet (test)");
  },
}));

test("feil i revisjonsloggen ruller tilbake alle vurderingene i kjøringen", async () => {
  const t = setupTest();
  const fx = await twoTenants(t);
  const method = JSON.parse(readFileSync("risk-data/demo/method-demo-1.json", "utf8"));
  await t.mutation(internal.risk.internal.importVersion, { operator: "Test", payload: method });
  await t.mutation(internal.risk.internal.activateVersion, { operator: "Test", kind: "method", version: method.version });
  const periodId = await t.run((ctx) => ctx.db.insert("reportingPeriods", { organizationId: fx.orgA, ...SYNTHETIC_PERIOD, status: "open", createdAt: 0, createdBy: "oppsett" }));
  await t.run((ctx) => ctx.db.insert("suppliers", { organizationId: fx.orgA, ...SYNTHETIC_SUPPLIER_DOC, createdAt: 0, createdBy: "oppsett" }));
  await expect(
    t.withIdentity(fx.userA.identity).mutation(api.risk.assessments.assessPeriod, { organizationId: fx.orgA, reportingPeriodId: periodId, cursor: null }),
  ).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await t.run((ctx) => ctx.db.query("riskAssessments").collect())).toEqual([]);
});
