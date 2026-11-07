/**
 * Kontolivssyklus mot lokal Convex-backend og Mailpit: invitasjon, verifisering,
 * passordreset, sesjonstilbakekalling, origin og ratebegrensning.
 */
import { spawnSync } from "node:child_process";
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import {
  anonymousClient,
  clientWithToken,
  errorOf,
  proxyHeaders,
  randomTestIp,
  runInternal,
  setupTwoTenants,
  signIn,
  TEST_BACKEND,
  testProxySecret,
  type TwoTenants,
} from "../helpers/local-backend";
import { fragmentTokenFrom, invitationTokenFrom, messagesTo, uniqueEmail, waitForEmail } from "../helpers/mailpit";

const { create, revoke, acceptAsCurrentUser } = api.invitations.mutations;
const { lookup } = api.invitations.queries;
const { acceptWithNewAccount } = api.invitations.actions;
const listMine = api.organizations.queries.listMine;

/** Hemmeligheter brukt i testene. Ingen av dem skal finnes i logger. */
const secretsUsed = new Set<string>();
const remember = (value: string) => {
  secretsUsed.add(value);
  return value;
};
const newPassword = () => remember(`Pw-${Math.random().toString(36).slice(2)}-${Date.now()}`);

async function inviteAndGetToken(env: TwoTenants, email: string) {
  const { invitationId } = await env.a.mutation(create, { organizationId: env.fx.orgA, email });
  const mail = await waitForEmail(email, "Invitasjon til");
  return { invitationId, token: remember(invitationTokenFrom(mail.text)) };
}

function authPost(path: string, body: unknown, headers: Record<string, string> = proxyHeaders()) {
  return fetch(`${TEST_BACKEND.siteUrl}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("invitasjon", () => {
  let env: TwoTenants;
  beforeAll(async () => {
    env = await setupTwoTenants();
  });

  test("invitasjon → e-post → velg passord → innlogging gir admin-tilgang", async () => {
    const email = uniqueEmail("ny-admin");
    const { token } = await inviteAndGetToken(env, email);
    expect(await anonymousClient().query(lookup, { token })).toMatchObject({
      email,
      accountExists: false,
      organizationName: expect.stringMatching(/^Org A /),
    });
    const password = newPassword();
    const result = await anonymousClient().action(acceptWithNewAccount, { token, name: "Ny Admin", password });
    expect(result).toEqual({ organizationId: env.fx.orgA, email });
    const session = await signIn(email, password);
    expect((await clientWithToken(session.token).query(listMine, {})).map((o) => o.id)).toEqual([env.fx.orgA]);

    // Brukt lenke: alle veier gir samme avslag, og ingen ny konto/medlemskap.
    expect((await errorOf(anonymousClient().query(lookup, { token }))).code).toBe("INVITATION_INVALID");
    expect(
      (await errorOf(anonymousClient().action(acceptWithNewAccount, { token, name: "X", password: newPassword() })))
        .code,
    ).toBe("INVITATION_INVALID");
    expect((await errorOf(clientWithToken(session.token).mutation(acceptAsCurrentUser, { token }))).code).toBe(
      "INVITATION_INVALID",
    );
  });

  test("feil mottaker får ingen medlemskap", async () => {
    const { token } = await inviteAndGetToken(env, uniqueEmail("riktig"));
    expect((await errorOf(env.b.mutation(acceptAsCurrentUser, { token }))).code).toBe("INVITATION_INVALID");
    expect((await env.b.query(listMine, {})).map((o) => o.id)).not.toContain(env.fx.orgA);
    // Lenken er fortsatt gyldig for riktig mottaker.
    expect((await anonymousClient().query(lookup, { token })).accountExists).toBe(false);
  });

  test("utløpt og tilbakekalt invitasjon gir ingen medlemskap", async () => {
    const expired = await inviteAndGetToken(env, uniqueEmail("utlopt"));
    runInternal("ops/testing:expireInvitation", { invitationId: expired.invitationId });
    const revoked = await inviteAndGetToken(env, uniqueEmail("tilbakekalt"));
    await env.a.mutation(revoke, { organizationId: env.fx.orgA, invitationId: revoked.invitationId });
    for (const { token } of [expired, revoked]) {
      const r = await errorOf(anonymousClient().action(acceptWithNewAccount, { token, name: "X", password: newPassword() }));
      expect(r.code).toBe("INVITATION_INVALID");
    }
  });

  test("eksisterende konto må logge inn; aksept gir medlemskap", async () => {
    const { token } = await inviteAndGetToken(env, env.fx.userB.email);
    expect((await anonymousClient().query(lookup, { token })).accountExists).toBe(true);
    expect(
      (await errorOf(anonymousClient().action(acceptWithNewAccount, { token, name: "X", password: newPassword() }))).code,
    ).toBe("ACCOUNT_EXISTS");
    expect(await env.b.mutation(acceptAsCurrentUser, { token })).toEqual({ organizationId: env.fx.orgA });
    expect((await env.b.query(listMine, {})).map((o) => o.id)).toContain(env.fx.orgA);
  });

  test("to samtidige akseptforsøk gir én konto og ett medlemskap", async () => {
    const email = uniqueEmail("samtidig");
    const { token } = await inviteAndGetToken(env, email);
    const passwords = [newPassword(), newPassword()];
    const results = await Promise.all(
      passwords.map((password) =>
        errorOf(anonymousClient().action(acceptWithNewAccount, { token, name: "Samtidig", password })),
      ),
    );
    const winners = results.map((r, i) => (r.code === "OK" ? i : -1)).filter((i) => i >= 0);
    expect(winners, JSON.stringify(results)).toHaveLength(1);
    const loser = results.find((r) => r.code !== "OK")!;
    expect(["INVITATION_INVALID", "ACCOUNT_EXISTS"]).toContain(loser.code);
    const session = await signIn(email, passwords[winners[0]]);
    expect((await clientWithToken(session.token).query(listMine, {})).map((o) => o.id)).toEqual([env.fx.orgA]);
  });

  test("samtidig aksept for innlogget bruker gir ett medlemskap", async () => {
    const env2 = await setupTwoTenants();
    const { invitationId } = await env2.a.mutation(create, { organizationId: env2.fx.orgA, email: env2.fx.userB.email });
    const token = remember(invitationTokenFrom((await waitForEmail(env2.fx.userB.email, "Invitasjon til")).text));
    const results = await Promise.all([0, 1].map(() => errorOf(env2.b.mutation(acceptAsCurrentUser, { token }))));
    expect(results.filter((r) => r.code === "OK"), JSON.stringify(results)).toHaveLength(1);
    const mine = (await env2.b.query(listMine, {})).map((o) => o.id);
    expect(mine.filter((id) => id === env2.fx.orgA)).toHaveLength(1);
    expect(invitationId).toBeTruthy();
  });

  test("vanlig bruker kan ikke invitere til fremmed organisasjon eller velge rolle", async () => {
    const env = await setupTwoTenants(); // B er ikke medlem av A her
    const r = await errorOf(env.b.mutation(create, { organizationId: env.fx.orgA, email: uniqueEmail("x") }));
    expect(r.code).toBe("NOT_FOUND");
    // Ekstra felt (rolle) avvises av argumentvalidatoren; backenden skjuler detaljene.
    const roleEmail = uniqueEmail("rolle");
    const withRole = await errorOf(
      env.a.mutation(create, { organizationId: env.fx.orgA, email: roleEmail, role: "owner" } as never),
    );
    expect(withRole.code).not.toBe("OK");
    const list = await env.a.query(api.invitations.queries.listForOrganization, { organizationId: env.fx.orgA });
    expect(list.map((i) => i.email)).not.toContain(roleEmail);
  });
});

describe("e-postverifisering", () => {
  test("ubekreftet konto kan ikke logge inn før lenken er åpnet", async () => {
    const email = uniqueEmail("ubekreftet");
    const password = newPassword();
    runInternal("ops/testing:createUnverifiedUser", { email, password });
    await expect(signIn(email, password)).rejects.toThrow(/Innlogging feilet: 403/);
    const mail = await waitForEmail(email, "Bekreft");
    // Lenken går til appen med token bare i fragmentet; siden sender det til Convex i body.
    const token = remember(fragmentTokenFrom(mail.text, "/bekreft-epost"));
    expect(await anonymousClient().action(api.account.actions.verifyEmail, { token: "ugyldig-token-1234567890" })).toEqual({ ok: false });
    expect(await anonymousClient().action(api.account.actions.verifyEmail, { token })).toEqual({ ok: true });
    expect((await signIn(email, password)).token).toBeTruthy();
  });
});

describe("passordreset", () => {
  let env: TwoTenants;
  beforeAll(async () => {
    env = await setupTwoTenants();
  });

  test("reset virker, logger ut alle sesjoner, og lenken kan ikke brukes igjen", async () => {
    const email = env.fx.userB.email;
    const before = await messagesTo(email);
    const response = await authPost("/request-password-reset", { email, redirectTo: "/tilbakestill-passord" });
    expect(response.status).toBe(200);
    const mail = await waitForEmail(email, "Tilbakestill", { notIds: before.map((m) => m.ID) });
    const token = remember(fragmentTokenFrom(mail.text, "/tilbakestill-passord"));

    const password = newPassword();
    expect((await authPost("/reset-password", { newPassword: password, token })).status).toBe(200);

    // Den gamle sesjonen er tilbakekalt: cookie gir ikke nytt token, og et allerede
    // utstedt Convex-token avvises fordi sesjonen er borte.
    const oldCookieToken = await fetch(`${TEST_BACKEND.siteUrl}/api/auth/convex/token`, {
      headers: { cookie: env.sessionB.cookie, origin: TEST_BACKEND.appOrigin },
    });
    expect(oldCookieToken.status).not.toBe(200);
    expect((await errorOf(env.b.query(listMine, {}))).code).toBe("UNAUTHENTICATED");

    await expect(signIn(email, env.fx.password)).rejects.toThrow(/Innlogging feilet: 401/);
    expect((await signIn(email, password)).token).toBeTruthy();

    const reuse = await authPost("/reset-password", { newPassword: newPassword(), token });
    expect(reuse.status).toBe(400);
  });

  test("ukjent adresse gir samme svar og ingen e-post (ingen kontooppslag)", async () => {
    const known = await authPost("/request-password-reset", { email: env.fx.userA.email, redirectTo: "/tilbakestill-passord" });
    const unknownEmail = uniqueEmail("finnes-ikke");
    const unknown = await authPost("/request-password-reset", { email: unknownEmail, redirectTo: "/tilbakestill-passord" });
    expect(unknown.status).toBe(known.status);
    expect(await unknown.text()).toBe(await known.text());
    await new Promise((r) => setTimeout(r, 1500));
    expect(await messagesTo(unknownEmail)).toEqual([]);
  });
});

describe("origin og ratebegrensning", () => {
  test("ugyldig origin og fremmed omdirigering avvises", async () => {
    const env = await setupTwoTenants();
    const evil = { ...proxyHeaders(), origin: "https://evil.example" };
    // Innlogging fra fremmed origin.
    const signInEvil = await authPost("/sign-in/email", { email: env.fx.userA.email, password: env.fx.password }, evil);
    expect(signInEvil.status).toBe(403);
    // Cookie-autentisert forespørsel (CSRF): utlogging fra fremmed origin.
    const signOutEvil = await authPost("/sign-out", {}, { ...evil, cookie: env.sessionA.cookie });
    expect(signOutEvil.status).toBe(403);
    expect((await env.a.query(listMine, {})).length).toBe(1); // fortsatt innlogget
    // Reset med omdirigering til fremmed domene.
    const resetEvil = await authPost("/request-password-reset", {
      email: env.fx.userA.email,
      redirectTo: "https://evil.example/stjel",
    });
    expect(resetEvil.status).toBe(403);
  });

  test("innlogging begrenses per klient-IP, ikke for alle", async () => {
    const env = await setupTwoTenants();
    const attacker = randomTestIp();
    const wrong = { email: env.fx.userA.email, password: "feil-passord-123" };
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await authPost("/sign-in/email", wrong, proxyHeaders(attacker))).status);
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
    // En annen bruker fra en annen IP logger fortsatt inn.
    expect((await signIn(env.fx.userB.email, env.fx.password)).token).toBeTruthy();
  });

  test("forfalsket klient-IP uten proxy-hemmelighet gir ikke egne bøtter", async () => {
    const env = await setupTwoTenants();
    const wrong = { email: env.fx.userA.email, password: "feil-passord-123" };
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      // Ny «IP» hver gang, men uten hemmelighet: alle havner i samme felles bøtte.
      const headers = { origin: TEST_BACKEND.appOrigin, "x-kjedeklar-client-ip": randomTestIp() };
      statuses.push((await authPost("/sign-in/email", wrong, headers)).status);
    }
    expect(statuses).toContain(429);
    // Med feil hemmelighet blir det heller ikke egen bøtte.
    const wrongSecret = { ...proxyHeaders(), "x-kjedeklar-proxy-secret": `${testProxySecret()}x` };
    expect((await authPost("/sign-in/email", wrong, wrongSecret)).status).toBe(429);
  });
});

describe("logger", () => {
  test("ingen token eller passord fra testene står i backend-loggene", () => {
    const functionLogs = spawnSync(
      "pnpm",
      ["exec", "convex", "logs", "--history", "2000", "--jsonl", "--env-file", TEST_BACKEND.envFile],
      { encoding: "utf8", timeout: 15_000 },
    );
    const serverLogs = spawnSync("docker", ["compose", "logs", "--no-color", "convex-test"], {
      encoding: "utf8",
      timeout: 15_000,
    });
    const logs = `${functionLogs.stdout ?? ""}\n${serverLogs.stdout ?? ""}`;
    expect(logs.length).toBeGreaterThan(0);
    const leaked = [...secretsUsed].filter((s) => s.length >= 12 && logs.includes(s));
    expect(leaked).toEqual([]);
  });
});
