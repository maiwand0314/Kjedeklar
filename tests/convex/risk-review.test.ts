/**
 * Risikoliste og kundens vurdering (oppgave 16): sortering og tellinger, forklaring, begrunnelse, overstyring som ikke
 * skjuler screeningen, optimistisk låsing, endret grunnlag og tenantvern. Grunnlaget er de syntetiske demo-filene.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SYNTHETIC_PERIOD, SYNTHETIC_SUPPLIER_DOC } from "../helpers/public-functions";
import { expectAppError, setupTest, twoTenants } from "./setup";

afterEach(() => {
  process.env.KJEDEKLAR_ENV = "test";
});

const demo = (name: string) => JSON.parse(readFileSync(`risk-data/demo/${name}-demo-1.json`, "utf8")) as Record<string, unknown>;
const WHY = "Vi har gått gjennom revisjonsrapporten fra i fjor og snakket med leverandøren.";

async function start() {
  const t = setupTest();
  const fx = await twoTenants(t);
  const a = t.withIdentity(fx.userA.identity);
  const b = t.withIdentity(fx.userB.identity);
  for (const [kind, name] of [["country", "country"], ["industry", "industry"], ["method", "method"]] as const) {
    const manifest = demo(name);
    await t.mutation(internal.risk.internal.importVersion, { operator: "Test", payload: manifest });
    await t.mutation(internal.risk.internal.activateVersion, { operator: "Test", kind, version: manifest.version as string });
  }
  const periodId = (organizationId: Id<"organizations">) =>
    t.run((ctx) => ctx.db.insert("reportingPeriods", { organizationId, ...SYNTHETIC_PERIOD, status: "open", createdAt: 0, createdBy: "oppsett" }));
  /** Leverandør med kjente produksjonsland (XA høy, XB moderat, XC lav) og innkjøpsbeløp; uten land blir den ukjent. */
  const supplier = async (organizationId: Id<"organizations">, reportingPeriodId: Id<"reportingPeriods">, name: string, countries: string[], spendOre?: bigint) => {
    const supplierId = await t.run((ctx) =>
      ctx.db.insert("suppliers", { organizationId, ...SYNTHETIC_SUPPLIER_DOC, name, nameKey: name.toLowerCase(), industryCodeSystem: "SN2007", industryCode: "00.100", createdAt: 0, createdBy: "oppsett" }),
    );
    const rowId = await t.run((ctx) =>
      ctx.db.insert("supplierPeriods", {
        organizationId, supplierId, reportingPeriodId, productionCountries: countries, upstreamUnknown: false,
        ...(spendOre !== undefined && { spendOre }), rowVersion: 1, updatedAt: 0, updatedBy: "oppsett",
      }),
    );
    return { supplierId, rowId };
  };
  const assess = (reportingPeriodId: string, client = a, organizationId = fx.orgA) =>
    client.mutation(api.risk.assessments.assessPeriod, { organizationId, reportingPeriodId, cursor: null });
  const list = (reportingPeriodId: string, extra: Record<string, unknown> = {}, client = a, organizationId = fx.orgA) =>
    client.query(api.risk.reviews.list, { organizationId, reportingPeriodId, offset: 0, limit: 50, ...extra });
  const detail = (supplierId: string, reportingPeriodId: string, client = a, organizationId = fx.orgA) =>
    client.query(api.risk.reviews.detail, { organizationId, supplierId, reportingPeriodId });
  const record = (
    supplierId: string,
    reportingPeriodId: string,
    assessmentId: string,
    over: Record<string, unknown> = {},
    client = a,
    organizationId = fx.orgA,
  ) =>
    client.mutation(api.risk.reviews.record, {
      organizationId, supplierId, reportingPeriodId, assessmentId, expectedReviewId: null, decision: "confirm", rationale: WHY, ...over,
    } as never);
  const assessmentOf = async (supplierId: string, reportingPeriodId: string) => {
    const d = await detail(supplierId, reportingPeriodId);
    return d.assessment!.id;
  };
  const reviews = () => t.run((ctx) => ctx.db.query("assessmentReviews").collect());
  const events = async () => (await t.run((ctx) => ctx.db.query("auditEvents").collect())).filter((e) => e.eventType === "risk.reviewed");
  return { t, fx, a, b, periodId, supplier, assess, list, detail, record, assessmentOf, reviews, events };
}

/** Én høy leverandør, vurdert. */
async function oneHigh() {
  const env = await start();
  const period = await env.periodId(env.fx.orgA);
  const { supplierId, rowId } = await env.supplier(env.fx.orgA, period, "Høy AS", ["XA"], 100_000n);
  await env.assess(period);
  return { ...env, period, supplierId, rowId, assessmentId: await env.assessmentOf(supplierId, period) };
}

describe("risikoliste", () => {
  test("nivå først, beløp fallende innenfor nivå, ukjent og ikke vurdert foran moderat og lav; ukjent beløp sist", async () => {
    const env = await start();
    const period = await env.periodId(env.fx.orgA);
    await env.supplier(env.fx.orgA, period, "Lav stor", ["XC"], 900_000_000_00n); // enormt beløp, men lav
    await env.supplier(env.fx.orgA, period, "Høy liten", ["XA"], 1_00n);
    await env.supplier(env.fx.orgA, period, "Høy stor", ["XA"], 50_000_00n);
    await env.supplier(env.fx.orgA, period, "Høy ukjent beløp", ["XA"]);
    await env.supplier(env.fx.orgA, period, "Ukjent land", [], 1_000_000n);
    await env.supplier(env.fx.orgA, period, "Moderat", ["XB"], 5_00n);
    await env.assess(period);
    // Ikke vurdert: opprettes etter kjøringen.
    await env.t.run((ctx) => ctx.db.insert("suppliers", { organizationId: env.fx.orgA, ...SYNTHETIC_SUPPLIER_DOC, name: "Ny", nameKey: "ny", createdAt: 0, createdBy: "oppsett" }));

    const result = await env.list(period);
    expect(result.rows.map((r) => [r.name, r.level])).toEqual([
      ["Høy stor", "high"], ["Høy liten", "high"], ["Høy ukjent beløp", "high"],
      ["Ukjent land", "unknown"],
      ["Ny", "not_assessed"],
      ["Moderat", "moderate"],
      ["Lav stor", "low"],
    ]);
    expect(result.rows.find((r) => r.name === "Høy ukjent beløp")!.spendOre).toBeNull();
    expect(result.counts.screening).toEqual({ high: 3, unknown: 1, moderate: 1, low: 1, not_assessed: 1 });
    expect(result.counts.review).toEqual({ none: 7, confirmed: 0, overridden: 0, revoked: 0, outdated: 0 });
    expect(result.groupOrder).toEqual(["high", "unknown", "not_assessed", "moderate", "low"]);
    expect(result.truncated).toBe(false);
  });

  test("filter på nivå, vurdering og navn, med paginering; tellingene gjelder alle uavhengig av filter", async () => {
    const env = await start();
    const period = await env.periodId(env.fx.orgA);
    for (const [i, name] of ["Alfa", "Beta", "Gamma"].entries()) await env.supplier(env.fx.orgA, period, name, ["XA"], BigInt(1000 - i));
    await env.supplier(env.fx.orgA, period, "Delta", ["XC"], 5n);
    await env.assess(period);
    const beta = (await env.list(period)).rows.find((r) => r.name === "Beta")!;
    await env.record(beta.supplierId, period, await env.assessmentOf(beta.supplierId, period));

    expect((await env.list(period, { level: "high" })).rows.map((r) => r.name)).toEqual(["Alfa", "Beta", "Gamma"]);
    expect((await env.list(period, { reviewState: "confirmed" })).rows.map((r) => r.name)).toEqual(["Beta"]);
    expect((await env.list(period, { search: "amma" })).rows).toEqual([]); // starten av navnet, ikke en del
    expect((await env.list(period, { search: "ga" })).rows.map((r) => r.name)).toEqual(["Gamma"]);
    const second = await env.list(period, { limit: 2, offset: 2 });
    expect(second.rows.map((r) => r.name)).toEqual(["Gamma", "Delta"]);
    expect(second.total).toBe(4);
    const filtered = await env.list(period, { level: "low" });
    expect(filtered.counts.screening.high).toBe(3);
    expect(filtered.counts.review.confirmed).toBe(1);
  });

  test("listen og tellingene er avgrenset til egen organisasjon og periode", async () => {
    const env = await start();
    const periodA = await env.periodId(env.fx.orgA);
    const otherA = await env.t.run((ctx) => ctx.db.insert("reportingPeriods", { organizationId: env.fx.orgA, startDate: "2024-01-01", endDate: "2024-12-31", publicationDueDate: "2025-06-30", status: "open", createdAt: 0, createdBy: "oppsett" }));
    const periodB = await env.periodId(env.fx.orgB);
    await env.supplier(env.fx.orgA, periodA, "Egen", ["XA"]);
    await env.supplier(env.fx.orgB, periodB, "Fremmed", ["XA"]);
    await env.assess(periodA);
    await env.assess(periodB, env.b, env.fx.orgB);
    expect((await env.list(periodA)).rows.map((r) => r.name)).toEqual(["Egen"]);
    expect((await env.list(periodB, {}, env.b, env.fx.orgB)).rows.map((r) => r.name)).toEqual(["Fremmed"]);
    // En annen periode i samme organisasjon har egne vurderinger: leverandøren er ikke vurdert der.
    expect((await env.list(otherA)).counts.screening).toMatchObject({ high: 0, not_assessed: 1 });
    await expectAppError(env.list(periodB), "NOT_FOUND");
  });
});

describe("forklaring", () => {
  test("viser regler med kilde og beskrivelse, hva som mangler og opprinnelig nivå", async () => {
    const env = await start();
    const period = await env.periodId(env.fx.orgA);
    const { supplierId } = await env.supplier(env.fx.orgA, period, "Forklart", ["XA", "ZZ"], 1n);
    await env.assess(period);
    const { assessment, supplier, spendOre } = await env.detail(supplierId, period);
    expect(supplier.name).toBe("Forklart");
    expect(spendOre).toBe(1n);
    expect(assessment).toMatchObject({ screeningLevel: "high", status: "current", methodVersion: "demo-method-1", countryVersion: "demo-country-1" });
    expect(assessment!.triggeredRules[0]).toMatchObject({ ruleId: "COUNTRY_LEVEL", input: "XA", level: "high", sourceRef: { version: "demo-country-1", entry: "XA" } });
    expect(assessment!.ruleDescriptions.find((r) => r.ruleId === "COUNTRY_LEVEL")!.description).toMatch(/landdata/i);
    expect(assessment!.missingFields).toEqual(expect.arrayContaining([{ field: "countryCoverage", reason: "not_covered", detail: "ZZ" }]));
  });
});

describe("kundens vurdering", () => {
  test("bekreftelse lagres med begrunnelse, bruker, tidspunkt og opprinnelig nivå, og screeningen er uberørt", async () => {
    const env = await oneHigh();
    const before = await env.t.run((ctx) => ctx.db.query("riskAssessments").collect());
    const { id } = await env.record(env.supplierId, env.period, env.assessmentId, { evidenceNote: "  Revisjonsrapport 2025.  " });
    expect(await env.reviews()).toMatchObject([
      { _id: id, organizationId: env.fx.orgA, assessmentId: env.assessmentId, decision: "confirm", originalLevel: "high", rationale: WHY, evidenceNote: "Revisjonsrapport 2025.", actorId: env.fx.userA.userId },
    ]);
    expect((await env.reviews())[0].reviewedAt).toBeGreaterThan(0);
    expect(await env.t.run((ctx) => ctx.db.query("riskAssessments").collect())).toEqual(before);
    expect((await env.detail(env.supplierId, env.period)).review).toMatchObject({ state: "confirmed", level: "high" });
  });

  test("overstyring til lavt nivå skjuler hverken opprinnelig høy screening, datamangler eller ukjent oppstrøms", async () => {
    const env = await oneHigh();
    await env.t.run((ctx) => ctx.db.patch("supplierPeriods", env.rowId, { upstreamUnknown: true }));
    await env.assess(env.period);
    const assessmentId = await env.assessmentOf(env.supplierId, env.period);
    await env.record(env.supplierId, env.period, assessmentId, { decision: "override", chosenLevel: "low" });
    const d = await env.detail(env.supplierId, env.period);
    expect(d.review).toMatchObject({ state: "overridden", level: "low", current: { originalLevel: "high", chosenLevel: "low" } });
    expect(d.assessment).toMatchObject({ screeningLevel: "high", status: "current" });
    expect(d.assessment!.missingFields).toContainEqual({ field: "upstream", reason: "unknown_upstream" });
    const row = (await env.list(env.period)).rows[0];
    // Listen er fortsatt sortert og vist etter screeningen.
    expect(row).toMatchObject({ level: "high", reviewState: "overridden", effectiveLevel: "low" });
  });

  test.each([
    ["tom", ""],
    ["bare mellomrom", "                         "],
    ["for kort", "ok greit nok"],
    ["gjentakelse", "ok ok ok ok ok ok ok ok ok ok"],
    ["ett langt ord", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
  ])("avviser begrunnelse som er %s, uten å lagre noe eller logge", async (_name, rationale) => {
    const env = await oneHigh();
    for (const decision of [{ decision: "confirm" }, { decision: "override", chosenLevel: "low" }]) {
      await expectAppError(env.record(env.supplierId, env.period, env.assessmentId, { ...decision, rationale }), "RATIONALE_INVALID");
    }
    expect(await env.reviews()).toEqual([]);
    expect(await env.events()).toEqual([]);
  });

  test("ugyldige valg avvises: overstyring uten nivå, til samme nivå eller ukjent, og bekreftelse med nivå", async () => {
    const env = await oneHigh();
    const attempts = [
      { decision: "override" },
      { decision: "override", chosenLevel: "high" },
      { decision: "confirm", chosenLevel: "low" },
      { decision: "revoke" }, // ingenting å trekke tilbake
    ];
    // «Ukjent» er ikke et valg: validatoren stopper det før mutasjonen kjører.
    await expect(env.record(env.supplierId, env.period, env.assessmentId, { decision: "override", chosenLevel: "unknown" })).rejects.toThrow(/Validator/);
    for (const attempt of attempts) await expectAppError(env.record(env.supplierId, env.period, env.assessmentId, attempt), "INVALID_INPUT");
    expect(await env.reviews()).toEqual([]);
  });

  test("optimistisk låsing: forventet gjeldende vurdering må stemme, ellers CONFLICT og ingenting lagres", async () => {
    const env = await oneHigh();
    const { id: first } = await env.record(env.supplierId, env.period, env.assessmentId);
    // Noen andre har ikke sett den første: forventer ingen.
    await expectAppError(env.record(env.supplierId, env.period, env.assessmentId, { decision: "override", chosenLevel: "low" }), "CONFLICT");
    expect(await env.reviews()).toHaveLength(1);
    // Brukeren som så den første, kan gå videre; neste forsøk med den gamle forventningen taper.
    const { id: second } = await env.record(env.supplierId, env.period, env.assessmentId, { expectedReviewId: first, decision: "override", chosenLevel: "moderate" });
    await expectAppError(env.record(env.supplierId, env.period, env.assessmentId, { expectedReviewId: first, decision: "override", chosenLevel: "low" }), "CONFLICT");
    expect((await env.reviews()).map((r) => [r._id, r.previousReviewId ?? null])).toEqual([[first, null], [second, first]]);
    expect((await env.detail(env.supplierId, env.period)).reviews.map((r) => r.id)).toEqual([second, first]); // historikken bevares
  });

  test("tilbaketrekking gir ingen kundevurdering, og historikken står", async () => {
    const env = await oneHigh();
    const { id } = await env.record(env.supplierId, env.period, env.assessmentId, { decision: "override", chosenLevel: "low" });
    await env.record(env.supplierId, env.period, env.assessmentId, { expectedReviewId: id, decision: "revoke" });
    const d = await env.detail(env.supplierId, env.period);
    expect(d.review).toMatchObject({ state: "revoked", level: null });
    expect(d.reviews.map((r) => r.decision)).toEqual(["revoke", "override"]);
    await expectAppError(env.record(env.supplierId, env.period, env.assessmentId, { expectedReviewId: d.review.current!.id, decision: "revoke" }), "INVALID_INPUT");
  });
});

describe("endret grunnlag", () => {
  test("input endret etter visning: bekreftelse og overstyring avvises som utdatert, tilbaketrekking er fortsatt mulig", async () => {
    const env = await oneHigh();
    const { id } = await env.record(env.supplierId, env.period, env.assessmentId);
    await env.t.run((ctx) => ctx.db.patch("supplierPeriods", env.rowId, { productionCountries: ["XC"] }));
    expect((await env.detail(env.supplierId, env.period)).review).toMatchObject({ state: "outdated", level: null });
    await expectAppError(env.record(env.supplierId, env.period, env.assessmentId, { expectedReviewId: id }), "REVIEW_STALE");
    await expectAppError(env.record(env.supplierId, env.period, env.assessmentId, { expectedReviewId: id, decision: "override", chosenLevel: "low" }), "REVIEW_STALE");
    expect((await env.list(env.period)).counts.review.outdated).toBe(1);
    await env.record(env.supplierId, env.period, env.assessmentId, { expectedReviewId: id, decision: "revoke" });
    expect(await env.reviews()).toHaveLength(2);
  });

  test("ny screening gjør tidligere vurdering utdatert; den gamle screeningen kan ikke vurderes lenger, den nye kan", async () => {
    const env = await oneHigh();
    const { id } = await env.record(env.supplierId, env.period, env.assessmentId, { decision: "override", chosenLevel: "low" });
    await env.t.run((ctx) => ctx.db.patch("supplierPeriods", env.rowId, { productionCountries: ["XB"] }));
    await env.assess(env.period);
    const d = await env.detail(env.supplierId, env.period);
    expect(d.assessment).toMatchObject({ screeningLevel: "moderate", status: "current" });
    expect(d.review).toMatchObject({ state: "outdated", level: null, current: { id, chosenLevel: "low", originalLevel: "high" } });
    await expectAppError(env.record(env.supplierId, env.period, env.assessmentId, { expectedReviewId: id }), "CONFLICT");
    await env.record(env.supplierId, env.period, d.assessment!.id, { expectedReviewId: id });
    expect((await env.detail(env.supplierId, env.period)).review).toMatchObject({ state: "confirmed", level: "moderate" });
  });

  test("endret innkjøpsbeløp gjør ingenting utdatert", async () => {
    const env = await oneHigh();
    await env.record(env.supplierId, env.period, env.assessmentId);
    await env.t.run((ctx) => ctx.db.patch("supplierPeriods", env.rowId, { spendOre: 999_999_999n }));
    expect((await env.detail(env.supplierId, env.period)).review.state).toBe("confirmed");
  });
});

describe("tenantvern og revisjonslogg", () => {
  test("fremmed og feilplassert vurdering gir samme NOT_FOUND, og ingenting lagres", async () => {
    const env = await oneHigh();
    const periodB = await env.periodId(env.fx.orgB);
    const { supplierId: supplierB } = await env.supplier(env.fx.orgB, periodB, "B", ["XA"]);
    await env.assess(periodB, env.b, env.fx.orgB);
    const foreignAssessment = (await env.t.run((ctx) => ctx.db.query("riskAssessments").collect())).find((x) => x.organizationId === env.fx.orgB)!._id;
    // Bruker A med B sin vurdering, leverandør og periode, alene og i blanding.
    await expectAppError(env.record(env.supplierId, env.period, foreignAssessment), "NOT_FOUND");
    await expectAppError(env.record(supplierB, env.period, env.assessmentId), "NOT_FOUND");
    await expectAppError(env.record(env.supplierId, periodB, env.assessmentId), "NOT_FOUND");
    // En annen leverandørs vurdering i samme organisasjon gjelder ikke denne leverandøren.
    const { supplierId: other } = await env.supplier(env.fx.orgA, env.period, "Annen", ["XA"]);
    await env.assess(env.period);
    const otherAssessment = await env.assessmentOf(other, env.period);
    await expectAppError(env.record(env.supplierId, env.period, otherAssessment), "NOT_FOUND");
    await expectAppError(env.record("ikke-en-id", env.period, env.assessmentId), "NOT_FOUND");
    expect(await env.reviews()).toEqual([]);
  });

  test("én revisjonshendelse per vurdering med valg og nivå, uten begrunnelse eller notat", async () => {
    const env = await oneHigh();
    const { id } = await env.record(env.supplierId, env.period, env.assessmentId, { decision: "override", chosenLevel: "low", evidenceNote: "Hemmelig notat" });
    const [event] = await env.events();
    expect(await env.events()).toHaveLength(1);
    expect(event).toMatchObject({
      entityType: "assessmentReview", entityId: id, actorType: "user", actorId: env.fx.userA.userId,
      safeDiff: { decision: { to: "override" }, originalLevel: { to: "high" }, chosenLevel: { to: "low" }, assessmentId: { to: env.assessmentId } },
    });
    expect(JSON.stringify(event)).not.toMatch(/revisjonsrapporten|Hemmelig/);
    expect(event.reason).toBeUndefined();
  });
});
