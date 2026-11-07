import { wrapDatabaseReader, wrapDatabaseWriter } from "convex-helpers/server/rowLevelSecurity";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { AUDIT_DIFF_FIELDS, safeDiff, writeAudit } from "../../convex/lib/audit";
import { invitationRules, RLS_CONFIG, tenantRules, userRules } from "../../convex/lib/rls";
import { createUser, expectAppError, setupTest, twoTenants, type TestConvex } from "./setup";

// Planlagte e-postjobber skal ikke kjøre under testene (se invitations.test.ts).
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const auditOf = (t: TestConvex) => t.run((ctx) => ctx.db.query("auditEvents").collect());

describe("revisjonslogg skrives med endringen", () => {
  test("navneendring lagrer aktør, tenant, objekt, hendelse, tid og trygg diff", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const before = Date.now();
    await t.withIdentity(userA.identity).mutation(api.organizations.mutations.rename, {
      organizationId: orgA,
      name: "Nytt navn AS",
    });
    const [event] = (await auditOf(t)).filter((e) => e.eventType === "organization.renamed");
    expect(event).toMatchObject({
      organizationId: orgA,
      actorType: "user",
      actorId: userA.userId,
      entityType: "organization",
      entityId: orgA,
      safeDiff: { name: { from: "Org A", to: "Nytt navn AS" } },
    });
    expect(event.occurredAt).toBeGreaterThanOrEqual(before);
    expect(event.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("ingen endring gir ingen hendelse", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    await t.withIdentity(userA.identity).mutation(api.organizations.mutations.rename, { organizationId: orgA, name: "Org A" });
    expect(await auditOf(t)).toEqual([]);
  });

  test("invitasjon, tilbakekalling og aksept logges uten e-post og token", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const invitee = await createUser(t, "ny@eksempel.example");
    const asA = t.withIdentity(userA.identity);
    const revoked = await asA.mutation(api.invitations.mutations.create, { organizationId: orgA, email: "borte@eksempel.example" });
    await asA.mutation(api.invitations.mutations.revoke, { organizationId: orgA, invitationId: revoked.invitationId });
    const { invitationId } = await asA.mutation(api.invitations.mutations.create, { organizationId: orgA, email: "ny@eksempel.example" });
    const tokenHash = "a".repeat(64);
    await t.mutation(internal.invitations.internal.attachToken, { invitationId, tokenHash });
    await t.mutation(internal.invitations.internal.consumeForUser, { invitationId, tokenHash, userId: invitee.userId });

    const events = await auditOf(t);
    expect(events.map((e) => e.eventType)).toEqual([
      "invitation.created",
      "invitation.revoked",
      "invitation.created",
      "membership.created",
      "invitation.accepted",
    ]);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("eksempel.example");
    expect(serialized).not.toContain(tokenHash);
    const accepted = events.find((e) => e.eventType === "invitation.accepted")!;
    expect(accepted).toMatchObject({ actorId: invitee.userId, safeDiff: { status: { from: "pending", to: "accepted" } } });
  });

  test("operatør-bootstrap logges som system", async () => {
    const t = setupTest();
    const { organizationId } = await t.mutation(internal.ops.workspaces.provision, {
      organizationName: "Ny Kunde AS",
      adminEmail: "admin@kunde.example",
    });
    const events = await auditOf(t);
    expect(events.map((e) => [e.eventType, e.actorType, e.organizationId])).toEqual([
      ["organization.provisioned", "system", organizationId],
      ["invitation.created", "system", organizationId],
    ]);
    expect(JSON.stringify(events)).not.toContain("kunde.example");
  });
});

describe("atomisk: feil gir verken endring eller logg", () => {
  test("kastet feil etter audit-skriving ruller tilbake både endring og logg", async () => {
    const t = setupTest();
    const { orgA } = await twoTenants(t);
    await expect(
      t.run(async (ctx) => {
        await ctx.db.patch("organizations", orgA, { name: "Endret" });
        await writeAudit(ctx, {
          organizationId: orgA,
          actor: { type: "system" },
          eventType: "organization.renamed",
          entityType: "organization",
          entityId: orgA,
          before: { name: "Org A" },
          after: { name: "Endret" },
        });
        throw new Error("bevisst");
      }),
    ).rejects.toThrow("bevisst");
    expect((await t.run((ctx) => ctx.db.get("organizations", orgA)))?.name).toBe("Org A");
    expect(await auditOf(t)).toEqual([]);
  });

  test("feil i audit-skrivingen (fremmed tenant) ruller tilbake endringen", async () => {
    const t = setupTest();
    const { orgA, orgB, userA, membershipA } = await twoTenants(t);
    const tenant = { organizationId: orgA, userId: userA.userId, role: "admin" as const, membershipId: membershipA };
    await expect(
      t.run(async (ctx) => {
        const db = wrapDatabaseWriter({}, ctx.db, tenantRules(tenant), RLS_CONFIG);
        await db.patch("organizations", orgA, { name: "Endret" });
        await writeAudit({ db }, {
          organizationId: orgB, // RLS nekter innsetting i annen organisasjon
          actor: { type: "user", id: userA.userId },
          eventType: "organization.renamed",
          entityType: "organization",
          entityId: orgA,
        });
      }),
    ).rejects.toThrow();
    expect((await t.run((ctx) => ctx.db.get("organizations", orgA)))?.name).toBe("Org A");
    expect(await auditOf(t)).toEqual([]);
  });
});

describe("append-only og tenantvern", () => {
  test("RLS nekter endring og sletting av logg for alle byggeklosser", async () => {
    const t = setupTest();
    const { userA, orgA, membershipA } = await twoTenants(t);
    await t.withIdentity(userA.identity).mutation(api.organizations.mutations.rename, { organizationId: orgA, name: "X" });
    const [event] = await auditOf(t);
    const tenant = { organizationId: orgA, userId: userA.userId, role: "admin" as const, membershipId: membershipA };
    const ruleSets = [
      tenantRules(tenant),
      userRules(userA.userId, new Set([orgA])),
      invitationRules({ invitationId: "i" as never, organizationId: orgA, userId: userA.userId }),
    ];
    for (const rules of ruleSets) {
      await t.run(async (ctx) => {
        const db = wrapDatabaseWriter({}, ctx.db, rules, RLS_CONFIG);
        await expect(db.patch("auditEvents", event._id, { reason: "omskrevet" })).rejects.toThrow();
        await expect(db.delete("auditEvents", event._id)).rejects.toThrow();
      });
    }
    expect(await auditOf(t)).toEqual([event]);
  });

  test("fremmed kunde ser ikke loggen, verken via query eller innpakket lesing", async () => {
    const t = setupTest();
    const { userA, userB, orgA, orgB, membershipB } = await twoTenants(t);
    await t.withIdentity(userA.identity).mutation(api.organizations.mutations.rename, { organizationId: orgA, name: "A2" });
    await t.withIdentity(userB.identity).mutation(api.organizations.mutations.rename, { organizationId: orgB, name: "B2" });
    const page = { paginationOpts: { numItems: 10, cursor: null } };
    const forA = await t.withIdentity(userA.identity).query(api.audit.queries.list, { organizationId: orgA, ...page });
    expect(forA.page.map((e) => e.safeDiff.name?.to)).toEqual(["A2"]);
    await expectAppError(t.withIdentity(userB.identity).query(api.audit.queries.list, { organizationId: orgA, ...page }), "NOT_FOUND");
    const tenantB = { organizationId: orgB, userId: userB.userId, role: "admin" as const, membershipId: membershipB };
    await t.run(async (ctx) => {
      const db = wrapDatabaseReader({}, ctx.db, tenantRules(tenantB), RLS_CONFIG);
      expect((await db.query("auditEvents").collect()).map((e) => e.organizationId)).toEqual([orgB]);
    });
  });

  test("filter og paginering, nyeste først", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const asA = t.withIdentity(userA.identity);
    for (const name of ["N1", "N2", "N3"]) {
      vi.advanceTimersByTime(1000);
      await asA.mutation(api.organizations.mutations.rename, { organizationId: orgA, name });
    }
    await asA.mutation(api.invitations.mutations.create, { organizationId: orgA, email: "x@y.example" });
    const first = await asA.query(api.audit.queries.list, {
      organizationId: orgA,
      entityType: "organization",
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(first.page.map((e) => e.safeDiff.name?.to)).toEqual(["N3", "N2"]);
    expect(first.page[0].actor).toBe("a@tenant-a.example");
    const second = await asA.query(api.audit.queries.list, {
      organizationId: orgA,
      entityType: "organization",
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect(second.page.map((e) => e.safeDiff.name?.to)).toEqual(["N1"]);
    expect(second.isDone).toBe(true);
  });
});

describe("trygg diff", () => {
  test("bare tillatte felter, aldri passord, token, e-post eller fritekst", () => {
    const before = { status: "pending", email: "a@b.example", tokenHash: "x", password: "hemmelig", expiresAt: 1 };
    const after = { status: "accepted", email: "c@d.example", tokenHash: "y", password: "nytt", expiresAt: 2, note: "fritekst" };
    const diff = safeDiff("invitation", before, after);
    expect(Object.keys(diff).sort()).toEqual(["expiresAt", "status"]);
    for (const [entity, fields] of Object.entries(AUDIT_DIFF_FIELDS)) {
      expect(fields, entity).not.toEqual(expect.arrayContaining(["email", "password", "token", "tokenHash"]));
    }
  });

  test("objekter og lister logges ikke", () => {
    expect(safeDiff("organization", { name: "A" }, { name: { nested: true } })).toEqual({ name: { from: "A" } });
  });
});
