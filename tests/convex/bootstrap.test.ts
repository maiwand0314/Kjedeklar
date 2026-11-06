import { describe, expect, test } from "vitest";
import { internal } from "../../convex/_generated/api";
import { createOrganization, createUser, setupTest } from "./setup";

describe("kontrollert bootstrap", () => {
  test("to workspaces med samme navn blir to separate organisasjoner", async () => {
    const t = setupTest();
    const first = await createUser(t, "forste@kunde-1.example");
    const second = await createUser(t, "andre@kunde-2.example");

    const orgFirst = await t.mutation(internal.ops.organizations.createWorkspace, {
      name: "Nordic Trading AS",
      country: "NO",
      userId: first.userId,
    });
    const orgSecond = await t.mutation(internal.ops.organizations.createWorkspace, {
      name: "Nordic Trading AS",
      country: "NO",
      userId: second.userId,
    });

    expect(orgSecond).not.toBe(orgFirst);
    const firstOrgs = await t.query(internal.ops.organizations.organizationIdsForUser, {
      userId: first.userId,
    });
    const secondOrgs = await t.query(internal.ops.organizations.organizationIdsForUser, {
      userId: second.userId,
    });
    expect(firstOrgs).toEqual([orgFirst]);
    expect(secondOrgs).toEqual([orgSecond]);
  });

  test("setMembership krever eksplisitt organisasjon og er idempotent", async () => {
    const t = setupTest();
    const user = await createUser(t, "medlem@kunde-3.example");
    const org = await createOrganization(t, "Kunde 3");
    const setMembership = internal.ops.organizations.setMembership;

    const id1 = await t.mutation(setMembership, { organizationId: org, userId: user.userId, status: "active" });
    const id2 = await t.mutation(setMembership, { organizationId: org, userId: user.userId, status: "inactive" });
    expect(id2).toBe(id1);
    const memberships = await t.run((ctx) => ctx.db.query("memberships").collect());
    expect(memberships).toHaveLength(1);
    expect(memberships[0].status).toBe("inactive");
  });

  test("setMembership avviser ukjent organisasjon", async () => {
    const t = setupTest();
    const user = await createUser(t, "x@kunde-4.example");
    const ghost = await createOrganization(t, "Borte");
    await t.run((ctx) => ctx.db.delete("organizations", ghost));
    await expect(
      t.mutation(internal.ops.organizations.setMembership, {
        organizationId: ghost,
        userId: user.userId,
        status: "active",
      }),
    ).rejects.toThrow(/finnes ikke/);
  });
});
