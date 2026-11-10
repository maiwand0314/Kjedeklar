/** Rapportperiode og virksomhetsprofil mot lokal backend med ekte innloggede brukere. */
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { clientWithToken, errorOf, setupTwoTenants, type TwoTenants } from "../helpers/local-backend";
import { SYNTHETIC_PERIOD, SYNTHETIC_PROFILE_ANSWERS } from "../helpers/public-functions";

const { create, list } = api.organizations.reportingPeriods;
const { save, current } = api.organizations.businessProfile;

const auditPage = (client: TwoTenants["a"], organizationId: string, entityType: "reportingPeriod" | "businessProfile") =>
  client.query(api.audit.queries.list, { organizationId, entityType, paginationOpts: { numItems: 10, cursor: null } });

describe("rapportperiode og virksomhetsprofil mot lokal backend", () => {
  let env: TwoTenants;
  let periodId: string;
  /** To klienter for samme bruker: én ConvexHttpClient sender mutasjoner i kø, ikke samtidig. */
  let twoTabs: TwoTenants["a"][];
  beforeAll(async () => {
    env = await setupTwoTenants();
    twoTabs = [env.a, clientWithToken(env.sessionA.token)];
    periodId = await env.a.mutation(create, { organizationId: env.fx.orgA, ...SYNTHETIC_PERIOD });
  });

  test("perioden kan velges fra listen og står i revisjonsloggen", async () => {
    const { fx, a } = env;
    expect(await a.query(list, { organizationId: fx.orgA })).toEqual([{ id: periodId, ...SYNTHETIC_PERIOD }]);
    const log = await auditPage(a, fx.orgA, "reportingPeriod");
    expect(log.page).toHaveLength(1);
    expect(log.page[0]).toMatchObject({ eventType: "reporting_period.created", entityId: periodId });
    expect(Object.keys(log.page[0].safeDiff).sort()).toEqual(["endDate", "publicationDueDate", "startDate", "status"]);
  });

  test("ny profilversjon bevarer den gamle, og hver lagring logges uten svartekst", async () => {
    const { fx, a } = env;
    const args = { organizationId: fx.orgA, reportingPeriodId: periodId };
    const first = await a.mutation(save, { ...args, answers: SYNTHETIC_PROFILE_ANSWERS, confirmed: false, expectedRevision: 0 });
    const afterFirst = await a.query(current, args);
    expect(afterFirst.latest).toMatchObject({ revision: 1, answers: SYNTHETIC_PROFILE_ANSWERS, confirmedAt: null });

    const changed = { ...SYNTHETIC_PROFILE_ANSWERS, routines: { status: "described" as const, text: "Årlig kartlegging (syntetisk)." } };
    const second = await a.mutation(save, { ...args, answers: changed, confirmed: true, expectedRevision: 1 });
    expect(second.revision).toBe(2);
    const afterSecond = await a.query(current, args);
    expect(afterSecond.latest).toMatchObject({ revision: 2, answers: changed });
    expect(afterSecond.latest?.confirmedAt).toEqual(expect.any(Number));
    // Versjon 1 står igjen uendret i historikken.
    expect(afterSecond.history).toEqual([{ revision: 2, savedAt: afterSecond.latest?.savedAt, confirmed: true }, afterFirst.history[0]]);

    const log = await auditPage(a, fx.orgA, "businessProfile");
    expect(log.page.map((e) => e.entityId).sort()).toEqual([first.revisionId, second.revisionId].sort());
    const latestEvent = log.page.find((e) => e.entityId === second.revisionId);
    expect(latestEvent?.safeDiff).toEqual({
      revision: { from: 1, to: 2 },
      confirmed: { from: false, to: true },
      routines: { from: "unknown", to: "described" },
    });
    expect(JSON.stringify(log.page)).not.toContain("syntetisk");
  });

  test("samtidige lagringer fra samme versjon: én vinner, den andre får CONFLICT", async () => {
    const { fx, a } = env;
    const args = { organizationId: fx.orgA, reportingPeriodId: periodId, answers: SYNTHETIC_PROFILE_ANSWERS, confirmed: false };
    const { revision } = (await a.query(current, { organizationId: fx.orgA, reportingPeriodId: periodId })).latest!;
    const outcomes = await Promise.all(twoTabs.map((tab) => errorOf(tab.mutation(save, { ...args, expectedRevision: revision }))));
    expect(outcomes.map((o) => o.code).sort()).toEqual(["CONFLICT", "OK"]);
    const after = await a.query(current, { organizationId: fx.orgA, reportingPeriodId: periodId });
    expect(after.history.map((r) => r.revision)).toEqual(Array.from({ length: revision + 1 }, (_, i) => revision + 1 - i));
  });

  test("samtidig oppretting av samme periode gir bare én periode", async () => {
    const { fx, a } = env;
    const dates = { startDate: "2026-01-01", endDate: "2026-12-31", publicationDueDate: "2027-06-30" };
    const outcomes = await Promise.all(twoTabs.map((tab) => errorOf(tab.mutation(create, { organizationId: fx.orgA, ...dates }))));
    expect(outcomes.map((o) => o.code).sort()).toEqual(["OK", "PERIOD_EXISTS"]);
    expect((await a.query(list, { organizationId: fx.orgA })).filter((p) => p.startDate === dates.startDate)).toHaveLength(1);
  });

  test("fremmed periode avvises av getOwned, og ingenting lekker eller endres", async () => {
    const { fx, a, b } = env;
    const before = await a.query(current, { organizationId: fx.orgA, reportingPeriodId: periodId });
    const profile = { answers: SYNTHETIC_PROFILE_ANSWERS, confirmed: false, expectedRevision: 0 };
    // B i egen organisasjon med A sin periode-id, og B direkte mot A sin organisasjon.
    for (const organizationId of [fx.orgB, fx.orgA]) {
      expect(await errorOf(b.mutation(save, { organizationId, reportingPeriodId: periodId, ...profile }))).toMatchObject({
        code: "NOT_FOUND",
        data: { code: "NOT_FOUND", message: "Ikke funnet." },
      });
      expect((await errorOf(b.query(current, { organizationId, reportingPeriodId: periodId }))).code).toBe("NOT_FOUND");
    }
    expect((await errorOf(b.query(list, { organizationId: fx.orgA }))).code).toBe("NOT_FOUND");
    expect((await errorOf(b.mutation(create, { organizationId: fx.orgA, ...SYNTHETIC_PERIOD, startDate: "2025-02-01" }))).code).toBe("NOT_FOUND");
    expect(await b.query(list, { organizationId: fx.orgB })).toEqual([]);
    expect(await a.query(current, { organizationId: fx.orgA, reportingPeriodId: periodId })).toEqual(before);
  });

  test("uten innlogging avvises alle fire funksjonene", async () => {
    const { fx, anonymous } = env;
    const org = { organizationId: fx.orgA };
    const calls = [
      () => anonymous.query(list, org),
      () => anonymous.mutation(create, { ...org, ...SYNTHETIC_PERIOD, startDate: "2025-03-01" }),
      () => anonymous.query(current, { ...org, reportingPeriodId: periodId }),
      () => anonymous.mutation(save, { ...org, reportingPeriodId: periodId, answers: SYNTHETIC_PROFILE_ANSWERS, confirmed: false, expectedRevision: 0 }),
    ];
    for (const call of calls) expect((await errorOf(call())).code).toBe("UNAUTHENTICATED");
  });
});
