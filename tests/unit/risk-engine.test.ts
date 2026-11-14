/**
 * Tabelltester av screeningmotoren, med syntetiske nivåer (demo-metoden og
 * landkodene XA–XC). Forventningene følger metodekontrakten (risk-method-v0),
 * ikke fakta om land eller bransjer.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { MethodDefinition } from "../../src/domain/risk/datasets/schema";
import { assess, inputHash, normalizeInput, type EngineData, type EngineInput } from "../../src/domain/risk/engine";

const demoMethod = JSON.parse(readFileSync("risk-data/demo/method-demo-1.json", "utf8")).definition as MethodDefinition;
const REF = { sourceReference: "Syntetisk test" };
const data = (patch: Partial<EngineData> = {}): EngineData => ({
  method: { version: "m1", freshness: "current", definition: demoMethod },
  country: {
    version: "c1",
    freshness: "current",
    entries: [{ iso2: "XA", screeningLevel: "high", ...REF }, { iso2: "XB", screeningLevel: "moderate", ...REF }, { iso2: "XC", screeningLevel: "low", ...REF }],
  },
  industry: {
    version: "i1",
    codeSystem: "SN2007",
    freshness: "current",
    entries: [
      { codePrefix: "00", screeningLevel: "moderate", ...REF },
      { codePrefix: "00.1", screeningLevel: "high", ...REF },
      { codeExact: "00.100", screeningLevel: "low", ...REF },
      { productCategory: "demo-produkt-a", screeningLevel: "high", ...REF },
      { productCategory: "demo-produkt-b", screeningLevel: "low", ...REF },
    ],
  },
  ...patch,
});
const input = (patch: Partial<EngineInput> = {}): EngineInput => ({
  industry: { codeSystem: "SN2007", code: "00.100" },
  productionCountries: ["XC"],
  upstreamUnknown: false,
  purchaseCategory: "demo-produkt-b",
  registry: null,
  ...patch,
});
const fields = (a: ReturnType<typeof assess>) => a.missingFields.map((m) => m.field);

describe("nivå", () => {
  test("ingen faktorer og ingen data: ukjent, aldri lav, med synlige mangler og oppfølging", () => {
    const a = assess(input({ industry: null, productionCountries: [], purchaseCategory: null, upstreamUnknown: true }), data());
    expect(a).toMatchObject({ screeningLevel: "unknown", dataQuality: "insufficient", triggeredRules: [] });
    expect(fields(a)).toEqual(["productionCountries", "industryCode", "productCategory", "upstream"]);
    expect(a.controlSignals).toEqual([{ ruleId: "DATA_GAP_FOLLOW_UP", factor: "data_gap", detail: "industryCode, productCategory, productionCountries, upstream" }]);
  });

  test("bare lave faktorer og ingen mangler: lav og komplett", () => {
    expect(assess(input(), data())).toMatchObject({ screeningLevel: "low", dataQuality: "complete", missingFields: [], controlSignals: [] });
  });

  test("høyeste kjente nivå vinner mellom lav og moderat", () => {
    expect(assess(input({ productionCountries: ["XB", "XC"] }), data()).screeningLevel).toBe("moderate");
    expect(assess(input({ productionCountries: ["XC"], industry: { codeSystem: "SN2007", code: "00.200" } }), data()).screeningLevel).toBe("moderate");
  });

  test("høy faktor gir høy, og en lav faktor kan ikke nøytralisere den", () => {
    const a = assess(input({ productionCountries: ["XA", "XC"] }), data());
    expect(a.screeningLevel).toBe("high");
    expect(a.triggeredRules.map((r) => [r.ruleId, r.input, r.level])).toEqual([
      ["COUNTRY_LEVEL", "XA", "high"],
      ["COUNTRY_LEVEL", "XC", "low"],
      ["INDUSTRY_LEVEL", "00.100", "low"],
      ["PRODUCT_LEVEL", "demo-produkt-b", "low"],
    ]);
    // Høy bransje (lengste prefiks) og høyt produkt slår også gjennom alene.
    expect(assess(input({ industry: { codeSystem: "SN2007", code: "00.150" } }), data()).screeningLevel).toBe("high");
    expect(assess(input({ purchaseCategory: "demo-produkt-a" }), data()).screeningLevel).toBe("high");
  });

  test("eksakt kode har prioritet foran prefiks, og lengste prefiks vinner", () => {
    const entryOf = (code: string) => assess(input({ industry: { codeSystem: "SN2007", code } }), data()).triggeredRules.find((r) => r.factor === "industry")!;
    expect(entryOf("00.100")).toMatchObject({ level: "low", sourceRef: { entry: "exact:00.100" } });
    expect(entryOf("00.150")).toMatchObject({ level: "high", sourceRef: { entry: "prefix:00.1" } });
    expect(entryOf("00.200")).toMatchObject({ level: "moderate", sourceRef: { entry: "prefix:00" } });
  });

  test("høy + ukjent: høy bevares, men kvaliteten er ufullstendig og mangelen synlig", () => {
    const a = assess(input({ productionCountries: ["XA"], industry: null }), data());
    expect(a).toMatchObject({ screeningLevel: "high", dataQuality: "incomplete" });
    expect(a.missingFields).toEqual([{ field: "industryCode", reason: "missing" }]);
  });

  test("lav + vesentlig mangel gir ukjent, ikke lav", () => {
    expect(assess(input({ industry: null }), data())).toMatchObject({ screeningLevel: "unknown", dataQuality: "insufficient" });
    expect(assess(input({ productionCountries: [] }), data())).toMatchObject({ screeningLevel: "unknown" });
  });

  test("mangel som ikke er vesentlig i metoden gir ikke ukjent: ukjent oppstrøms og manglende produktkategori", () => {
    const a = assess(input({ upstreamUnknown: true, purchaseCategory: null }), data());
    expect(a).toMatchObject({ screeningLevel: "low", dataQuality: "incomplete" });
    expect(fields(a)).toEqual(["productCategory", "upstream"]);
  });

  test("hvilke mangler som er vesentlige styres av metoden, ikke av motoren", () => {
    const strict = { ...demoMethod, unknownPolicy: { ...demoMethod.unknownPolicy, materialGaps: ["productionCountry", "industryCode", "productCategory"] as const } } as MethodDefinition;
    expect(assess(input({ purchaseCategory: null }), data({ method: { version: "m2", freshness: "current", definition: strict } })).screeningLevel).toBe("unknown");
  });

  test("metode uten landregel: landdimensjonen vurderes ikke og gir ingen mangel", () => {
    const noCountry = { ...demoMethod, ruleDefinitions: demoMethod.ruleDefinitions.filter((r) => r.factor !== "country") } as MethodDefinition;
    const a = assess(input({ productionCountries: [] }), data({ method: { version: "m3", freshness: "current", definition: noCountry } }));
    expect(a).toMatchObject({ screeningLevel: "low", missingFields: [] });
  });
});

describe("produksjonsland og dekning", () => {
  test("ukjent produksjonsland erstattes aldri: tom liste er en mangel, uansett hva leverandøren ellers har", () => {
    const a = assess(input({ productionCountries: [] }), data());
    expect(a.missingFields).toEqual([{ field: "productionCountries", reason: "missing" }]);
    expect(a.triggeredRules.some((r) => r.factor === "country")).toBe(false);
  });

  test("land som ikke finnes i datasettet er en dekningsmangel, ikke lav risiko", () => {
    const only = assess(input({ productionCountries: ["XZ"] }), data());
    expect(only).toMatchObject({ screeningLevel: "unknown" });
    expect(only.missingFields).toEqual([{ field: "countryCoverage", reason: "not_covered", detail: "XZ" }]);
    expect(assess(input({ productionCountries: ["XC", "XZ"] }), data()).screeningLevel).toBe("unknown");
    expect(assess(input({ productionCountries: ["XA", "XZ"] }), data()).screeningLevel).toBe("high");
  });

  test("manglende datasett er en synlig mangel som gir ukjent", () => {
    const a = assess(input(), data({ country: null }));
    expect(a).toMatchObject({ screeningLevel: "unknown" });
    expect(a.missingFields).toEqual([{ field: "countryData", reason: "source_unavailable" }]);
    expect(assess(input(), data({ industry: null })).missingFields.map((m) => m.field)).toEqual(["industryData", "industryData"]);
  });
});

describe("kodeverk", () => {
  test("kodeversjon som ikke stemmer med datasettet gir ingen mapping og er en synlig mangel", () => {
    const a = assess(input({ industry: { codeSystem: "SN2025", code: "00.100" }, productionCountries: ["XC"] }), data());
    expect(a).toMatchObject({ screeningLevel: "unknown" });
    expect(a.missingFields).toEqual([{ field: "industryMapping", reason: "code_system_mismatch", detail: "SN2025 ≠ SN2007" }]);
  });

  test("kode uten mapping er en dekningsmangel", () => {
    const a = assess(input({ industry: { codeSystem: "SN2007", code: "99.999" } }), data());
    expect(a.missingFields).toEqual([{ field: "industryMapping", reason: "not_covered", detail: "99.999" }]);
    expect(a.screeningLevel).toBe("unknown");
  });

  test("produktkategori mappes ikke fra bransjekoden, og ukjent kategori er en dekningsmangel", () => {
    const a = assess(input({ purchaseCategory: "noe-annet" }), data());
    expect(a.missingFields).toEqual([{ field: "productMapping", reason: "not_covered", detail: "noe-annet" }]);
    expect(a.screeningLevel).toBe("low"); // produkt er ikke vesentlig i demo-metoden
  });
});

describe("utdatert kilde", () => {
  test("utgått kilde er synlig, men fjerner ikke en kjent høy faktor", () => {
    const a = assess(input({ productionCountries: ["XA"] }), data({ country: { ...data().country!, freshness: "review_overdue" } }));
    expect(a).toMatchObject({ screeningLevel: "high", dataQuality: "incomplete", staleSources: [{ source: "country", version: "c1", freshness: "review_overdue" }] });
  });

  test("utgått kilde med lav faktor er fortsatt lav, men aldri komplett", () => {
    expect(assess(input(), data({ industry: { ...data().industry!, freshness: "unreviewed" } }))).toMatchObject({
      screeningLevel: "low",
      dataQuality: "incomplete",
      staleSources: [{ source: "industry", version: "i1", freshness: "unreviewed" }],
    });
    expect(assess(input(), data({ method: { ...data().method, freshness: "review_overdue" } })).staleSources).toEqual([{ source: "method", version: "m1", freshness: "review_overdue" }]);
  });
});

describe("kontrollsignaler", () => {
  const facts = { bankrupt: false, underLiquidation: false, underForcedLiquidation: false, deleted: false };

  test("registerstatus gir oppfølging, men aldri et nivå", () => {
    const base = assess(input(), data());
    for (const flag of ["bankrupt", "underLiquidation", "underForcedLiquidation", "deleted"] as const) {
      const a = assess(input({ registry: { ...facts, [flag]: true } }), data());
      expect(a.controlSignals).toEqual([{ ruleId: "REGISTRY_STATUS_SIGNAL", factor: "registry_status", detail: flag }]);
      expect(a.screeningLevel).toBe(base.screeningLevel);
      expect(a.triggeredRules).toEqual(base.triggeredRules);
    }
  });

  test("ingen merknader og ukjent registerstatus gir ikke signal, og signal løfter aldri en ukjent leverandør til kjent nivå", () => {
    expect(assess(input({ registry: facts }), data()).controlSignals).toEqual([]);
    expect(assess(input({ registry: { ...facts, bankrupt: null } }), data()).controlSignals).toEqual([]);
    expect(assess(input({ industry: null, registry: { ...facts, bankrupt: true } }), data()).screeningLevel).toBe("unknown");
  });
});

describe("determinisme og input", () => {
  test("samme input og versjoner gir identisk resultat, også med land i annen rekkefølge", async () => {
    const raw = { industryCodeSystem: "SN2007", industryCode: "00.100", productionCountries: ["XB", "XA", "XB"], upstreamUnknown: true, purchaseCategory: " Demo-Produkt-B " };
    const first = normalizeInput(raw);
    const second = normalizeInput({ ...raw, productionCountries: ["XA", "XB"] });
    expect(first).toEqual(second);
    expect(await inputHash(first)).toBe(await inputHash(second));
    expect(JSON.stringify(assess(first, data()))).toBe(JSON.stringify(assess(second, data())));
    expect(first.purchaseCategory).toBe("demo-produkt-b");
  });

  test("input har ingen felt for beløp eller registreringsland, og hashen endres bare av det motoren bruker", async () => {
    const base = normalizeInput({ productionCountries: ["XC"], upstreamUnknown: false });
    expect(Object.keys(base).sort()).toEqual(["industry", "productionCountries", "purchaseCategory", "registry", "upstreamUnknown"]);
    // Ekstra felt (beløp, registreringsland, fritekst) ignoreres og kommer aldri inn i input eller hash.
    const withExtras = normalizeInput({ productionCountries: ["XC"], upstreamUnknown: false, spendOre: 999n, registeredCountry: "NO", purchaseDescription: "x" } as never);
    expect(withExtras).toEqual(base);
    expect(await inputHash(withExtras)).toBe(await inputHash(base));
    expect(await inputHash(normalizeInput({ productionCountries: ["XB"], upstreamUnknown: false }))).not.toBe(await inputHash(base));
  });

  test("tom kategori og tomt kodeverk gir null, ikke tom tekst", () => {
    const n = normalizeInput({ productionCountries: [], upstreamUnknown: true, purchaseCategory: "   ", industryCodeSystem: "SN2007" });
    expect(n).toMatchObject({ purchaseCategory: null, industry: null });
  });
});

describe("egenskaper (metamorfe) over et rutenett av input", () => {
  const countrySets = [[], ["XA"], ["XB"], ["XC"], ["XZ"], ["XA", "XC"], ["XB", "XC"], ["XC", "XZ"], ["XA", "XZ"]];
  const industries: EngineInput["industry"][] = [null, { codeSystem: "SN2007", code: "00.100" }, { codeSystem: "SN2007", code: "00.150" }, { codeSystem: "SN2007", code: "00.200" }, { codeSystem: "SN2025", code: "00.100" }, { codeSystem: "SN2007", code: "99.999" }];
  const categories = [null, "demo-produkt-a", "demo-produkt-b", "ukjent-kategori"];
  const grid = countrySets.flatMap((productionCountries) =>
    industries.flatMap((industry) => categories.map((purchaseCategory) => input({ productionCountries, industry, purchaseCategory }))),
  );

  test("kjent høy faktor gir alltid høy, og den kan ikke fjernes ved å legge til lav, ukjent eller utgått kilde", () => {
    for (const i of grid) {
      const a = assess(i, data());
      const hasHigh = a.triggeredRules.some((r) => r.level === "high");
      expect(a.screeningLevel === "high", JSON.stringify(i)).toBe(hasHigh);
      if (hasHigh) {
        const worse = assess({ ...i, upstreamUnknown: true, registry: { bankrupt: true, underLiquidation: null, underForcedLiquidation: false, deleted: true } }, data({ country: { ...data().country!, freshness: "review_overdue" } }));
        expect(worse.screeningLevel).toBe("high");
      }
    }
  });

  test("ukjent er aldri lav: nivået er lavt bare når minst én faktor er kjent og ingen vesentlig mangel finnes", () => {
    for (const i of grid) {
      const a = assess(i, data());
      if (a.screeningLevel === "low") {
        expect(a.triggeredRules.length, JSON.stringify(i)).toBeGreaterThan(0);
        expect(a.missingFields.filter((m) => m.field !== "upstream" && m.field !== "productCategory" && m.field !== "productMapping"), JSON.stringify(i)).toEqual([]);
      }
      if (a.screeningLevel === "unknown") expect(a.dataQuality).toBe("insufficient");
    }
  });

  test("kontrollsignaler og oppstrøms-mangel endrer aldri nivået", () => {
    for (const i of grid) {
      const base = assess(i, data()).screeningLevel;
      expect(assess({ ...i, upstreamUnknown: !i.upstreamUnknown }, data()).screeningLevel).toBe(base);
      expect(assess({ ...i, registry: { bankrupt: true, underLiquidation: true, underForcedLiquidation: true, deleted: true } }, data()).screeningLevel).toBe(base);
    }
  });

  test("resultatet er uavhengig av rekkefølgen på landene", () => {
    for (const i of grid) expect(assess({ ...i, productionCountries: [...i.productionCountries].reverse() }, data()).screeningLevel).toBe(assess(i, data()).screeningLevel);
  });
});
