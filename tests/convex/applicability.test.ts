import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { RULE_VERSION } from "../../src/domain/applicability/assess";
import { SYNTHETIC_APPLICABILITY_INPUT } from "../helpers/public-functions";
import { expectAppError, setupTest, twoTenants, type TestConvex } from "./setup";

const { assess, history } = api.organizations.applicability;

type Fixture = Awaited<ReturnType<typeof twoTenants>>;
const asA = (t: TestConvex, fx: Fixture) => t.withIdentity(fx.userA.identity);
const rows = (t: TestConvex) => t.run((ctx) => ctx.db.query("applicabilityAssessments").collect());
const auditRows = (t: TestConvex) => t.run((ctx) => ctx.db.query("auditEvents").collect());

/** Under tersklene begge år: sannsynlig ikke omfattet. */
const BELOW = {
  ...SYNTHETIC_APPLICABILITY_INPUT,
  previousYear: { fiscalYear: 2024, salesRevenueOre: 10_000_000_00n, balanceSheetTotalOre: 5_000_000_00n, averageFte: 10 },
  currentYear: { fiscalYear: 2025, salesRevenueOre: 10_000_000_00n, balanceSheetTotalOre: 5_000_000_00n, averageFte: 10 },
};

describe("lagring av pliktvurdering", () => {
  test("resultatet regnes ut på serveren og lagres med regelversjon, begrunnelse og bekreftelse", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    const { result } = await asA(t, fx).mutation(assess, {
      organizationId: fx.orgA,
      inputs: SYNTHETIC_APPLICABILITY_INPUT,
      confirmed: true,
    });
    expect(result).toBe("likely_in");
    const [row] = await rows(t);
    expect(row).toMatchObject({
      organizationId: fx.orgA,
      assessedBy: fx.userA.userId,
      ruleVersion: RULE_VERSION,
      result: "likely_in",
      inputs: SYNTHETIC_APPLICABILITY_INPUT,
    });
    expect(row.rationale.length).toBeGreaterThan(0);
    expect(row.userConfirmedAt).toBe(row.assessedAt);
  });

  test("ny vurdering er ny historikk; den gamle endres ikke", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    await asA(t, fx).mutation(assess, { organizationId: fx.orgA, inputs: SYNTHETIC_APPLICABILITY_INPUT, confirmed: true });
    const [first] = await rows(t);
    await asA(t, fx).mutation(assess, { organizationId: fx.orgA, inputs: BELOW, confirmed: true });
    const list = await asA(t, fx).query(history, { organizationId: fx.orgA });
    expect(list.map((r) => r.result)).toEqual(["likely_out", "likely_in"]);
    expect((await rows(t)).find((r) => r._id === first._id)).toEqual(first);
  });

  test("revisjonsloggen får bare resultat og regelversjon, ikke tallene", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    const { assessmentId } = await asA(t, fx).mutation(assess, {
      organizationId: fx.orgA,
      inputs: SYNTHETIC_APPLICABILITY_INPUT,
      confirmed: true,
    });
    const events = (await auditRows(t)).filter((e) => e.eventType === "applicability.assessed");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ organizationId: fx.orgA, entityType: "applicability", entityId: assessmentId });
    expect(events[0].safeDiff).toEqual({
      result: { to: "likely_in" },
      ruleVersion: { to: RULE_VERSION },
    });
  });

  test.each([
    ["negativ salgsinntekt", { currentYear: { ...BELOW.currentYear, salesRevenueOre: -1n } }],
    ["negative årsverk", { previousYear: { ...BELOW.previousYear, averageFte: -0.5 } }],
    ["regnskapsår som ikke er et helt år", { currentYear: { ...BELOW.currentYear, fiscalYear: 2025.5 } }],
    ["regnskapsår utenfor spennet", { previousYear: { ...BELOW.previousYear, fiscalYear: 1990 } }],
  ])("%s avvises, og ingenting lagres", async (_name, change) => {
    const t = setupTest();
    const fx = await twoTenants(t);
    await expectAppError(
      asA(t, fx).mutation(assess, { organizationId: fx.orgA, inputs: { ...BELOW, ...change }, confirmed: true }),
      "INVALID_INPUT",
    );
    expect(await rows(t)).toEqual([]);
    expect((await auditRows(t)).filter((e) => e.eventType === "applicability.assessed")).toEqual([]);
  });

  test("uten bekreftelse av grunnlaget lagres ingenting", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    await expect(
      asA(t, fx).mutation(assess, {
        organizationId: fx.orgA,
        inputs: BELOW,
        confirmed: false as unknown as true,
      }),
    ).rejects.toThrow();
    expect(await rows(t)).toEqual([]);
  });

  test("fremmed organisasjon kan verken vurderes eller leses", async () => {
    const t = setupTest();
    const fx = await twoTenants(t);
    await asA(t, fx).mutation(assess, { organizationId: fx.orgA, inputs: BELOW, confirmed: true });
    const asB = t.withIdentity(fx.userB.identity);
    await expectAppError(
      asB.mutation(assess, { organizationId: fx.orgA, inputs: BELOW, confirmed: true }),
      "NOT_FOUND",
    );
    await expectAppError(asB.query(history, { organizationId: fx.orgA }), "NOT_FOUND");
    expect(await asB.query(history, { organizationId: fx.orgB })).toEqual([]);
  });
});
