/**
 * Atomisk import: feiler revisjonsloggen, lagres ingenting fra det steget.
 * Egen fil fordi writeAudit byttes ut for hele filen; `control.fail` styrer når.
 */
import { expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { SYNTHETIC_PERIOD } from "../helpers/public-functions";
import { expectAppError, setupTest, twoTenants } from "./setup";

const control = vi.hoisted(() => ({ fail: false }));
vi.mock("../../convex/lib/audit", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../convex/lib/audit")>();
  return {
    ...original,
    writeAudit: async (...args: Parameters<typeof original.writeAudit>) => {
      if (control.fail) throw new Error("Revisjonsloggen feilet (test)");
      return original.writeAudit(...args);
    },
  };
});

const { prepare } = api.suppliers.import.prepare;
const { list, get, startCommit, commitChunk } = api.suppliers.import.batches;

async function setup() {
  control.fail = false;
  const t = setupTest();
  const fx = await twoTenants(t);
  const reportingPeriodId = await t.run((ctx) =>
    ctx.db.insert("reportingPeriods", { organizationId: fx.orgA, ...SYNTHETIC_PERIOD, status: "open", createdAt: Date.now(), createdBy: "oppsett" }),
  );
  const a = t.withIdentity(fx.userA.identity);
  const file = (count: number) =>
    new TextEncoder().encode(`Navn;Beløp\n${Array.from({ length: count }, (_, i) => `Rad ${String(i).padStart(3, "0")} AS;${i + 1}`).join("\n")}\n`).buffer;
  const prepared = (count: number) => a.action(prepare, { organizationId: fx.orgA, file: file(count), fileName: "a.csv", reportingPeriodId });
  const counts = () =>
    t.run(async (ctx) => ({
      suppliers: (await ctx.db.query("suppliers").collect()).length,
      periods: (await ctx.db.query("supplierPeriods").collect()).length,
      applied: (await ctx.db.query("auditEvents").collect()).filter((e) => e.eventType === "import.applied").length,
      outcomes: (await ctx.db.query("importRows").collect()).filter((r) => r.outcome).length,
    }));
  return { t, fx, a, prepared, counts, org: { organizationId: fx.orgA } };
}

test("feiler loggen når grunnlaget skal bli et utkast, finnes det ikke for brukeren", async () => {
  const { t, a, prepared, org } = await setup();
  control.fail = true;
  await expect(prepared(3)).rejects.toThrow(/Revisjonsloggen feilet/);
  const [batch] = await t.run((ctx) => ctx.db.query("importBatches").collect());
  expect(batch.status).toBe("preparing");
  expect(await a.query(list, org)).toEqual([]);
  await expectAppError(a.query(get, { ...org, batchId: batch._id }), "NOT_FOUND");
  await expectAppError(a.mutation(startCommit, { ...org, batchId: batch._id, expectedRowVersion: 1 }), "NOT_FOUND");
  // Et nytt forsøk lager et brukbart grunnlag; det halvferdige gjenbrukes ikke.
  control.fail = false;
  const retry = await prepared(3);
  expect(retry).toMatchObject({ status: "ok" });
  expect(retry.status === "ok" && retry.batchId).not.toBe(batch._id);
});

test("feiler loggen ved bekreftelse, er grunnlaget fortsatt et utkast", async () => {
  const { a, prepared, counts, org } = await setup();
  const result = await prepared(3);
  if (result.status !== "ok") throw new Error(result.message);
  control.fail = true;
  await expect(a.mutation(startCommit, { ...org, batchId: result.batchId, expectedRowVersion: 1 })).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await a.query(get, { ...org, batchId: result.batchId })).toMatchObject({ status: "draft", processed: 0 });
  await expectAppError(a.mutation(commitChunk, { ...org, batchId: result.batchId }), "CONFLICT");
  expect(await counts()).toEqual({ suppliers: 0, periods: 0, applied: 0, outcomes: 0 });
});

test("feil midt i importen ruller tilbake hele stykket; importen står som ikke fullført og kan fortsettes", async () => {
  const { a, prepared, counts, org } = await setup();
  const result = await prepared(250);
  if (result.status !== "ok") throw new Error(result.message);
  const target = { ...org, batchId: result.batchId };
  await a.mutation(startCommit, { ...target, expectedRowVersion: 1 });
  expect(await a.mutation(commitChunk, target)).toMatchObject({ done: false, processed: 100 });

  // Andre stykke feiler etter at 100 leverandører er skrevet i transaksjonen: alt rulles tilbake.
  control.fail = true;
  await expect(a.mutation(commitChunk, target)).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await counts()).toEqual({ suppliers: 100, periods: 100, applied: 1, outcomes: 100 });
  expect(await a.query(get, target)).toMatchObject({ status: "committing", processed: 100, entryCount: 250, result: { created: 100 } });

  // Når feilen er borte, fortsetter importen der den slapp, uten dubletter.
  control.fail = false;
  expect(await a.mutation(commitChunk, target)).toMatchObject({ done: false, processed: 200 });
  expect(await a.mutation(commitChunk, target)).toMatchObject({ done: true, processed: 250, result: { created: 250, conflicts: 0 } });
  expect(await counts()).toEqual({ suppliers: 250, periods: 250, applied: 3, outcomes: 250 });
});
