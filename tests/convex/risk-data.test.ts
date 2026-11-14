/**
 * Import og aktivering av risikodata (interne funksjoner), uforanderlighet,
 * synlighet for kunder og miljøgrenser. Miljøet styres med KJEDEKLAR_ENV:
 * «test» er lokalt, «production» er ikke.
 */
import { afterEach, describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { tenantRules } from "../../convex/lib/rls";
import { seal, syntheticCountry, syntheticIndustry, syntheticMethod } from "../helpers/risk-data";
import { setupTest, twoTenants } from "./setup";

afterEach(() => {
  process.env.KJEDEKLAR_ENV = "test";
});

const OPERATOR = "Test Operatør";
const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as { data?: { code?: string; details?: string[] } }).data ?? { code: String(error) };
  }
  throw new Error("Kallet lyktes, men skulle feilet");
};

async function start() {
  const t = setupTest();
  const fx = await twoTenants(t);
  const a = t.withIdentity(fx.userA.identity);
  const org = { organizationId: fx.orgA };
  const importRaw = (payload: unknown) => t.mutation(internal.risk.internal.importVersion, { operator: OPERATOR, payload });
  const activate = (kind: "country" | "industry" | "method", version: string) =>
    t.mutation(internal.risk.internal.activateVersion, { operator: OPERATOR, kind, version });
  const active = () => a.query(api.risk.queries.activeVersions, org);
  const versions = () => t.run((ctx) => ctx.db.query("riskDatasetVersions").collect());
  const countryEntries = () => t.run((ctx) => ctx.db.query("countryRiskEntries").collect());
  return { t, fx, a, org, importRaw, activate, active, versions, countryEntries };
}

describe("import", () => {
  test("ny versjon importeres uten kodeendring som «imported», med hvem og når, og er ikke synlig for kunder", async () => {
    const env = await start();
    const result = await env.importRaw(await syntheticCountry("c1"));
    expect(result).toEqual({ kind: "country", version: "c1", status: "imported", entryCount: 2 });
    expect(await env.versions()).toMatchObject([
      { kind: "country", version: "c1", status: "imported", environment: "demo", importedBy: OPERATOR, importedAt: expect.any(Number), entryCount: 2 },
    ]);
    expect(await env.countryEntries()).toHaveLength(2);
    expect(await env.active()).toEqual({ country: null, industry: null, method: null });
    const [{ _id }] = await env.versions();
    expect(await errorOf(env.a.query(api.risk.queries.getVersion, { ...env.org, kind: "country", versionId: _id }))).toMatchObject({ code: "NOT_FOUND" });
  });

  test("ugyldig fil importeres ikke, og alle feil rapporteres samlet", async () => {
    const env = await start();
    const raw = await syntheticCountry("c1");
    const bad = await seal({ ...raw, retrievedAt: "2026-02-30", sourceUrl: "http://usikker.example" });
    const error = await errorOf(env.importRaw(bad));
    expect(error.code).toBe("RISK_DATA_INVALID");
    expect(error.details!.length).toBeGreaterThanOrEqual(2);
    expect(await env.versions()).toEqual([]);
    expect(await env.countryEntries()).toEqual([]);
  });

  test("endret innhold uten ny checksum avvises", async () => {
    const env = await start();
    const raw = await syntheticCountry("c1");
    const tampered = { ...raw, entries: [{ ...(raw.entries as object[])[0], screeningLevel: "low" }, (raw.entries as object[])[1]] };
    expect(await errorOf(env.importRaw(tampered))).toMatchObject({ code: "RISK_DATA_INVALID", details: ["checksum stemmer ikke med innholdet"] });
    expect(await env.versions()).toEqual([]);
  });

  test("demo importeres ikke utenfor lokale miljøer", async () => {
    const env = await start();
    process.env.KJEDEKLAR_ENV = "production";
    expect((await errorOf(env.importRaw(await syntheticCountry("c1")))).details).toEqual(["demo-data kan bare importeres i lokale miljøer"]);
    expect(await env.versions()).toEqual([]);
  });

  test("samme versjon kan aldri importeres to ganger, heller ikke med likt eller endret innhold, og den første står uendret", async () => {
    const env = await start();
    await env.importRaw(await syntheticCountry("c1"));
    const before = await env.countryEntries();
    expect(await errorOf(env.importRaw(await syntheticCountry("c1")))).toMatchObject({ code: "RISK_VERSION_EXISTS" });
    const changed = await syntheticCountry("c1", { entries: [{ iso2: "XC", originalIndicator: "1", screeningLevel: "low", transformationNote: "x", sourceReference: "y" }] });
    expect(await errorOf(env.importRaw(changed))).toMatchObject({ code: "RISK_VERSION_EXISTS" });
    expect(await env.countryEntries()).toEqual(before);
    // Samme navn i en annen type er en annen versjon.
    await env.importRaw(await syntheticIndustry("c1"));
    expect(await env.versions()).toHaveLength(2);
  });

  test("metodeversjon importeres på samme måte og avvises hvis den bryter kontrakten", async () => {
    const env = await start();
    expect(await env.importRaw(await syntheticMethod("m1"))).toMatchObject({ kind: "method", version: "m1", status: "imported" });
    const base = await syntheticMethod("m2");
    const bad = await syntheticMethod("m2", { definition: { ...(base.definition as object), amountAffectsLevel: true } });
    expect(await errorOf(env.importRaw(bad))).toMatchObject({ code: "RISK_DATA_INVALID" });
  });

  test("operatørnavn er påkrevd", async () => {
    const env = await start();
    expect(await errorOf(env.t.mutation(internal.risk.internal.importVersion, { operator: "   ", payload: await syntheticCountry("c1") }))).toMatchObject({ code: "RISK_DATA_INVALID" });
  });
});

describe("aktivering og historikk", () => {
  test("aktivering gjør versjonen synlig; ny aktivering pensjonerer den gamle, som forblir lesbar og uendret", async () => {
    const env = await start();
    await env.importRaw(await syntheticCountry("c1"));
    await env.importRaw(await syntheticCountry("c2", { entries: [{ iso2: "XC", originalIndicator: "1", screeningLevel: "moderate", transformationNote: "x", sourceReference: "y" }] }));
    expect(await env.activate("country", "c1")).toEqual({ kind: "country", version: "c1", retiredVersion: null });
    const first = (await env.active()).country!;
    expect(first).toMatchObject({ version: "c1", status: "active", environment: "demo", entryCount: 2, freshness: "unreviewed" });
    const entriesBefore = await env.countryEntries();
    const [c1] = await env.versions();

    expect(await env.activate("country", "c2")).toEqual({ kind: "country", version: "c2", retiredVersion: "c1" });
    expect((await env.active()).country).toMatchObject({ version: "c2", status: "active" });
    // Den gamle er pensjonert, men leses fortsatt og har uendret innhold og metadata.
    expect(await env.a.query(api.risk.queries.getVersion, { ...env.org, kind: "country", versionId: first.id })).toMatchObject({ version: "c1", status: "retired" });
    expect(await env.countryEntries()).toEqual(expect.arrayContaining(entriesBefore));
    const [c1After] = (await env.versions()).filter((v) => v.version === "c1");
    const { status: _s, retiredAt, ...stable } = c1After;
    const { status: _s0, ...stableBefore } = c1;
    void _s; void _s0;
    expect(stable).toEqual(stableBefore);
    expect(retiredAt).toEqual(expect.any(Number));
  });

  test("land, bransje og metode har hver sin aktive versjon", async () => {
    const env = await start();
    await env.importRaw(await syntheticCountry("c1"));
    await env.importRaw(await syntheticIndustry("i1"));
    await env.importRaw(await syntheticMethod("m1"));
    await env.activate("country", "c1");
    await env.activate("industry", "i1");
    await env.activate("method", "m1");
    expect(await env.active()).toMatchObject({
      country: { version: "c1" },
      industry: { version: "i1", codeSystem: "SN2007" },
      method: { version: "m1", entryCount: null },
    });
  });

  test("en versjon kan ikke aktiveres to ganger eller etter pensjonering, og ukjent versjon avvises", async () => {
    const env = await start();
    await env.importRaw(await syntheticCountry("c1"));
    await env.importRaw(await syntheticCountry("c2"));
    await env.activate("country", "c1");
    expect(await errorOf(env.activate("country", "c1"))).toMatchObject({ code: "RISK_ACTIVATION_BLOCKED", details: ["NOT_IMPORTED"] });
    await env.activate("country", "c2");
    expect(await errorOf(env.activate("country", "c1"))).toMatchObject({ details: ["NOT_IMPORTED"] });
    expect(await errorOf(env.activate("country", "finnes-ikke"))).toMatchObject({ code: "RISK_DATA_INVALID" });
  });

  test("tenantfunksjoner ser ikke uaktiverte versjoner, og innholdet er aldri med i svaret", async () => {
    const env = await start();
    await env.importRaw(await syntheticCountry("c1"));
    await env.importRaw(await syntheticCountry("c2"));
    await env.activate("country", "c1");
    const view = (await env.active()).country!;
    expect(Object.keys(view).sort()).toEqual(
      ["activatedAt", "codeSystem", "entryCount", "environment", "freshness", "id", "kind", "licenseStatus", "retrievedAt", "reviewDueAt", "reviewedAt", "sourceEdition", "sourceTitle", "status", "version"],
    );
    const c2 = (await env.versions()).find((v) => v.version === "c2")!;
    expect(await errorOf(env.a.query(api.risk.queries.getVersion, { ...env.org, kind: "country", versionId: c2._id }))).toMatchObject({ code: "NOT_FOUND" });
    // Feil type for id-en gir samme avslag.
    expect(await errorOf(env.a.query(api.risk.queries.getVersion, { ...env.org, kind: "industry", versionId: view.id }))).toMatchObject({ code: "NOT_FOUND" });
  });

  test("kunder kan ikke lese innholdstabellene eller endre noe via innpakket db (RLS)", async () => {
    const env = await start();
    const rules = tenantRules({ organizationId: env.fx.orgA });
    const empty = {} as Record<string, never>;
    await env.importRaw(await syntheticCountry("c1"));
    await env.activate("country", "c1");
    await env.t.run(async (ctx) => {
      const [version] = await ctx.db.query("riskDatasetVersions").collect();
      const [entry] = await ctx.db.query("countryRiskEntries").collect();
      expect(await rules.riskDatasetVersions.read(empty, version)).toBe(true);
      for (const op of ["modify", "insert"] as const) expect(await rules.riskDatasetVersions[op](empty, version)).toBe(false);
      for (const op of ["read", "modify", "insert"] as const) expect(await rules.countryRiskEntries[op](empty, entry)).toBe(false);
    });
  });
});

describe("hindre for aktivering", () => {
  test("produksjonsversjon som er gjennomgått, godkjent og avklart kan aktiveres, også utenfor lokale miljøer", async () => {
    const env = await start();
    await env.importRaw(await syntheticCountry("p1", {}, true));
    process.env.KJEDEKLAR_ENV = "production";
    await env.activate("country", "p1");
    expect((await env.active()).country).toMatchObject({ version: "p1", environment: "production", freshness: "current", reviewDueAt: "2999-01-15" });
  });

  test("demo avvises utenfor lokale miljøer, og kunder ser aldri aktiv demo der", async () => {
    const env = await start();
    await env.importRaw(await syntheticCountry("d1"));
    await env.activate("country", "d1");
    expect((await env.active()).country).toMatchObject({ version: "d1", environment: "demo" });
    process.env.KJEDEKLAR_ENV = "production";
    expect((await env.active()).country).toBeNull(); // forsvar i dybden, selv om en demo skulle stå som aktiv
    process.env.KJEDEKLAR_ENV = "test";
    await env.importRaw(await syntheticIndustry("d3"));
    process.env.KJEDEKLAR_ENV = "production";
    expect(await errorOf(env.activate("industry", "d3"))).toMatchObject({ code: "RISK_ACTIVATION_BLOCKED", details: ["DEMO_NOT_ALLOWED"] });
  });

  test.each([
    ["uavklart lisens", { licenseStatus: "unclear" }, "LICENSE_NOT_CLEARED"],
    ["begrenset lisens", { licenseStatus: "restricted" }, "LICENSE_NOT_CLEARED"],
    ["manglende godkjenning", { approval: undefined }, "NOT_APPROVED"],
    ["manglende gjennomgang", { review: undefined, approval: undefined }, "NOT_REVIEWED"],
    ["utgått review", { retrievedAt: "2019-12-01", review: { reviewer: "R", reviewedAt: "2020-01-01", reviewDueAt: "2020-06-01" } }, "REVIEW_OVERDUE"],
  ])("produksjon avvises: %s", async (_name, overrides, blocker) => {
    const env = await start();
    await env.importRaw(await syntheticCountry("p1", overrides, true));
    const error = await errorOf(env.activate("country", "p1"));
    expect(error).toMatchObject({ code: "RISK_ACTIVATION_BLOCKED" });
    expect(error.details).toContain(blocker);
    expect(await env.active()).toMatchObject({ country: null });
    expect((await env.versions())[0]).toMatchObject({ status: "imported" });
  });

  test("avvist aktivering lar eksisterende aktiv versjon stå", async () => {
    const env = await start();
    await env.importRaw(await syntheticCountry("p1", {}, true));
    await env.importRaw(await syntheticCountry("p2", { licenseStatus: "unclear" }, true));
    await env.activate("country", "p1");
    await errorOf(env.activate("country", "p2"));
    expect((await env.active()).country).toMatchObject({ version: "p1", status: "active" });
  });

  test("lagret innhold som er endret etter import (checksum) eller har ugyldig mapping avvises", async () => {
    const env = await start();
    await env.importRaw(await syntheticCountry("p1", {}, true));
    await env.importRaw(await syntheticCountry("p2", {}, true));
    await env.t.run(async (ctx) => {
      const [version] = await ctx.db.query("riskDatasetVersions").withIndex("by_kind_and_version", (q) => q.eq("kind", "country").eq("version", "p1")).collect();
      const entry = await ctx.db.query("countryRiskEntries").withIndex("by_datasetVersionId_and_iso2", (q) => q.eq("datasetVersionId", version._id)).first();
      await ctx.db.patch("countryRiskEntries", entry!._id, { screeningLevel: "low" });
      const other = await ctx.db.query("riskDatasetVersions").withIndex("by_kind_and_version", (q) => q.eq("kind", "country").eq("version", "p2")).first();
      const dup = await ctx.db.query("countryRiskEntries").withIndex("by_datasetVersionId_and_iso2", (q) => q.eq("datasetVersionId", other!._id)).first();
      const { _id, _creationTime, ...copy } = dup!;
      void _id; void _creationTime;
      await ctx.db.insert("countryRiskEntries", copy);
    });
    expect((await errorOf(env.activate("country", "p1"))).details).toEqual(["CHECKSUM_MISMATCH"]);
    expect((await errorOf(env.activate("country", "p2"))).details).toEqual(["CHECKSUM_MISMATCH", "INVALID_MAPPING"]);
  });

  test("utdatert kilde er en synlig tilstand: aktiv versjon som passerer forfallsdatoen vises som «review_overdue»", async () => {
    const env = await start();
    await env.importRaw(await syntheticCountry("p1", {}, true));
    await env.activate("country", "p1");
    expect((await env.active()).country).toMatchObject({ freshness: "current" });
    await env.t.run(async (ctx) => {
      const [version] = await ctx.db.query("riskDatasetVersions").collect();
      await ctx.db.patch("riskDatasetVersions", version._id, { review: { reviewer: "R", reviewedAt: "2020-01-01", reviewDueAt: "2020-06-01" } });
    });
    // Fortsatt aktiv og lesbar, men merket, så risikomotoren og brukeren ser det.
    expect((await env.active()).country).toMatchObject({ status: "active", freshness: "review_overdue", reviewDueAt: "2020-06-01" });
  });
});
