/**
 * Lagring av screeningvurderinger: reproduserbare snapshots, historikk som bevares,
 * «utdatert» ved endret grunnlag eller versjon, beløp som aldri påvirker noe,
 * og tenantvern. Grunnlaget er de syntetiske demo-filene i risk-data/demo/.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ASSESS_BATCH_SIZE } from "../../convex/risk/assessments";
import { SYNTHETIC_PERIOD, SYNTHETIC_SUPPLIER_DOC } from "../helpers/public-functions";
import { seal } from "../helpers/risk-data";
import { expectAppError, setupTest, twoTenants } from "./setup";

afterEach(() => {
  process.env.KJEDEKLAR_ENV = "test";
});

const demo = (name: string) => JSON.parse(readFileSync(`risk-data/demo/${name}-demo-1.json`, "utf8")) as Record<string, unknown>;
const OPERATOR = "Test";

async function start({ activate = true } = {}) {
  const t = setupTest();
  const fx = await twoTenants(t);
  const a = t.withIdentity(fx.userA.identity);
  const b = t.withIdentity(fx.userB.identity);
  const importRaw = (payload: unknown) => t.mutation(internal.risk.internal.importVersion, { operator: OPERATOR, payload });
  const activateVersion = (kind: "country" | "industry" | "method", version: string) => t.mutation(internal.risk.internal.activateVersion, { operator: OPERATOR, kind, version });
  if (activate) {
    for (const [kind, name] of [["country", "country"], ["industry", "industry"], ["method", "method"]] as const) {
      const manifest = demo(name);
      await importRaw(manifest);
      await activateVersion(kind, manifest.version as string);
    }
  }
  const periodId = (organizationId: Id<"organizations">) =>
    t.run((ctx) => ctx.db.insert("reportingPeriods", { organizationId, ...SYNTHETIC_PERIOD, status: "open", createdAt: 0, createdBy: "oppsett" }));
  const supplier = (organizationId: Id<"organizations">, fields: Record<string, unknown> = {}) =>
    t.run((ctx) => ctx.db.insert("suppliers", { organizationId, ...SYNTHETIC_SUPPLIER_DOC, createdAt: 0, createdBy: "oppsett", ...fields }) as Promise<Id<"suppliers">>);
  const periodRow = (organizationId: Id<"organizations">, supplierId: Id<"suppliers">, reportingPeriodId: Id<"reportingPeriods">, fields: Record<string, unknown> = {}) =>
    t.run((ctx) =>
      ctx.db.insert("supplierPeriods", { organizationId, supplierId, reportingPeriodId, productionCountries: [], upstreamUnknown: true, rowVersion: 1, updatedAt: 0, updatedBy: "oppsett", ...fields }),
    );
  const assessments = () => t.run((ctx) => ctx.db.query("riskAssessments").collect());
  const run = (reportingPeriodId: string, cursor: string | null = null, client = a, organizationId = fx.orgA) =>
    client.mutation(api.risk.assessments.assessPeriod, { organizationId, reportingPeriodId, cursor });
  const latest = (supplierId: string, reportingPeriodId: string, client = a, organizationId = fx.orgA) =>
    client.query(api.risk.assessments.latest, { organizationId, supplierId, reportingPeriodId });
  const history = (supplierId: string, reportingPeriodId: string) =>
    a.query(api.risk.assessments.history, { organizationId: fx.orgA, supplierId, reportingPeriodId });
  return { t, fx, a, b, importRaw, activateVersion, periodId, supplier, periodRow, assessments, run, latest, history };
}

/** Leverandør med kjent land (XA = høy i demo), bransjekode og kategori, klar til vurdering. */
async function highSupplier(env: Awaited<ReturnType<typeof start>>) {
  const reportingPeriodId = await env.periodId(env.fx.orgA);
  const supplierId = await env.supplier(env.fx.orgA, { industryCodeSystem: "SN2007", industryCode: "00.100" });
  const rowId = await env.periodRow(env.fx.orgA, supplierId, reportingPeriodId, { productionCountries: ["XA"], upstreamUnknown: false, purchaseCategory: "demo-produkt-b", spendOre: 100_000n });
  return { reportingPeriodId, supplierId, rowId };
}

describe("vurdering", () => {
  test("lagrer en reproduserbar vurdering med snapshot, hash, versjonsreferanser, regler med kildereferanser og audit", async () => {
    const env = await start();
    const { reportingPeriodId, supplierId, rowId } = await highSupplier(env);
    expect(await env.run(reportingPeriodId)).toEqual({ assessed: 1, unchanged: 0, nextCursor: null });

    const [doc] = await env.assessments();
    const versions = await env.t.run((ctx) => ctx.db.query("riskDatasetVersions").collect());
    const method = (await env.t.run((ctx) => ctx.db.query("riskMethodVersions").collect()))[0];
    expect(doc).toMatchObject({
      organizationId: env.fx.orgA, supplierId, reportingPeriodId, supplierPeriodId: rowId,
      methodVersionId: method._id,
      countryDatasetVersionId: versions.find((v) => v.kind === "country")!._id,
      industryDatasetVersionId: versions.find((v) => v.kind === "industry")!._id,
      engineVersion: "risk-engine-v1",
      assessedBy: env.fx.userA.userId,
      inputHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      screeningLevel: "high",
      dataQuality: "incomplete", // demo-kildene er ikke gjennomgått
      inputSnapshot: { industry: { codeSystem: "SN2007", code: "00.100" }, productionCountries: ["XA"], upstreamUnknown: false, purchaseCategory: "demo-produkt-b", registry: null },
    });
    // Produktkategorien finnes ikke i demo-datasettet: den er en synlig dekningsmangel, ikke en regel som slo til.
    expect(doc.triggeredRules.map((r) => [r.ruleId, r.input, r.level, r.sourceRef.version, r.sourceRef.entry])).toEqual([
      ["COUNTRY_LEVEL", "XA", "high", "demo-country-1", "XA"],
      ["INDUSTRY_LEVEL", "00.100", "low", "demo-industry-1", "exact:00.100"],
    ]);
    expect(doc.missingFields).toEqual([{ field: "productMapping", reason: "not_covered", detail: "demo-produkt-b" }]);
    expect(doc.staleSources.map((s) => s.freshness)).toEqual(["unreviewed", "unreviewed", "unreviewed"]);
    expect((await env.t.run((ctx) => ctx.db.query("auditEvents").collect())).filter((e) => e.eventType === "risk.assessed")).toMatchObject([
      { entityType: "reportingPeriod", entityId: reportingPeriodId, actorType: "user", safeDiff: { riskAssessed: { to: 1 }, riskUnchanged: { to: 0 } } },
    ]);
    expect(await env.latest(supplierId, reportingPeriodId)).toMatchObject({ status: "current", staleReasons: [], screeningLevel: "high", methodVersion: "demo-method-1", countryVersion: "demo-country-1" });
  });

  test("uten aktiv metodeversjon kan ingenting vurderes, og uten datasett blir mangelen synlig", async () => {
    const env = await start({ activate: false });
    const { reportingPeriodId, supplierId } = await highSupplier(env);
    await expectAppError(env.run(reportingPeriodId), "RISK_METHOD_MISSING");
    const method = demo("method");
    await env.importRaw(method);
    await env.activateVersion("method", method.version as string);
    await env.run(reportingPeriodId);
    expect(await env.latest(supplierId, reportingPeriodId)).toMatchObject({
      screeningLevel: "unknown",
      dataQuality: "insufficient",
      countryVersion: null,
      missingFields: expect.arrayContaining([{ field: "countryData", reason: "source_unavailable" }]),
    });
  });

  test("uendret grunnlag og versjoner gir ingen ny vurdering", async () => {
    const env = await start();
    const { reportingPeriodId } = await highSupplier(env);
    await env.run(reportingPeriodId);
    expect(await env.run(reportingPeriodId)).toEqual({ assessed: 0, unchanged: 1, nextCursor: null });
    expect(await env.assessments()).toHaveLength(1);
  });

  test("innkjøpsbeløp påvirker aldri vurderingen: hash, nivå og status er uendret, og ingen ny vurdering lages", async () => {
    const env = await start();
    const { reportingPeriodId, supplierId, rowId } = await highSupplier(env);
    await env.run(reportingPeriodId);
    const [before] = await env.assessments();
    for (const spendOre of [0n, 1n, 999_999_999_999n]) {
      await env.t.run((ctx) => ctx.db.patch("supplierPeriods", rowId, { spendOre }));
      expect(await env.run(reportingPeriodId)).toMatchObject({ assessed: 0, unchanged: 1 });
      expect(await env.latest(supplierId, reportingPeriodId)).toMatchObject({ status: "current", screeningLevel: before.screeningLevel });
    }
    await env.t.run((ctx) => ctx.db.patch("supplierPeriods", rowId, { spendOre: undefined }));
    expect(await env.assessments()).toEqual([before]);
  });

  test("registreringsland erstatter ikke ukjent produksjonsland", async () => {
    const env = await start();
    const reportingPeriodId = await env.periodId(env.fx.orgA);
    const supplierId = await env.supplier(env.fx.orgA, { registeredCountry: "NO", industryCodeSystem: "SN2007", industryCode: "00.100" });
    await env.periodRow(env.fx.orgA, supplierId, reportingPeriodId, { productionCountries: [] });
    await env.run(reportingPeriodId);
    expect(await env.latest(supplierId, reportingPeriodId)).toMatchObject({
      screeningLevel: "unknown",
      missingFields: expect.arrayContaining([{ field: "productionCountries", reason: "missing" }]),
    });
    expect((await env.assessments())[0].inputSnapshot).not.toHaveProperty("registeredCountry");
  });

  test("leverandør uten innkjøpsdata for perioden vurderes som ukjent, uten supplierPeriodId; arkiverte hoppes over", async () => {
    const env = await start();
    const reportingPeriodId = await env.periodId(env.fx.orgA);
    const bare = await env.supplier(env.fx.orgA);
    await env.supplier(env.fx.orgA, { status: "archived", nameKey: "arkivert" });
    expect(await env.run(reportingPeriodId)).toMatchObject({ assessed: 1 });
    const [doc] = await env.assessments();
    expect(doc).toMatchObject({ supplierId: bare, screeningLevel: "unknown", dataQuality: "insufficient", inputSnapshot: { upstreamUnknown: true, productionCountries: [] } });
    expect(doc).not.toHaveProperty("supplierPeriodId");
  });

  test("registerstatus blir kontrollsignal uten å endre nivået, og endret registerstatus gjør vurderingen utdatert", async () => {
    const env = await start();
    const { reportingPeriodId, supplierId } = await highSupplier(env);
    await env.t.run((ctx) => ctx.db.patch("suppliers", supplierId, { registryOrgNumber: "920000010" }));
    const snapshot = (bankrupt: boolean) =>
      env.t.run(async (ctx) => {
        const id = await ctx.db.insert("registrySnapshots", {
          organizationId: env.fx.orgA, supplierId, source: "brreg-enhetsregisteret", orgNumber: "920000010", fetchedAt: 1, fetchedBy: "x", status: "fetched",
          sourcePayloadHash: "0".repeat(64), mappingVersion: "brreg-enhet-v1",
          selectedFields: { orgNumber: "920000010", name: "X", legalForm: "AS", legalFormDescription: null, address: null, addressKind: null, industryCode: null, industryDescription: null, industryCodeSystem: "SN", bankrupt, underLiquidation: false, underForcedLiquidation: false, deletedOn: null },
        });
        const jobId = await ctx.db.insert("jobs", { organizationId: env.fx.orgA, type: "brreg.enrich", inputRef: supplierId, idempotencyKey: `k${bankrupt}`, status: "succeeded", attempts: 1, maxAttempts: 4, runAfter: 0, createdAt: 0, createdBy: "x" });
        await ctx.db.patch("suppliers", supplierId, { registryEnrichment: { sequence: 1, jobId, orgNumber: "920000010", state: "succeeded", requestedAt: 0, snapshotId: id, fetchedAt: 1 } });
      });
    await snapshot(false);
    await env.run(reportingPeriodId);
    const registrySignals = (signals: { ruleId: string }[]) => signals.filter((c) => c.ruleId === "REGISTRY_STATUS_SIGNAL");
    expect(registrySignals((await env.assessments())[0].controlSignals)).toEqual([]);

    await snapshot(true);
    expect(await env.latest(supplierId, reportingPeriodId)).toMatchObject({ status: "stale", staleReasons: ["input_changed"] });
    await env.run(reportingPeriodId);
    const latest = await env.latest(supplierId, reportingPeriodId);
    expect(latest).toMatchObject({ status: "current", screeningLevel: "high" });
    expect(registrySignals(latest!.controlSignals)).toMatchObject([{ factor: "registry_status", detail: "bankrupt" }]);
  });
});

describe("utdatert og historikk", () => {
  test("endret leverandørinput gir ny vurdering og merker den gamle som utdatert, og historikken bevares uendret", async () => {
    const env = await start();
    const { reportingPeriodId, supplierId, rowId } = await highSupplier(env);
    await env.run(reportingPeriodId);
    const [first] = await env.assessments();

    await env.t.run((ctx) => ctx.db.patch("supplierPeriods", rowId, { productionCountries: ["XC"] }));
    expect(await env.latest(supplierId, reportingPeriodId)).toMatchObject({ status: "stale", staleReasons: ["input_changed"], screeningLevel: "high" });
    expect(await env.run(reportingPeriodId)).toMatchObject({ assessed: 1, unchanged: 0 });

    const all = await env.assessments();
    expect(all).toHaveLength(2);
    expect(all.find((a) => a._id === first._id)).toEqual(first); // den gamle er uendret
    expect(await env.latest(supplierId, reportingPeriodId)).toMatchObject({ status: "current", screeningLevel: "low", id: all.find((a) => a._id !== first._id)!._id });
    expect((await env.history(supplierId, reportingPeriodId)).map((h) => h.screeningLevel)).toEqual(["low", "high"]);
  });

  test("endret leverandørprofil (næringskode) gjør vurderingen utdatert", async () => {
    const env = await start();
    const { reportingPeriodId, supplierId } = await highSupplier(env);
    await env.run(reportingPeriodId);
    await env.t.run((ctx) => ctx.db.patch("suppliers", supplierId, { industryCode: "00.200" }));
    expect(await env.latest(supplierId, reportingPeriodId)).toMatchObject({ status: "stale", staleReasons: ["input_changed"] });
  });

  test("ny metodeversjon, nytt landdatasett og nytt bransjedatasett merker gammel vurdering som utdatert; ny kjøring gir ny rad med nye referanser", async () => {
    const env = await start();
    const { reportingPeriodId, supplierId } = await highSupplier(env);
    await env.run(reportingPeriodId);
    const [first] = await env.assessments();

    const newMethod = await seal({ ...demo("method"), version: "demo-method-2", checksum: undefined });
    const newCountry = await seal({ ...demo("country"), version: "demo-country-2", checksum: undefined });
    const newIndustry = await seal({ ...demo("industry"), version: "demo-industry-2", checksum: undefined });
    await env.importRaw(newMethod);
    await env.activateVersion("method", "demo-method-2");
    expect((await env.latest(supplierId, reportingPeriodId))!.staleReasons).toEqual(["method_changed", "source_freshness_changed"]);
    await env.importRaw(newCountry);
    await env.activateVersion("country", "demo-country-2");
    await env.importRaw(newIndustry);
    await env.activateVersion("industry", "demo-industry-2");
    expect((await env.latest(supplierId, reportingPeriodId))!.staleReasons).toEqual(["method_changed", "country_data_changed", "industry_data_changed", "source_freshness_changed"]);

    await env.run(reportingPeriodId);
    expect(await env.latest(supplierId, reportingPeriodId)).toMatchObject({ status: "current", methodVersion: "demo-method-2", countryVersion: "demo-country-2", industryVersion: "demo-industry-2" });
    // Den gamle vurderingen peker fortsatt på de gamle (nå pensjonerte) versjonene og kan leses.
    expect((await env.history(supplierId, reportingPeriodId)).map((h) => [h.methodVersion, h.countryVersion])).toEqual([["demo-method-2", "demo-country-2"], ["demo-method-1", "demo-country-1"]]);
    expect((await env.assessments()).find((a) => a._id === first._id)).toEqual(first);
  });

  test("en kilde som passerer forfallsdatoen etter vurderingen gjør den utdatert, og ny vurdering viser utgått kilde uten å miste kjent høy faktor", async () => {
    const env = await start();
    const { reportingPeriodId, supplierId } = await highSupplier(env);
    await env.t.run(async (ctx) => {
      const country = await ctx.db.query("riskDatasetVersions").withIndex("by_kind_and_version", (q) => q.eq("kind", "country").eq("version", "demo-country-1")).first();
      await ctx.db.patch("riskDatasetVersions", country!._id, { review: { reviewer: "R", reviewedAt: "2999-01-01", reviewDueAt: "2999-06-01" } });
    });
    await env.run(reportingPeriodId);
    expect((await env.assessments())[0].staleSources.map((s) => s.source).sort()).toEqual(["industry", "method"]);
    await env.t.run(async (ctx) => {
      const country = await ctx.db.query("riskDatasetVersions").withIndex("by_kind_and_version", (q) => q.eq("kind", "country").eq("version", "demo-country-1")).first();
      await ctx.db.patch("riskDatasetVersions", country!._id, { review: { reviewer: "R", reviewedAt: "2020-01-01", reviewDueAt: "2020-06-01" } });
    });
    expect(await env.latest(supplierId, reportingPeriodId)).toMatchObject({ status: "stale", staleReasons: ["source_freshness_changed"] });
    await env.run(reportingPeriodId);
    expect(await env.latest(supplierId, reportingPeriodId)).toMatchObject({
      status: "current",
      screeningLevel: "high",
      staleSources: expect.arrayContaining([{ source: "country", version: "demo-country-1", freshness: "review_overdue" }]),
    });
  });
});

describe("bulk", () => {
  test("flere leverandører enn én side deles med markør, og en ny kjøring regner ikke på nytt", async () => {
    const env = await start();
    const reportingPeriodId = await env.periodId(env.fx.orgA);
    const total = ASSESS_BATCH_SIZE + 5;
    for (let i = 0; i < total; i++) {
      const name = `Bulk ${String(i).padStart(3, "0")} AS`;
      await env.supplier(env.fx.orgA, { name, nameKey: name.toLowerCase() });
    }
    const first = await env.run(reportingPeriodId);
    expect(first).toMatchObject({ assessed: ASSESS_BATCH_SIZE, unchanged: 0, nextCursor: expect.any(String) });
    const second = await env.run(reportingPeriodId, first.nextCursor);
    expect(second).toEqual({ assessed: 5, unchanged: 0, nextCursor: null });
    expect(await env.assessments()).toHaveLength(total);
    // Første side på nytt: alt er uendret.
    expect(await env.run(reportingPeriodId)).toMatchObject({ assessed: 0, unchanged: ASSESS_BATCH_SIZE });
  });
});

describe("tenantvern", () => {
  test("organisasjon B kan ikke vurdere, lese status eller historikk for A, og en ugyldig markør eller id gir samme avslag", async () => {
    const env = await start();
    const { reportingPeriodId, supplierId } = await highSupplier(env);
    await env.run(reportingPeriodId);
    const asB = { client: env.b, org: env.fx.orgB };
    await expectAppError(env.run(reportingPeriodId, null, asB.client, asB.org), "NOT_FOUND");
    await expectAppError(env.latest(supplierId, reportingPeriodId, asB.client, asB.org), "NOT_FOUND");
    await expectAppError(env.b.query(api.risk.assessments.history, { organizationId: env.fx.orgB, supplierId, reportingPeriodId }), "NOT_FOUND");
    // B sin egen periode med A sin leverandør: også «ikke funnet».
    const own = await env.periodId(env.fx.orgB);
    await expectAppError(env.latest(supplierId, own, asB.client, asB.org), "NOT_FOUND");
    expect(await env.assessments()).toHaveLength(1);
  });

  test("hver organisasjon vurderer bare sine egne leverandører", async () => {
    const env = await start();
    const mine = await env.periodId(env.fx.orgA);
    const theirs = await env.periodId(env.fx.orgB);
    const a1 = await env.supplier(env.fx.orgA);
    const b1 = await env.supplier(env.fx.orgB);
    await env.run(mine);
    await env.run(theirs, null, env.b, env.fx.orgB);
    const all = await env.assessments();
    expect(all.map((x) => [x.organizationId, x.supplierId, x.reportingPeriodId]).sort()).toEqual(
      [[env.fx.orgA, a1, mine], [env.fx.orgB, b1, theirs]].sort(),
    );
  });

  test("tenantfunksjoner kan ikke lese innholdstabellene, og motorens data er bare tilgjengelig via den interne queryen", async () => {
    const env = await start();
    const data = await env.t.query(internal.risk.internal.engineData, {});
    expect(data.country?.entries.map((e) => e.iso2).sort()).toEqual(["XA", "XB", "XC"]);
    expect(data.method?.definition.scope).toBe("kjedeklar_screening");
    expect(Object.keys(await env.a.query(api.risk.queries.activeVersions, { organizationId: env.fx.orgA }))).toEqual(["country", "industry", "method"]);
  });
});
