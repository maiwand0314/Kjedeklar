/**
 * Atomisk beriking: feiler revisjonsloggen, rulles forespørselen, godkjenningen
 * og skrivingen av registersvaret tilbake. Egen fil fordi writeAudit byttes ut
 * for hele filen (se jobs-rollback.test.ts). `failAudit` styrer når den kaster.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { enhetBody, fakeBrreg } from "../helpers/fake-brreg";
import { SYNTHETIC_REGISTRY_PROFILE, SYNTHETIC_SUPPLIER_DOC } from "../helpers/public-functions";
import { setupTest, twoTenants } from "./setup";

const state = vi.hoisted(() => ({ failAudit: false }));
vi.mock("../../convex/lib/audit", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../convex/lib/audit")>();
  return {
    ...original,
    writeAudit: async (...args: Parameters<typeof original.writeAudit>) => {
      if (state.failAudit) throw new Error("Revisjonsloggen feilet (test)");
      return await original.writeAudit(...args);
    },
  };
});

const realFetch = globalThis.fetch;
beforeEach(() => {
  vi.useFakeTimers();
  state.failAudit = false;
});
afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = realFetch;
});

const ORG = "920000010";

async function start() {
  const t = setupTest();
  const fx = await twoTenants(t);
  globalThis.fetch = fakeBrreg({ [ORG]: [{ status: 200, body: enhetBody(ORG) }] }).impl;
  const supplierId = await t.run((ctx) =>
    ctx.db.insert("suppliers", { organizationId: fx.orgA, ...SYNTHETIC_SUPPLIER_DOC, registryOrgNumber: ORG, createdAt: 0, createdBy: "oppsett" }),
  );
  const a = t.withIdentity(fx.userA.identity);
  const doc = () => t.run((ctx) => ctx.db.get("suppliers", supplierId));
  return { t, fx, a, supplierId, doc, org: { organizationId: fx.orgA } };
}

test("feil i revisjonsloggen ruller tilbake forespørselen: ingen jobb, ingen status, ingenting i køen", async () => {
  const { t, a, supplierId, doc, org } = await start();
  state.failAudit = true;
  await expect(a.mutation(api.suppliers.enrichment.request, { ...org, supplierId })).rejects.toThrow(/Revisjonsloggen feilet/);
  state.failAudit = false;
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run((ctx) => ctx.db.query("jobs").collect())).toEqual([]);
  expect(await doc()).not.toHaveProperty("registryEnrichment");
  expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
});

test("feil i revisjonsloggen ruller tilbake godkjenningen av et forslag", async () => {
  const { t, a, supplierId, doc, org } = await start();
  await a.mutation(api.suppliers.enrichment.request, { ...org, supplierId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  state.failAudit = true;
  await expect(
    a.mutation(api.suppliers.enrichment.applySuggestion, { ...org, supplierId, expectedRowVersion: 1, field: "registeredCountry", expectedValue: "NO" }),
  ).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await doc()).toMatchObject({ rowVersion: 1 });
  expect(await doc()).not.toHaveProperty("registeredCountry");
});

test("feil i revisjonsloggen ruller tilbake skrivingen av registersvaret: snapshot og jobbstatus står ikke igjen", async () => {
  const { t, a, supplierId, doc, org } = await start();
  const { jobId } = await a.mutation(api.suppliers.enrichment.request, { ...org, supplierId });
  const output = { kind: "found" as const, orgNumber: ORG, profile: SYNTHETIC_REGISTRY_PROFILE, fetchedAt: 1, payloadHash: "0".repeat(64), mappingVersion: "brreg-enhet-v1" };
  state.failAudit = true;
  await expect(t.mutation(internal.jobs.internal.complete, { jobId, output })).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await t.run((ctx) => ctx.db.query("registrySnapshots").collect())).toEqual([]);
  expect((await doc())?.registryEnrichment).toMatchObject({ state: "queued" });
  expect(await t.run((ctx) => ctx.db.get("jobs", jobId))).toMatchObject({ status: "queued" });
});
