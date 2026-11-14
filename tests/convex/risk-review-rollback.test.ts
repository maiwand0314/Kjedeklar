/** Atomisk vurdering: feiler revisjonsloggen, lagres ingen vurdering fra kunden. Egen fil fordi writeAudit byttes ut. */
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { SYNTHETIC_PERIOD, SYNTHETIC_SUPPLIER_DOC } from "../helpers/public-functions";
import { setupTest, twoTenants } from "./setup";

vi.mock("../../convex/lib/audit", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../convex/lib/audit")>();
  return {
    ...original,
    // Vurderingen (risk.assessed) skrives som vanlig; bare kundens vurdering feiler.
    writeAudit: async (ctx: Parameters<typeof original.writeAudit>[0], input: Parameters<typeof original.writeAudit>[1]) => {
      if (input.eventType === "risk.reviewed") throw new Error("Revisjonsloggen feilet (test)");
      return original.writeAudit(ctx, input);
    },
  };
});

test("feil i revisjonsloggen ruller tilbake kundens vurdering", async () => {
  const t = setupTest();
  const fx = await twoTenants(t);
  for (const [kind, name] of [["country", "country"], ["industry", "industry"], ["method", "method"]] as const) {
    const manifest = JSON.parse(readFileSync(`risk-data/demo/${name}-demo-1.json`, "utf8"));
    await t.mutation(internal.risk.internal.importVersion, { operator: "Test", payload: manifest });
    await t.mutation(internal.risk.internal.activateVersion, { operator: "Test", kind, version: manifest.version });
  }
  const a = t.withIdentity(fx.userA.identity);
  const reportingPeriodId = await t.run((ctx) => ctx.db.insert("reportingPeriods", { organizationId: fx.orgA, ...SYNTHETIC_PERIOD, status: "open", createdAt: 0, createdBy: "oppsett" }));
  const supplierId = await t.run((ctx) => ctx.db.insert("suppliers", { organizationId: fx.orgA, ...SYNTHETIC_SUPPLIER_DOC, createdAt: 0, createdBy: "oppsett" }));
  await a.mutation(api.risk.assessments.assessPeriod, { organizationId: fx.orgA, reportingPeriodId, cursor: null });
  const [assessment] = await t.run((ctx) => ctx.db.query("riskAssessments").collect());
  await expect(
    a.mutation(api.risk.reviews.record, {
      organizationId: fx.orgA, supplierId, reportingPeriodId, assessmentId: assessment._id, expectedReviewId: null,
      decision: "confirm", rationale: "Vi har gjennomgått grunnlaget og bekrefter nivået.",
    }),
  ).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await t.run((ctx) => ctx.db.query("assessmentReviews").collect())).toEqual([]);
});
