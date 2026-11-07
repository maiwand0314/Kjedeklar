import { describe, expect, test } from "vitest";
import { wrapDatabaseReader, wrapDatabaseWriter } from "convex-helpers/server/rowLevelSecurity";
import { api } from "../../convex/_generated/api";
import { tenantRules } from "../../convex/lib/rls";
import {
  getOwned,
  tenantMutationInput,
  tenantQueryInput,
  type Tenant,
} from "../../convex/lib/tenant";
import {
  addMembership,
  createOrganization,
  createUser,
  expectAppError,
  setupTest,
  twoTenants,
} from "./setup";

const current = api.organizations.queries.current;

describe("tenantQuery", () => {
  test("uinnlogget bruker avvises", async () => {
    const t = setupTest();
    const { orgA } = await twoTenants(t);
    await expectAppError(t.query(current, { organizationId: orgA }), "UNAUTHENTICATED");
  });

  test("medlem leser egen organisasjon", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const result = await t.withIdentity(userA.identity).query(current, { organizationId: orgA });
    expect(result).toEqual({ id: orgA, name: "Org A", role: "admin" });
  });

  test("fremmed organisasjon gir NOT_FOUND", async () => {
    const t = setupTest();
    const { userA, orgB } = await twoTenants(t);
    await expectAppError(
      t.withIdentity(userA.identity).query(current, { organizationId: orgB }),
      "NOT_FOUND",
    );
  });

  test("slettet/ukjent organisasjon gir samme NOT_FOUND som fremmed", async () => {
    const t = setupTest();
    const { userA } = await twoTenants(t);
    const ghost = await createOrganization(t, "Borte");
    await t.run((ctx) => ctx.db.delete("organizations", ghost));
    await expectAppError(
      t.withIdentity(userA.identity).query(current, { organizationId: ghost }),
      "NOT_FOUND",
    );
  });

  test("inaktivt medlemskap gir NOT_FOUND", async () => {
    const t = setupTest();
    const { userA } = await twoTenants(t);
    const orgC = await createOrganization(t, "Org C");
    await addMembership(t, orgC, userA.userId, "inactive");
    await expectAppError(
      t.withIdentity(userA.identity).query(current, { organizationId: orgC }),
      "NOT_FOUND",
    );
  });

  test("inaktiv organisasjon gir NOT_FOUND selv med aktivt medlemskap", async () => {
    const t = setupTest();
    const { userA } = await twoTenants(t);
    const orgD = await createOrganization(t, "Org D", "inactive");
    await addMembership(t, orgD, userA.userId, "active");
    await expectAppError(
      t.withIdentity(userA.identity).query(current, { organizationId: orgD }),
      "NOT_FOUND",
    );
  });

  test("utløpt sesjon avvises selv med gyldig identitet", async () => {
    const t = setupTest();
    const expired = await createUser(t, "x@tenant-a.example", { sessionExpiresInMs: -1000 });
    const orgA = await createOrganization(t, "Org X");
    await addMembership(t, orgA, expired.userId);
    await expectAppError(
      t.withIdentity(expired.identity).query(current, { organizationId: orgA }),
      "UNAUTHENTICATED",
    );
  });
});

describe("userQuery listMine", () => {
  test("viser bare egne aktive organisasjoner", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const orgC = await createOrganization(t, "Org C");
    await addMembership(t, orgC, userA.userId, "inactive");
    const result = await t
      .withIdentity(userA.identity)
      .query(api.organizations.queries.listMine, {});
    expect(result).toEqual([{ id: orgA, name: "Org A" }]);
  });
});

describe("RLS-hjelper og getOwned", () => {
  async function tenantFor(t: ReturnType<typeof setupTest>) {
    const fixture = await twoTenants(t);
    const tenant: Tenant = {
      organizationId: fixture.orgA,
      userId: fixture.userA.userId,
      role: "admin",
      membershipId: fixture.membershipA,
    };
    return { ...fixture, tenant };
  }

  test("innpakket lesing skjuler andre tenants dokumenter", async () => {
    const t = setupTest();
    const { tenant, orgB, membershipB } = await tenantFor(t);
    await t.run(async (ctx) => {
      const db = wrapDatabaseReader({}, ctx.db, tenantRules(tenant), { defaultPolicy: "deny" });
      expect(await db.get("organizations", orgB)).toBeNull();
      expect(await db.get("memberships", membershipB)).toBeNull();
      const all = await db.query("memberships").collect();
      expect(all.map((m) => m.organizationId)).toEqual([tenant.organizationId]);
    });
  });

  test("tenantfunksjoner kan ikke opprette eller endre medlemskap eller fremmed organisasjon", async () => {
    const t = setupTest();
    const { tenant, membershipA, orgB } = await tenantFor(t);
    await t.run(async (ctx) => {
      const db = wrapDatabaseWriter({}, ctx.db, tenantRules(tenant), { defaultPolicy: "deny" });
      await expect(
        db.insert("memberships", {
          organizationId: tenant.organizationId,
          userId: "noen-andre",
          role: "admin",
          status: "active",
        }),
      ).rejects.toThrow();
      await expect(db.patch("memberships", membershipA, { status: "inactive" })).rejects.toThrow();
      // Egen organisasjon kan endres (navn, oppgave 05); fremmed kan ikke.
      await expect(db.patch("organizations", orgB, { name: "Endret" })).rejects.toThrow();
      await db.patch("organizations", tenant.organizationId, { name: "Endret" });
    });
  });

  test("getOwned avviser referanse til annen tenant med NOT_FOUND", async () => {
    const t = setupTest();
    const { tenant, membershipA, membershipB } = await tenantFor(t);
    await t.run(async (ctx) => {
      const scoped = { db: ctx.db, tenant };
      expect((await getOwned(scoped, "memberships", membershipA))._id).toBe(membershipA);
      await expectAppError(getOwned(scoped, "memberships", membershipB), "NOT_FOUND");
      await expectAppError(getOwned(scoped, "memberships", "ugyldig-id"), "NOT_FOUND");
    });
  });
});

describe("tenant-byggeklossenes kobling", () => {
  test("tenantQuery gir innpakket db som skjuler andre tenants", async () => {
    const t = setupTest();
    const { userA, orgA, orgB, membershipB } = await twoTenants(t);
    await t.withIdentity(userA.identity).run(async (ctx) => {
      const { ctx: scoped } = await tenantQueryInput(ctx, { organizationId: orgA });
      expect(scoped.tenant.organizationId).toBe(orgA);
      expect(await scoped.db.get("organizations", orgB)).toBeNull();
      expect(await scoped.db.get("memberships", membershipB)).toBeNull();
    });
  });

  test("tenantMutation gir innpakket db som nekter å skrive medlemskap", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    await t.withIdentity(userA.identity).run(async (ctx) => {
      const { ctx: scoped } = await tenantMutationInput(ctx, { organizationId: orgA });
      await expect(
        scoped.db.insert("memberships", {
          organizationId: orgA,
          userId: "inntrenger",
          role: "admin",
          status: "active",
        }),
      ).rejects.toThrow();
    });
  });

  test("tenantMutation avviser fremmed organisasjon før handler kjøres", async () => {
    const t = setupTest();
    const { userA, orgB } = await twoTenants(t);
    await t.withIdentity(userA.identity).run(async (ctx) => {
      await expectAppError(tenantMutationInput(ctx, { organizationId: orgB }), "NOT_FOUND");
    });
  });
});
