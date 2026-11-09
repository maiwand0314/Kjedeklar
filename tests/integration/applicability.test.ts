/** Pliktvurdering mot lokal backend med ekte innloggede brukere: tenant og revisjonslogg. */
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { errorOf, setupTwoTenants, type TwoTenants } from "../helpers/local-backend";
import { SYNTHETIC_APPLICABILITY_INPUT } from "../helpers/public-functions";

const { assess, history } = api.organizations.applicability;

describe("pliktvurdering mot lokal backend", () => {
  let env: TwoTenants;
  beforeAll(async () => {
    env = await setupTwoTenants();
  });

  test("lagret vurdering vises i historikken og i revisjonsloggen", async () => {
    const { fx, a } = env;
    const { assessmentId, result } = await a.mutation(assess, {
      organizationId: fx.orgA,
      inputs: SYNTHETIC_APPLICABILITY_INPUT,
      confirmed: true,
    });
    expect(result).toBe("likely_in");
    const [latest] = await a.query(history, { organizationId: fx.orgA });
    expect(latest).toMatchObject({ id: assessmentId, result: "likely_in", inputs: SYNTHETIC_APPLICABILITY_INPUT });

    const log = await a.query(api.audit.queries.list, {
      organizationId: fx.orgA,
      entityType: "applicability",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(log.page).toHaveLength(1);
    expect(log.page[0]).toMatchObject({ eventType: "applicability.assessed", entityId: assessmentId });
    expect(Object.keys(log.page[0].safeDiff).sort()).toEqual(["result", "ruleVersion"]);
  });

  test("fremmed organisasjon kan verken vurderes eller leses, og ingenting lekker", async () => {
    const { fx, a, b } = env;
    const before = await a.query(history, { organizationId: fx.orgA });
    expect((await errorOf(b.mutation(assess, { organizationId: fx.orgA, inputs: SYNTHETIC_APPLICABILITY_INPUT, confirmed: true }))).code).toBe("NOT_FOUND");
    expect((await errorOf(b.query(history, { organizationId: fx.orgA }))).code).toBe("NOT_FOUND");
    expect(await b.query(history, { organizationId: fx.orgB })).toEqual([]);
    expect(await a.query(history, { organizationId: fx.orgA })).toEqual(before);
  });

  test("uten innlogging avvises begge funksjonene", async () => {
    const { fx, anonymous } = env;
    expect((await errorOf(anonymous.query(history, { organizationId: fx.orgA }))).code).toBe("UNAUTHENTICATED");
    expect(
      (await errorOf(anonymous.mutation(assess, { organizationId: fx.orgA, inputs: SYNTHETIC_APPLICABILITY_INPUT, confirmed: true }))).code,
    ).toBe("UNAUTHENTICATED");
  });
});
