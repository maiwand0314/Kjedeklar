/**
 * Standardtilfeller for referansemisbruk, kjørt for hver kundetabell i
 * `tenant-tables.ts`. Nye tabeller får testene automatisk når de registreres.
 */
import {
  wrapDatabaseReader,
  wrapDatabaseWriter,
} from "convex-helpers/server/rowLevelSecurity";
import { describe, expect, test } from "vitest";
import { RLS_CONFIG, tenantRules } from "../../convex/lib/rls";
import { getOwned, type Tenant, type TenantTable } from "../../convex/lib/tenant";
import schema from "../../convex/schema";
import { expectAppError, setupTest, twoTenants } from "./setup";
import { SYNTHETIC_IMPORT_BATCH, SYNTHETIC_METHOD_VERSION_DOC, SYNTHETIC_PERIOD, SYNTHETIC_SUPPLIER_DOC } from "../helpers/public-functions";
import { insertRaw, syntheticAssessmentDoc, tenantTableCases, type Owner, type TenantTableCase } from "./tenant-tables";

const tables = Object.keys(tenantTableCases) as TenantTable[];

describe("registeret dekker alle kundetabeller", () => {
  test("alle tabeller med organizationId er registrert, og ingen andre", () => {
    const withOrganizationId = Object.entries(schema.tables)
      .filter(([, table]) => "organizationId" in table.validator.fields)
      .map(([name]) => name)
      .sort();
    expect([...tables].sort()).toEqual(withOrganizationId);
  });
});

describe.each(tables)("referanser i %s", (table) => {
  const c = tenantTableCases[table] as TenantTableCase<typeof table>;

  async function setup() {
    const t = setupTest();
    const fx = await twoTenants(t);
    const tenant: Tenant = {
      organizationId: fx.orgA,
      userId: fx.userA.userId,
      role: "admin",
      membershipId: fx.membershipA,
    };
    // Én periode og én leverandør per organisasjon, så tabeller som peker på dem får en i samme tenant.
    const [partA, partB] = await t.run((ctx) =>
      Promise.all(
        [fx.orgA, fx.orgB].map(async (organizationId) => ({
          organizationId,
          reportingPeriodId: await ctx.db.insert("reportingPeriods", { organizationId, ...SYNTHETIC_PERIOD, status: "open", createdAt: Date.now(), createdBy: "oppsett" }),
          supplierId: await ctx.db.insert("suppliers", { organizationId, ...SYNTHETIC_SUPPLIER_DOC, createdAt: Date.now(), createdBy: "oppsett" }),
        })),
      ),
    );
    const [batchA, batchB] = await t.run((ctx) =>
      Promise.all(
        [partA, partB].map(({ organizationId, reportingPeriodId }) =>
          ctx.db.insert("importBatches", {
            organizationId,
            reportingPeriodId,
            ...SYNTHETIC_IMPORT_BATCH,
            createdAt: Date.now(),
            createdBy: "oppsett",
            expiresAt: Date.now() + 3_600_000,
          }),
        ),
      ),
    );
    const methodVersionId = await t.run((ctx) => ctx.db.insert("riskMethodVersions", SYNTHETIC_METHOD_VERSION_DOC));
    const [assessmentA, assessmentB] = await t.run((ctx) =>
      Promise.all([partA, partB].map((part) => ctx.db.insert("riskAssessments", syntheticAssessmentDoc({ ...part, methodVersionId, userId: "oppsett" })))),
    );
    const inA = (userId: string): Owner => ({ ...partA, importBatchId: batchA, methodVersionId, assessmentId: assessmentA, userId });
    const inB = (userId: string): Owner => ({ ...partB, importBatchId: batchB, methodVersionId, assessmentId: assessmentB, userId });
    const ids = await t.run(async (ctx) => {
      const own = await insertRaw(ctx.db, table, inA(`eget-${table}`));
      const foreign = await insertRaw(ctx.db, table, inB(`fremmed-${table}`));
      const deleted = await insertRaw(ctx.db, table, inA(`slettet-${table}`));
      await ctx.db.delete(table, deleted);
      return { own, foreign, deleted };
    });
    return { t, fx, tenant, ...ids, inA, inB };
  }

  test("getOwned godtar eget og avviser fremmed, slettet, ugyldig og annen tabell likt", async () => {
    const { t, fx, tenant, own, foreign, deleted } = await setup();
    await t.run(async (ctx) => {
      // Både med rå og innpakket db: getOwned skal ikke stole på at db er innpakket.
      const wrapped = wrapDatabaseReader({}, ctx.db, tenantRules(tenant), RLS_CONFIG);
      for (const db of [ctx.db, wrapped]) {
        const scoped = { db, tenant };
        expect((await getOwned(scoped, table, own))._id).toBe(own);
        await expectAppError(getOwned(scoped, table, foreign), "NOT_FOUND");
        await expectAppError(getOwned(scoped, table, deleted), "NOT_FOUND");
        await expectAppError(getOwned(scoped, table, "ikke-en-id"), "NOT_FOUND");
        await expectAppError(getOwned(scoped, table, fx.orgA), "NOT_FOUND");
      }
    });
  });

  test("innpakket lesing skjuler fremmede dokumenter", async () => {
    const { t, tenant, own, foreign } = await setup();
    await t.run(async (ctx) => {
      const db = wrapDatabaseReader({}, ctx.db, tenantRules(tenant), RLS_CONFIG);
      expect(await db.get(table, foreign)).toBeNull();
      expect((await db.get(table, own))?._id).toBe(own);
      const all = await db.query(table).collect();
      expect(all.length).toBeGreaterThan(0);
      expect(all.every((d) => d.organizationId === tenant.organizationId)).toBe(true);
    });
  });

  test("innpakket skriving kan ikke endre, slette, erstatte eller opprette i fremmed organisasjon", async () => {
    const { t, tenant, foreign, inA, inB } = await setup();
    const before = await t.run((ctx) => ctx.db.get(table, foreign));
    await t.run(async (ctx) => {
      const db = wrapDatabaseWriter({}, ctx.db, tenantRules(tenant), RLS_CONFIG);
      await expect(db.patch(table, foreign, c.patch as never)).rejects.toThrow();
      await expect(
        db.replace(table, foreign, c.newDoc(inA("kapret")) as never),
      ).rejects.toThrow();
      await expect(db.delete(table, foreign)).rejects.toThrow();
      await expect(db.insert(table, c.newDoc(inB("inntrenger")) as never)).rejects.toThrow();
    });
    expect(await t.run((ctx) => ctx.db.get(table, foreign))).toEqual(before);
  });

  test("egne dokumenter kan bare endres eller opprettes der tabellen tillater det", async () => {
    const { t, tenant, own, inA } = await setup();
    await t.run(async (ctx) => {
      const db = wrapDatabaseWriter({}, ctx.db, tenantRules(tenant), RLS_CONFIG);
      const patch = db.patch(table, own, c.patch as never);
      const insert = db.insert(table, c.newDoc(inA("ny")) as never);
      if (c.tenantCanModifyOwn) await expect(patch).resolves.toBeUndefined();
      else await expect(patch).rejects.toThrow();
      if (c.tenantCanInsertOwn) await expect(insert).resolves.toBeTruthy();
      else await expect(insert).rejects.toThrow();
    });
  });
});
