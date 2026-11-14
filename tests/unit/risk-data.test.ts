/** Validering, checksum og aktiveringsregler for risikodata (ren logikk, ingen backend). */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { canonicalJson, manifestChecksum } from "../../src/domain/risk/datasets/checksum";
import { activationBlockers, datasetFreshness, visibleToTenants, type VersionFacts } from "../../src/domain/risk/datasets/lifecycle";
import { validateManifest } from "../../src/domain/risk/datasets/validate";
import { seal, syntheticCountry, syntheticIndustry, syntheticMethod } from "../helpers/risk-data";

const errorsOf = (raw: unknown) => {
  const result = validateManifest(raw);
  return result.ok ? [] : result.errors;
};
const entries = (raw: Record<string, unknown>) => raw.entries as Record<string, unknown>[];

describe("repoets risikodata", () => {
  test("alle filer under risk-data/ er gyldige og har riktig checksum", async () => {
    for (const dir of readdirSync("risk-data", { withFileTypes: true }).filter((d) => d.isDirectory())) {
      for (const file of readdirSync(join("risk-data", dir.name)).filter((f) => f.endsWith(".json"))) {
        const raw = JSON.parse(readFileSync(join("risk-data", dir.name, file), "utf8"));
        const checked = validateManifest(raw);
        expect(checked.ok, file).toBe(true);
        expect(await manifestChecksum(raw), file).toBe(raw.checksum);
        // Bare tydelig syntetiske demo-fixtures er sjekket inn; ingen ekte data uten faglig godkjenning.
        expect(raw.environment, file).toBe("demo");
        expect(raw.licenseStatus ?? "unclear", file).not.toBe("cleared");
      }
    }
  });
});

describe("validering av land", () => {
  test("gyldig fil", async () => expect(errorsOf(await syntheticCountry("t1"))).toEqual([]));

  test("duplisert land", async () => {
    const raw = await syntheticCountry("t1");
    const dup = await seal({ ...raw, entries: [...entries(raw), entries(raw)[0]] });
    expect(errorsOf(dup)).toEqual([expect.stringContaining("XA finnes flere ganger")]);
  });

  test("manglende kildereferanse og transformasjonsregel", async () => {
    const raw = await syntheticCountry("t1");
    const bad = await seal({ ...raw, entries: [{ ...entries(raw)[0], sourceReference: "  ", transformationNote: undefined }] });
    expect(errorsOf(bad).join("\n")).toMatch(/sourceReference/);
    expect(errorsOf(bad).join("\n")).toMatch(/transformationNote/);
  });

  test("ugyldig ISO-kode; XA–XZ bare i demo", async () => {
    const withCode = (iso2: string, production: boolean) => syntheticCountry("t1", { entries: [{ ...({ originalIndicator: "1", screeningLevel: "low", transformationNote: "x", sourceReference: "y" }), iso2 }] }, production);
    expect(errorsOf(await withCode("ZZ", false))).toEqual([expect.stringContaining("ZZ er ikke en gyldig landkode")]);
    expect(errorsOf(await withCode("XA", true))).toEqual([expect.stringContaining("XA er ikke en gyldig landkode")]);
    expect(errorsOf(await withCode("SE", true))).toEqual([]);
    expect(errorsOf(await withCode("no", true)).length).toBeGreaterThan(0);
  });

  test("uventede felt og ukjent kodeverk avvises", async () => {
    expect(errorsOf(await syntheticCountry("t1", { ekstra: 1 }))).not.toEqual([]);
    expect(errorsOf(await syntheticIndustry("t1", { codeSystem: "SN1999" }))).toEqual([expect.stringContaining("codeSystem")]);
    expect(errorsOf(await syntheticIndustry("t1", { codeSystem: undefined }))).toEqual([expect.stringContaining("codeSystem")]);
  });

  test("kilde-URL må være https, og datoer må være ekte kalenderdatoer", async () => {
    expect(errorsOf(await syntheticCountry("t1", { sourceUrl: "http://example.com/x" }))).not.toEqual([]);
    expect(errorsOf(await syntheticCountry("t1", { retrievedAt: "2026-02-30" }))).toEqual([expect.stringContaining("retrievedAt")]);
    expect(errorsOf(await syntheticCountry("t1", { retrievedAt: "1.11.2026" }))).not.toEqual([]);
  });

  test("review: forfallsdato etter gjennomgang, godkjenning krever review", async () => {
    const review = { reviewer: "R", reviewedAt: "2026-02-01", reviewDueAt: "2026-01-01" };
    expect(errorsOf(await syntheticCountry("t1", { review }))).toEqual([expect.stringContaining("reviewDueAt må ligge etter")]);
    expect(errorsOf(await syntheticCountry("t1", { approval: { approvedBy: "A", approvedAt: "2026-02-01" } }))).toEqual([expect.stringContaining("approval krever review")]);
  });
});

describe("validering av bransjemapping", () => {
  const sameKey = { screeningLevel: "high", sourceReference: "y", rationale: "z" };

  test("tvetydig mapping: samme kode eller prefiks to ganger, også med ulikt nivå", async () => {
    const raw = await syntheticIndustry("t1", { entries: [{ codePrefix: "46", ...sameKey }, { codePrefix: "46", ...sameKey, screeningLevel: "low" }] });
    expect(errorsOf(raw)).toEqual([expect.stringContaining("tvetydig mapping, prefix:46")]);
    const exact = await syntheticIndustry("t1", { entries: [{ codeExact: "46.900", ...sameKey }, { codeExact: "46.900", ...sameKey }] });
    expect(errorsOf(exact)).toEqual([expect.stringContaining("exact:46.900")]);
  });

  test("eksakt kode og prefiks, og prefikser av ulik lengde, er lovlige og løst (eksakt først, lengste prefiks vinner)", async () => {
    const raw = await syntheticIndustry("t1", { entries: [{ codePrefix: "46", ...sameKey }, { codePrefix: "46.9", ...sameKey }, { codeExact: "46.900", ...sameKey }] });
    expect(errorsOf(raw)).toEqual([]);
  });

  test("nøyaktig én av kode, prefiks og produktkategori", async () => {
    const none = await syntheticIndustry("t1", { entries: [{ ...sameKey }] });
    const two = await syntheticIndustry("t1", { entries: [{ codePrefix: "46", codeExact: "46.900", ...sameKey }] });
    expect(errorsOf(none)).toEqual([expect.stringContaining("nøyaktig én")]);
    expect(errorsOf(two)).toEqual([expect.stringContaining("nøyaktig én")]);
  });

  test("ugyldig kodeformat", async () => {
    for (const entry of [{ codeExact: "46" }, { codeExact: "4.6" }, { codePrefix: "46.900" }, { codePrefix: "ab" }]) {
      expect(errorsOf(await syntheticIndustry("t1", { entries: [{ ...entry, ...sameKey }] })), JSON.stringify(entry)).not.toEqual([]);
    }
  });
});

describe("metodekontrakten", () => {
  const method = async (patch: Record<string, unknown>) => {
    const base = await syntheticMethod("m1");
    return syntheticMethod("m1", { definition: { ...(base.definition as object), ...patch } });
  };

  test("gyldig metode", async () => expect(errorsOf(await syntheticMethod("m1"))).toEqual([]));

  test("beløp kan aldri påvirke nivå, og kjent høy faktor vinner alltid", async () => {
    expect(errorsOf(await method({ amountAffectsLevel: true })).join()).toMatch(/amountAffectsLevel/);
    expect(errorsOf(await method({ unknownPolicy: { knownHighWins: false, materialGaps: ["productionCountry"], resultWhenMaterialGap: "unknown" } })).join()).toMatch(/knownHighWins/);
  });

  test("prioritetsrekkefølgen: ukjent før lav, høy først, alle fire nøyaktig én gang", async () => {
    expect(errorsOf(await method({ priorityOrder: ["high", "moderate", "low", "unknown"] })).join()).toMatch(/unknown må komme før low/);
    expect(errorsOf(await method({ priorityOrder: ["unknown", "high", "moderate", "low"] })).join()).toMatch(/high må komme først/);
    expect(errorsOf(await method({ priorityOrder: ["high", "high", "low", "unknown"] })).join()).toMatch(/nøyaktig én gang/);
  });

  test("kontrollsignaler kan ikke være land-, bransje- eller produktfaktorer, og regel-id-er er unike", async () => {
    const rule = { ruleId: "SIGNAL_ONE", kind: "control_signal", description: "x" };
    expect(errorsOf(await method({ ruleDefinitions: [{ ...rule, factor: "country" }] })).join()).toMatch(/kontrollsignal kan ikke bruke faktoren country/);
    expect(errorsOf(await method({ ruleDefinitions: [{ ...rule, factor: "registry_status" }, { ...rule, factor: "data_gap" }] })).join()).toMatch(/finnes flere ganger/);
  });

  test("metoden må si at den er Kjedeklars screening som krever faglig gjennomgang", async () => {
    expect(errorsOf(await method({ requiresProfessionalReview: false })).join()).toMatch(/requiresProfessionalReview/);
    expect(errorsOf(await method({ scope: "juridisk_vurdering" })).join()).toMatch(/scope/);
  });
});

describe("checksum", () => {
  test("rekkefølgen på linjene og nøklene påvirker ikke checksummen", async () => {
    const raw = await syntheticCountry("t1");
    const shuffled = { ...raw, entries: [...entries(raw)].reverse().map((e) => Object.fromEntries(Object.entries(e).reverse())) };
    expect(await manifestChecksum(shuffled as never)).toBe(raw.checksum);
    expect(canonicalJson({ b: 1, a: [2, { d: undefined, c: 3 }] })).toBe('{"a":[2,{"c":3}],"b":1}');
  });

  test("endret innhold, review eller godkjenning gir en annen checksum", async () => {
    const raw = await syntheticCountry("t1", {}, true);
    const change = async (patch: Record<string, unknown>) => manifestChecksum({ ...raw, ...patch } as never);
    expect(await change({})).toBe(raw.checksum);
    expect(await change({ entries: [{ ...entries(raw)[0], screeningLevel: "low" }, entries(raw)[1]] })).not.toBe(raw.checksum);
    expect(await change({ approval: { approvedBy: "Noen andre", approvedAt: "2026-01-20" } })).not.toBe(raw.checksum);
    expect(await change({ licenseStatus: "unclear" })).not.toBe(raw.checksum);
  });
});

describe("aktiveringsregler", () => {
  const good = { today: "2026-11-14", localEnvironment: false, checksumMatches: true, mappingValid: true };
  const production: VersionFacts = { status: "imported", environment: "production", licenseStatus: "cleared", review: { reviewDueAt: "2027-01-01" }, approval: {} };

  test("en gjennomgått, godkjent og avklart produksjonsversjon kan aktiveres, også utenfor lokale miljøer", () => {
    expect(activationBlockers(production, good)).toEqual([]);
  });

  test.each([
    ["demo i produksjon", { ...production, environment: "demo" as const }, good, "DEMO_NOT_ALLOWED"],
    ["uavklart lisens", { ...production, licenseStatus: "unclear" as const }, good, "LICENSE_NOT_CLEARED"],
    ["begrenset lisens", { ...production, licenseStatus: "restricted" as const }, good, "LICENSE_NOT_CLEARED"],
    ["manglende godkjenning", { ...production, approval: undefined }, good, "NOT_APPROVED"],
    ["manglende gjennomgang", { ...production, review: undefined }, good, "NOT_REVIEWED"],
    ["utgått review", { ...production, review: { reviewDueAt: "2026-11-13" } }, good, "REVIEW_OVERDUE"],
    ["endret checksum", production, { ...good, checksumMatches: false }, "CHECKSUM_MISMATCH"],
    ["ugyldig mapping", production, { ...good, mappingValid: false }, "INVALID_MAPPING"],
    ["allerede aktiv", { ...production, status: "active" as const }, good, "NOT_IMPORTED"],
    ["pensjonert", { ...production, status: "retired" as const }, good, "NOT_IMPORTED"],
  ])("%s avvises", (_name, version, check, blocker) => {
    expect(activationBlockers(version, check)).toContain(blocker);
  });

  test("review som forfaller i dag er fortsatt gyldig; dagen etter er den utgått", () => {
    expect(activationBlockers({ ...production, review: { reviewDueAt: "2026-11-14" } }, good)).toEqual([]);
    expect(activationBlockers({ ...production, review: { reviewDueAt: "2026-11-13" } }, good)).toEqual(["REVIEW_OVERDUE"]);
  });

  test("flere hindre rapporteres samlet", () => {
    expect(activationBlockers({ ...production, licenseStatus: "unclear", approval: undefined, review: undefined }, good)).toEqual(["LICENSE_NOT_CLEARED", "NOT_REVIEWED", "NOT_APPROVED"]);
  });

  test("demo kan aktiveres lokalt uten lisens og godkjenning", () => {
    expect(activationBlockers({ status: "imported", environment: "demo", licenseStatus: "unclear" }, { ...good, localEnvironment: true })).toEqual([]);
  });

  test("utdatert kilde er en eksplisitt tilstand, ikke en feil", () => {
    expect(datasetFreshness({ review: { reviewDueAt: "2026-11-14" } }, "2026-11-14")).toBe("current");
    expect(datasetFreshness({ review: { reviewDueAt: "2026-11-13" } }, "2026-11-14")).toBe("review_overdue");
    expect(datasetFreshness({}, "2026-11-14")).toBe("unreviewed");
  });

  test("kunder ser aldri uaktiverte versjoner, og demo bare lokalt", () => {
    expect(visibleToTenants({ status: "imported", environment: "production" }, true)).toBe(false);
    expect(visibleToTenants({ status: "active", environment: "production" }, false)).toBe(true);
    expect(visibleToTenants({ status: "retired", environment: "production" }, false)).toBe(true);
    expect(visibleToTenants({ status: "active", environment: "demo" }, false)).toBe(false);
    expect(visibleToTenants({ status: "active", environment: "demo" }, true)).toBe(true);
  });
});

describe("kommandoen risk-data:validate", () => {
  const run = (...args: string[]) =>
    spawnSync("node", ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/risk-data-validate.ts", ...args], { encoding: "utf8" });

  test("godtar demo-fixturene og avviser en fil med feil checksum med utgangskode 1", async () => {
    const ok = run();
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/OK\s+risk-data\/demo\/country-demo-1\.json/);

    const file = join(mkdtempSync(join(tmpdir(), "risk-data-")), "country.json");
    writeFileSync(file, JSON.stringify({ ...(await syntheticCountry("t1")), checksum: "a".repeat(64) }));
    const bad = run("--file", file);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/checksum stemmer ikke/);
  });
});
