/**
 * Risikoliste og kundens vurdering mot lokal backend med ekte innloggede brukere: samtidige vurderinger gir én vinner,
 * endret grunnlag etter visning avvises, fremmede vurderinger og perioder gir «ikke funnet», og listen tåler pilotens
 * 2 000 leverandører innenfor Convex sine lesegrenser. Test-backenden består mellom kjøringer, så demoversjonene får
 * unike navn per kjøring.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { LIST_SUPPLIER_LIMIT } from "../../convex/risk/reviews";
import { errorOf, runInternal, setupTwoTenants, type TwoTenants } from "../helpers/local-backend";
import { activateDemoData } from "../helpers/risk-demo";

const run = Date.now().toString(36);
const WHY = "Vi har gått gjennom revisjonsrapporten og snakket med leverandøren.";

describe("risikoliste og kundens vurdering mot lokal backend", () => {
  let env: TwoTenants;
  let periodA: string;
  let periodB: string;
  beforeAll(async () => {
    env = await setupTwoTenants();
    await activateDemoData("rev");
    periodA = await env.a.mutation(api.organizations.reportingPeriods.create, { organizationId: env.fx.orgA, startDate: "2025-01-01", endDate: "2025-12-31", publicationDueDate: "2026-06-30" });
    periodB = await env.b.mutation(api.organizations.reportingPeriods.create, { organizationId: env.fx.orgB, startDate: "2025-01-01", endDate: "2025-12-31", publicationDueDate: "2026-06-30" });
  }, 120_000);

  const assessAll = async (client: TwoTenants["a"], organizationId: string, reportingPeriodId: string) => {
    let cursor: string | null = null;
    do {
      const page: { nextCursor: string | null } = await client.mutation(api.risk.assessments.assessPeriod, { organizationId, reportingPeriodId, cursor });
      cursor = page.nextCursor;
    } while (cursor);
  };
  const listA = (extra: Record<string, unknown> = {}) =>
    env.a.query(api.risk.reviews.list, { organizationId: env.fx.orgA, reportingPeriodId: periodA, offset: 0, limit: 50, ...extra } as never);
  const detailA = (supplierId: string) => env.a.query(api.risk.reviews.detail, { organizationId: env.fx.orgA, supplierId, reportingPeriodId: periodA });
  const recordA = (supplierId: string, assessmentId: string, over: Record<string, unknown> = {}) =>
    env.a.mutation(api.risk.reviews.record, {
      organizationId: env.fx.orgA, supplierId, reportingPeriodId: periodA, assessmentId, expectedReviewId: null, decision: "confirm", rationale: WHY, ...over,
    } as never);

  /** Demo-kodene XA–XC er ikke ISO-land, så appen tar dem ikke imot; testfunksjonen setter dem direkte. */
  const setCountries = (supplierId: string, productionCountries: string[]) =>
    runInternal("ops/testing:setPeriodCountries", { supplierId, reportingPeriodId: periodA, productionCountries });

  /** En høy leverandør i A, vurdert; gir leverandør, innkjøpsdata og screening. */
  const highSupplier = async (name: string) => {
    const supplierId = await env.a.mutation(api.suppliers.mutations.create, { organizationId: env.fx.orgA, name });
    await env.a.mutation(api.suppliers.mutations.savePeriod, {
      organizationId: env.fx.orgA, supplierId, reportingPeriodId: periodA, expectedRowVersion: 0, productionCountries: ["NO"], upstreamUnknown: false, spendOre: 100n,
    });
    setCountries(supplierId, ["XA"]);
    await assessAll(env.a, env.fx.orgA, periodA);
    return { supplierId, assessmentId: (await detailA(supplierId)).assessment!.id };
  };

  test("to samtidige vurderinger mot samme gjeldende vurdering: én vinner, én CONFLICT, og historikken har én rad", async () => {
    const { supplierId, assessmentId } = await highSupplier(`Samtidig ${run} AS`);
    // Lukkede funksjoner: løftene startes først i allSettled, så ingen avvisning står ubehandlet.
    const attempts = [
      () => recordA(supplierId, assessmentId, { decision: "override", chosenLevel: "low" }),
      () => recordA(supplierId, assessmentId, { decision: "override", chosenLevel: "moderate" }),
    ];
    const results = await Promise.allSettled(attempts.map((go) => go()));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((await errorOf(Promise.reject(rejected.reason))).code).toBe("CONFLICT");
    const d = await detailA(supplierId);
    expect(d.reviews).toHaveLength(1);
    expect(d.review.state).toBe("overridden");
    // Screeningen er uberørt av vurderingen.
    expect(d.assessment).toMatchObject({ screeningLevel: "high", status: "current" });
  });

  test("input endret siden visning: ny bekreftelse avvises som utdatert, og tidligere vurdering blir utdatert i listen", async () => {
    const { supplierId, assessmentId } = await highSupplier(`Endret ${run} AS`);
    const { id } = await recordA(supplierId, assessmentId);
    setCountries(supplierId, ["XC"]);
    expect((await errorOf(recordA(supplierId, assessmentId, { expectedReviewId: id }))).code).toBe("REVIEW_STALE");
    expect((await detailA(supplierId)).review).toMatchObject({ state: "outdated", level: null });
    expect((await listA()).counts.review.outdated).toBeGreaterThanOrEqual(1);
    // Ny screening, ny bekreftelse.
    await assessAll(env.a, env.fx.orgA, periodA);
    const fresh = (await detailA(supplierId)).assessment!;
    expect(fresh).toMatchObject({ screeningLevel: "unknown", status: "current" }); // uten næringskode er det en vesentlig mangel
    expect((await errorOf(recordA(supplierId, assessmentId, { expectedReviewId: id }))).code).toBe("CONFLICT");
    await recordA(supplierId, fresh.id, { expectedReviewId: id });
    expect((await detailA(supplierId)).review).toMatchObject({ state: "confirmed", level: "unknown" });
  });

  test("fremmed vurdering, leverandør og periode gir NOT_FOUND, og B ser ingenting av A", async () => {
    const { supplierId, assessmentId } = await highSupplier(`Fremmed ${run} AS`);
    const asB = (over: Record<string, unknown>) =>
      env.b.mutation(api.risk.reviews.record, {
        organizationId: env.fx.orgB, supplierId, reportingPeriodId: periodB, assessmentId, expectedReviewId: null, decision: "confirm", rationale: WHY, ...over,
      } as never);
    expect((await errorOf(asB({}))).code).toBe("NOT_FOUND");
    expect((await errorOf(env.b.query(api.risk.reviews.detail, { organizationId: env.fx.orgB, supplierId, reportingPeriodId: periodB }))).code).toBe("NOT_FOUND");
    expect((await errorOf(env.b.query(api.risk.reviews.list, { organizationId: env.fx.orgB, reportingPeriodId: periodA, offset: 0, limit: 10 }))).code).toBe("NOT_FOUND");
    const own = await env.b.query(api.risk.reviews.list, { organizationId: env.fx.orgB, reportingPeriodId: periodB, offset: 0, limit: 10 });
    expect(own).toMatchObject({ rows: [], total: 0 });
    expect(own.counts.screening).toEqual({ high: 0, unknown: 0, moderate: 0, low: 0, not_assessed: 0 });
    // Uten sesjon og som feil organisasjon.
    expect((await errorOf(env.anonymous.query(api.risk.reviews.list, { organizationId: env.fx.orgA, reportingPeriodId: periodA, offset: 0, limit: 10 }))).code).toBe("UNAUTHENTICATED");
    expect((await errorOf(env.b.query(api.risk.reviews.list, { organizationId: env.fx.orgA, reportingPeriodId: periodA, offset: 0, limit: 10 }))).code).toBe("NOT_FOUND");
  });

  test("listen med pilotens 2 000 leverandører leses i én spørring, sortert, og over grensen sier den fra", async () => {
    for (let from = 0; from < 1990; from += 500) {
      runInternal("ops/testing:seedSuppliersForRisk", { organizationId: env.fx.orgA, reportingPeriodId: periodA, from, count: Math.min(500, 1990 - from) });
    }
    await assessAll(env.a, env.fx.orgA, periodA);
    const started = Date.now();
    const result = await listA({ limit: 100 });
    const ms = Date.now() - started;
    console.log(`Liste: ${ms} ms for ${result.counts.screening.high + result.counts.screening.unknown + result.counts.screening.moderate + result.counts.screening.low + result.counts.screening.not_assessed} leverandører`);
    expect(ms).toBeLessThan(5000);
    expect(result.truncated).toBe(false);
    // Nivåene ligger i metodens rekkefølge på tvers av hele listen, uansett beløp.
    const rank = new Map(result.groupOrder.map((l, i) => [l, i]));
    const ranks = result.rows.map((r) => rank.get(r.level)!);
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
    // Over grensen sier listen fra, i stedet for å late som den er komplett.
    runInternal("ops/testing:seedSuppliersForRisk", { organizationId: env.fx.orgA, reportingPeriodId: periodA, from: 5000, count: LIST_SUPPLIER_LIMIT - result.total + 10 });
    expect((await listA({ limit: 1 })).truncated).toBe(true);
  }, 300_000);
});
