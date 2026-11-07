import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { sha256Hex } from "../../convex/email/seal";
import {
  addMembership,
  createOrganization,
  createUser,
  expectAppError,
  setupTest,
  twoTenants,
  type TestConvex,
} from "./setup";

// Falske timere: convex-test kjører ellers den planlagte e-postjobben
// (sendInvitation) med ekte setTimeout, og den lager et nytt token som
// overskriver hashen testen bruker. Her lager testen tokenet selv (issueToken).
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const { create, revoke, acceptAsCurrentUser } = api.invitations.mutations;
const { lookup, listForOrganization } = api.invitations.queries;

/** Et token i samme format som e-postjobben lager (32 byte base64url). */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Gjør det e-postjobben gjør: lager token og lagrer bare hashen. */
async function issueToken(t: TestConvex, invitationId: Id<"invitations">): Promise<string> {
  const token = newToken();
  const result = await t.mutation(internal.invitations.internal.attachToken, {
    invitationId,
    tokenHash: await sha256Hex(token),
  });
  if (!result) throw new Error("Invitasjonen venter ikke");
  return token;
}

async function invite(t: TestConvex, asAdmin: ReturnType<TestConvex["withIdentity"]>, orgId: string, email: string) {
  const { invitationId } = await asAdmin.mutation(create, { organizationId: orgId, email });
  return { invitationId, token: await issueToken(t, invitationId) };
}

async function membershipsOf(t: TestConvex, userId: string) {
  return await t.run((ctx) =>
    ctx.db.query("memberships").withIndex("by_userId", (q) => q.eq("userId", userId)).collect(),
  );
}

describe("opprette og tilbakekalle invitasjoner", () => {
  test("admin inviterer; e-post normaliseres og rått token lagres aldri", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const asA = t.withIdentity(userA.identity);
    const { invitationId } = await asA.mutation(create, { organizationId: orgA, email: "  Ny.Person@Eksempel.Example " });
    const stored = await t.run((ctx) => ctx.db.get("invitations", invitationId));
    expect(stored).toMatchObject({ email: "ny.person@eksempel.example", status: "pending", invitedBy: userA.userId });
    expect(stored?.tokenHash).toBeUndefined(); // settes av e-postjobben
    const token = await issueToken(t, invitationId);
    const afterSend = await t.run((ctx) => ctx.db.get("invitations", invitationId));
    expect(afterSend?.tokenHash).toBe(await sha256Hex(token));
    expect(JSON.stringify(afterSend)).not.toContain(token);
  });

  test("ny invitasjon til samme adresse fornyer den ventende og ugyldiggjør gammel lenke", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const asA = t.withIdentity(userA.identity);
    const first = await invite(t, asA, orgA, "dobbel@eksempel.example");
    const second = await asA.mutation(create, { organizationId: orgA, email: "dobbel@eksempel.example" });
    expect(second.invitationId).toBe(first.invitationId);
    await expectAppError(t.query(lookup, { token: first.token }), "INVITATION_INVALID");
  });

  test("ugyldig e-post og eksisterende medlem avvises", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const asA = t.withIdentity(userA.identity);
    await expectAppError(asA.mutation(create, { organizationId: orgA, email: "ikke-epost" }), "INVALID_INPUT");
    await expectAppError(asA.mutation(create, { organizationId: orgA, email: "A@Tenant-A.example" }), "ALREADY_MEMBER");
  });

  test("ikke-medlem kan ikke invitere til eller liste en annen organisasjon", async () => {
    const t = setupTest();
    const { userB, orgA } = await twoTenants(t);
    const asB = t.withIdentity(userB.identity);
    await expectAppError(asB.mutation(create, { organizationId: orgA, email: "x@y.example" }), "NOT_FOUND");
    await expectAppError(asB.query(listForOrganization, { organizationId: orgA }), "NOT_FOUND");
  });

  test("tilbakekalling: egen virker, fremmed gir NOT_FOUND", async () => {
    const t = setupTest();
    const { userA, userB, orgA, orgB } = await twoTenants(t);
    const asA = t.withIdentity(userA.identity);
    const { invitationId, token } = await invite(t, asA, orgA, "tilbake@eksempel.example");
    await expectAppError(
      t.withIdentity(userB.identity).mutation(revoke, { organizationId: orgB, invitationId }),
      "NOT_FOUND",
    );
    await asA.mutation(revoke, { organizationId: orgA, invitationId });
    await expectAppError(t.query(lookup, { token }), "INVITATION_INVALID");
    const list = await asA.query(listForOrganization, { organizationId: orgA });
    expect(list.map((i) => i.status)).toEqual(["revoked"]);
  });
});

describe("forhåndsvisning og aksept", () => {
  test("forhåndsvisning viser organisasjon og mottaker til den som har lenken", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const { token } = await invite(t, t.withIdentity(userA.identity), orgA, "ny@eksempel.example");
    expect(await t.query(lookup, { token })).toMatchObject({
      organizationName: "Org A",
      email: "ny@eksempel.example",
      accountExists: false,
    });
  });

  test("ukjent, misdannet, utløpt og tilbakekalt token gir identisk avslag", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const asA = t.withIdentity(userA.identity);
    const expired = await invite(t, asA, orgA, "utlopt@eksempel.example");
    await t.run((ctx) => ctx.db.patch("invitations", expired.invitationId, { expiresAt: Date.now() - 1 }));
    const revoked = await invite(t, asA, orgA, "tilbakekalt@eksempel.example");
    await asA.mutation(revoke, { organizationId: orgA, invitationId: revoked.invitationId });
    const errors = [];
    for (const token of [newToken(), "kort", `${"x".repeat(43)}!`, expired.token, revoked.token]) {
      const promise = t.query(lookup, { token });
      await expectAppError(promise, "INVITATION_INVALID");
      errors.push(await promise.catch((e: { data: unknown }) => e.data));
    }
    for (const data of errors) expect(data).toEqual(errors[0]);
  });

  test("innlogget mottaker med verifisert e-post blir admin; lenken kan ikke brukes igjen", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const invitee = await createUser(t, "mottaker@eksempel.example");
    const { invitationId, token } = await invite(t, t.withIdentity(userA.identity), orgA, "Mottaker@Eksempel.example");
    const asInvitee = t.withIdentity(invitee.identity);
    expect(await asInvitee.mutation(acceptAsCurrentUser, { token })).toEqual({ organizationId: orgA });
    expect(await membershipsOf(t, invitee.userId)).toMatchObject([
      { organizationId: orgA, role: "admin", status: "active" },
    ]);
    const stored = await t.run((ctx) => ctx.db.get("invitations", invitationId));
    expect(stored).toMatchObject({ status: "accepted", acceptedBy: invitee.userId });
    expect(stored?.tokenHash).toBeUndefined();
    await expectAppError(asInvitee.mutation(acceptAsCurrentUser, { token }), "INVITATION_INVALID");
    expect(await membershipsOf(t, invitee.userId)).toHaveLength(1);
  });

  test("feil mottaker eller ubekreftet e-post gir ingen tilgang", async () => {
    const t = setupTest();
    const { userA, userB, orgA } = await twoTenants(t);
    const unverified = await createUser(t, "ubekreftet@eksempel.example", { emailVerified: false });
    const asA = t.withIdentity(userA.identity);
    const forOther = await invite(t, asA, orgA, "annen@eksempel.example");
    await expectAppError(
      t.withIdentity(userB.identity).mutation(acceptAsCurrentUser, { token: forOther.token }),
      "INVITATION_INVALID",
    );
    const forUnverified = await invite(t, asA, orgA, "ubekreftet@eksempel.example");
    await expectAppError(
      t.withIdentity(unverified.identity).mutation(acceptAsCurrentUser, { token: forUnverified.token }),
      "INVITATION_INVALID",
    );
    expect(await membershipsOf(t, userB.userId)).toHaveLength(1); // bare egen org B
    expect(await membershipsOf(t, unverified.userId)).toHaveLength(0);
  });

  test("uinnlogget aksept avvises", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const { token } = await invite(t, t.withIdentity(userA.identity), orgA, "x@eksempel.example");
    await expectAppError(t.mutation(acceptAsCurrentUser, { token }), "UNAUTHENTICATED");
  });

  test("tidligere deaktivert medlem reaktiveres i stedet for å få duplikat", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const returning = await createUser(t, "tilbake@eksempel.example");
    await addMembership(t, orgA, returning.userId, "inactive");
    const { token } = await invite(t, t.withIdentity(userA.identity), orgA, "tilbake@eksempel.example");
    await t.withIdentity(returning.identity).mutation(acceptAsCurrentUser, { token });
    expect(await membershipsOf(t, returning.userId)).toMatchObject([{ organizationId: orgA, status: "active" }]);
  });

  test("forbruk for ny konto validerer token på nytt og kan bare skje én gang", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const { invitationId, token } = await invite(t, t.withIdentity(userA.identity), orgA, "ny@eksempel.example");
    const tokenHash = await sha256Hex(token);
    const consume = internal.invitations.internal.consumeForUser;
    await expect(t.mutation(consume, { invitationId, tokenHash: "feil", userId: "u1" })).rejects.toThrow();
    await t.mutation(consume, { invitationId, tokenHash, userId: "u1" });
    await expect(t.mutation(consume, { invitationId, tokenHash, userId: "u2" })).rejects.toThrow();
    expect(await membershipsOf(t, "u2")).toHaveLength(0);
  });
});

describe("operatør-bootstrap", () => {
  test("provision lager ny organisasjon uten medlemmer og en ventende invitasjon", async () => {
    const t = setupTest();
    const existing = await createOrganization(t, "Samme Navn AS");
    const result = await t.mutation(internal.ops.workspaces.provision, {
      organizationName: "Samme Navn AS",
      adminEmail: "Forste.Admin@Kunde.example",
    });
    expect(result.organizationId).not.toBe(existing);
    const [memberships, invitation] = await t.run(async (ctx) => [
      await ctx.db.query("memberships").collect(),
      await ctx.db.get("invitations", result.invitationId),
    ]);
    expect(memberships).toEqual([]);
    expect(invitation).toMatchObject({
      organizationId: result.organizationId,
      email: "forste.admin@kunde.example",
      status: "pending",
    });
  });
});
