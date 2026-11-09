import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { emptyAnswers } from "../../src/domain/reporting/profile";
import { SYNTHETIC_PERIOD, SYNTHETIC_PROFILE_ANSWERS } from "../helpers/public-functions";
import { expectAppError, setupTest, twoTenants, type TestConvex } from "./setup";

const { create, list } = api.organizations.reportingPeriods;
const { save, current } = api.organizations.businessProfile;

type Fixture = Awaited<ReturnType<typeof twoTenants>>;
const asA = (t: TestConvex, fx: Fixture) => t.withIdentity(fx.userA.identity);
const asB = (t: TestConvex, fx: Fixture) => t.withIdentity(fx.userB.identity);
const periods = (t: TestConvex) => t.run((ctx) => ctx.db.query("reportingPeriods").collect());
const revisions = (t: TestConvex) => t.run((ctx) => ctx.db.query("businessProfileRevisions").collect());
const auditRows = (t: TestConvex) => t.run((ctx) => ctx.db.query("auditEvents").collect());

/** Fritekst som aldri skal havne i revisjonsloggen. */
const SECRET_TEXT = "Syntetisk fritekst som ikke skal i loggen";

async function withPeriod() {
  const t = setupTest();
  const fx = await twoTenants(t);
  const periodId = await asA(t, fx).mutation(create, { organizationId: fx.orgA, ...SYNTHETIC_PERIOD });
  return { t, fx, periodId };
}

describe("rapportperiode", () => {
  test("opprettes som åpen periode med datoene som tekst, og logges", async () => {
    const { t, fx, periodId } = await withPeriod();
    const [row] = await periods(t);
    expect(row).toMatchObject({ _id: periodId, organizationId: fx.orgA, ...SYNTHETIC_PERIOD, status: "open", createdBy: fx.userA.userId });
    const [event] = await auditRows(t);
    expect(event).toMatchObject({
      organizationId: fx.orgA,
      actorId: fx.userA.userId,
      eventType: "reporting_period.created",
      entityType: "reportingPeriod",
      entityId: periodId,
      safeDiff: {
        startDate: { to: "2025-01-01" },
        endDate: { to: "2025-12-31" },
        publicationDueDate: { to: "2026-06-30" },
        status: { to: "open" },
      },
    });
  });

  test("avvikende regnskapsår lagres, og listen er nyeste først", async () => {
    const { t, fx } = await withPeriod();
    await asA(t, fx).mutation(create, {
      organizationId: fx.orgA,
      startDate: "2025-07-01",
      endDate: "2026-06-30",
      publicationDueDate: "2026-12-31",
    });
    const rows = await asA(t, fx).query(list, { organizationId: fx.orgA });
    expect(rows.map((p) => `${p.startDate}/${p.endDate}`)).toEqual(["2025-07-01/2026-06-30", "2025-01-01/2025-12-31"]);
  });

  test("samme start og slutt kan bare finnes én gang per organisasjon, men i flere organisasjoner", async () => {
    const { t, fx } = await withPeriod();
    await expectAppError(
      asA(t, fx).mutation(create, { organizationId: fx.orgA, ...SYNTHETIC_PERIOD, publicationDueDate: "2026-09-30" }),
      "PERIOD_EXISTS",
    );
    await asB(t, fx).mutation(create, { organizationId: fx.orgB, ...SYNTHETIC_PERIOD });
    expect((await periods(t)).map((p) => p.organizationId).sort()).toEqual([fx.orgA, fx.orgB].sort());
    expect(await asB(t, fx).query(list, { organizationId: fx.orgB })).toHaveLength(1);
  });

  test.each([
    ["slutt før start", { startDate: "2025-12-31", endDate: "2025-01-01" }],
    ["dato som ikke finnes", { endDate: "2025-02-30" }],
    ["frist før periodens slutt", { publicationDueDate: "2025-06-30" }],
    ["tidsstempel i stedet for dato", { startDate: "2025-01-01T00:00:00.000Z" }],
  ])("%s avvises på serveren uten at noe lagres", async (_name, patch) => {
    const t = setupTest();
    const fx = await twoTenants(t);
    await expectAppError(asA(t, fx).mutation(create, { organizationId: fx.orgA, ...SYNTHETIC_PERIOD, ...patch }), "INVALID_INPUT");
    expect(await periods(t)).toEqual([]);
    expect(await auditRows(t)).toEqual([]);
  });
});

describe("virksomhetsprofil", () => {
  test("uten lagret profil er siste versjon tom, ikke en antatt profil", async () => {
    const { t, fx, periodId } = await withPeriod();
    const result = await asA(t, fx).query(current, { organizationId: fx.orgA, reportingPeriodId: periodId });
    expect(result).toEqual({ period: { id: periodId, ...SYNTHETIC_PERIOD }, latest: null, history: [] });
  });

  test("ny lagring er ny versjon; den gamle endres ikke", async () => {
    const { t, fx, periodId } = await withPeriod();
    const args = { organizationId: fx.orgA, reportingPeriodId: periodId };
    const first = await asA(t, fx).mutation(save, { ...args, answers: SYNTHETIC_PROFILE_ANSWERS, confirmed: false, expectedRevision: 0 });
    expect(first.revision).toBe(1);
    const [stored] = await revisions(t);

    const changed = { ...SYNTHETIC_PROFILE_ANSWERS, policies: { status: "described" as const, text: "Vedtatt av styret (syntetisk)." } };
    const second = await asA(t, fx).mutation(save, { ...args, answers: changed, confirmed: true, expectedRevision: 1 });
    expect(second.revision).toBe(2);

    const all = await revisions(t);
    expect(all).toHaveLength(2);
    expect(all.find((r) => r._id === stored._id)).toEqual(stored);
    expect(stored.policies).toEqual({ status: "not_established", text: "" });
    expect(stored.confirmedAt).toBeUndefined();
    expect(stored.confirmedBy).toBeUndefined();

    const result = await asA(t, fx).query(current, args);
    expect(result.latest).toMatchObject({ revision: 2, answers: changed });
    expect(result.latest?.confirmedAt).toEqual(expect.any(Number));
    expect(result.history.map((r) => [r.revision, r.confirmed])).toEqual([[2, true], [1, false]]);
    expect(all.find((r) => r.revision === 2)).toMatchObject({ confirmedBy: fx.userA.userId, createdBy: fx.userA.userId });
  });

  test("utdatert versjon avvises med CONFLICT, og ingenting lagres", async () => {
    const { t, fx, periodId } = await withPeriod();
    const args = { organizationId: fx.orgA, reportingPeriodId: periodId, answers: SYNTHETIC_PROFILE_ANSWERS, confirmed: false };
    await asA(t, fx).mutation(save, { ...args, expectedRevision: 0 });
    // En annen fane som fortsatt tror ingenting er lagret, og en som ligger foran.
    await expectAppError(asA(t, fx).mutation(save, { ...args, expectedRevision: 0 }), "CONFLICT");
    await expectAppError(asA(t, fx).mutation(save, { ...args, expectedRevision: 2 }), "CONFLICT");
    expect(await revisions(t)).toHaveLength(1);
    expect((await auditRows(t)).filter((e) => e.entityType === "businessProfile")).toHaveLength(1);
  });

  test("versjoner telles per periode", async () => {
    const { t, fx, periodId } = await withPeriod();
    const other = await asA(t, fx).mutation(create, {
      organizationId: fx.orgA,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      publicationDueDate: "2027-06-30",
    });
    const args = { organizationId: fx.orgA, answers: SYNTHETIC_PROFILE_ANSWERS, confirmed: false, expectedRevision: 0 };
    await asA(t, fx).mutation(save, { ...args, reportingPeriodId: periodId });
    expect((await asA(t, fx).mutation(save, { ...args, reportingPeriodId: other })).revision).toBe(1);
    const result = await asA(t, fx).query(current, { organizationId: fx.orgA, reportingPeriodId: other });
    expect(result.history).toHaveLength(1);
  });

  test("periode fra en annen organisasjon avvises som ikke funnet, både ved lagring og lesing", async () => {
    const { t, fx, periodId } = await withPeriod();
    const args = { answers: SYNTHETIC_PROFILE_ANSWERS, confirmed: false, expectedRevision: 0 };
    // B bruker egen organisasjon, men A sin periode-id.
    await expectAppError(asB(t, fx).mutation(save, { organizationId: fx.orgB, reportingPeriodId: periodId, ...args }), "NOT_FOUND");
    await expectAppError(asB(t, fx).query(current, { organizationId: fx.orgB, reportingPeriodId: periodId }), "NOT_FOUND");
    // Ugyldig id og id fra en annen tabell gir samme svar.
    for (const id of ["ikke-en-id", fx.orgA, fx.membershipA]) {
      await expectAppError(asA(t, fx).mutation(save, { organizationId: fx.orgA, reportingPeriodId: id, ...args }), "NOT_FOUND");
    }
    expect(await revisions(t)).toEqual([]);
  });

  test.each([
    ["«beskrevet» uten tekst", { routines: { status: "described" as const, text: "  " } }],
    ["«ikke etablert» på et beskrivelsestema", { operations: { status: "not_established" as const, text: "" } }],
  ])("%s avvises på serveren", async (_name, patch) => {
    const { t, fx, periodId } = await withPeriod();
    await expectAppError(
      asA(t, fx).mutation(save, {
        organizationId: fx.orgA,
        reportingPeriodId: periodId,
        answers: { ...emptyAnswers(), ...patch },
        confirmed: false,
        expectedRevision: 0,
      }),
      "INVALID_INPUT",
    );
    expect(await revisions(t)).toEqual([]);
  });

  test("revisjonsloggen får versjon og status per tema, aldri svarteksten", async () => {
    const { t, fx, periodId } = await withPeriod();
    const args = { organizationId: fx.orgA, reportingPeriodId: periodId, confirmed: false };
    const first = await asA(t, fx).mutation(save, {
      ...args,
      answers: { ...emptyAnswers(), operations: { status: "described", text: SECRET_TEXT } },
      expectedRevision: 0,
    });
    await asA(t, fx).mutation(save, {
      ...args,
      answers: { ...emptyAnswers(), operations: { status: "described", text: `${SECRET_TEXT}, endret` }, policies: { status: "not_established", text: "" } },
      expectedRevision: 1,
    });
    const events = (await auditRows(t)).filter((e) => e.entityType === "businessProfile");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ eventType: "business_profile.saved", entityId: first.revisionId, actorId: fx.userA.userId });
    expect(events[0].safeDiff).toMatchObject({ revision: { to: 1 }, operations: { to: "described" }, policies: { to: "unknown" } });
    // Andre lagring: bare det som endret status. Endret tekst alene gir ingen diff.
    expect(events[1].safeDiff).toEqual({ revision: { from: 1, to: 2 }, policies: { from: "unknown", to: "not_established" } });
    expect(JSON.stringify(await auditRows(t))).not.toContain("Syntetisk fritekst");
  });
});
