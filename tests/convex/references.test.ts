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
import { insertRaw, tenantTableCases, type TenantTableCase } from "./tenant-tables";

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
    const ids = await t.run(async (ctx) => {
      const own = await insertRaw(ctx.db, table, {
        organizationId: fx.orgA,
        userId: `eget-${table}`,
      });
      const foreign = await insertRaw(ctx.db, table, {
        organizationId: fx.orgB,
        userId: `fremmed-${table}`,
      });
      const deleted = await insertRaw(ctx.db, table, {
        organizationId: fx.orgA,
        userId: `slettet-${table}`,
      });
      await ctx.db.delete(table, deleted);
      return { own, foreign, deleted };
    });
    return { t, fx, tenant, ...ids };
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
    const { t, fx, tenant, foreign } = await setup();
    const before = await t.run((ctx) => ctx.db.get(table, foreign));
    await t.run(async (ctx) => {
      const db = wrapDatabaseWriter({}, ctx.db, tenantRules(tenant), RLS_CONFIG);
      await expect(db.patch(table, foreign, c.patch as never)).rejects.toThrow();
      await expect(
        db.replace(
          table,
          foreign,
          c.newDoc({ organizationId: tenant.organizationId, userId: "kapret" }) as never,
        ),
      ).rejects.toThrow();
      await expect(db.delete(table, foreign)).rejects.toThrow();
      await expect(
        db.insert(
          table,
          c.newDoc({ organizationId: fx.orgB, userId: "inntrenger" }) as never,
        ),
      ).rejects.toThrow();
    });
    expect(await t.run((ctx) => ctx.db.get(table, foreign))).toEqual(before);
  });

  test("egne dokumenter kan bare endres eller opprettes der tabellen tillater det", async () => {
    const { t, tenant, own } = await setup();
    await t.run(async (ctx) => {
      const db = wrapDatabaseWriter({}, ctx.db, tenantRules(tenant), RLS_CONFIG);
      const patch = db.patch(table, own, c.patch as never);
      const insert = db.insert(
        table,
        c.newDoc({ organizationId: tenant.organizationId, userId: "ny" }) as never,
      );
      if (c.tenantCanModifyOwn) await expect(patch).resolves.toBeUndefined();
      else await expect(patch).rejects.toThrow();
      if (c.tenantCanInsertOwn) await expect(insert).resolves.toBeTruthy();
      else await expect(insert).rejects.toThrow();
    });
  });
});
