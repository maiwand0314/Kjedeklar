/**
 * Testmatrise for den veiledende pliktvurderingen, bygget på gjeldende § 3
 * bokstav a: «overskrider minst to av tre terskler» på balansedagen, og endret
 * status får virkning først i «det andre av to regnskapsår etter hverandre».
 * Se docs/decisions/0005-pliktvurdering.md.
 */
import { describe, expect, test } from "vitest";
import {
  assess,
  exceedsThresholds,
  RULE_VERSION,
  THRESHOLDS,
  type ApplicabilityInput,
  type YearFigures,
} from "../../src/domain/applicability/assess";
import { formatKroner, toApplicabilityInput } from "../../src/domain/applicability/form";
import { parseFte, parseKronerToOre } from "../../src/domain/applicability/parse";

const MILL = 1_000_000_00n; // én million kroner i øre

/** Tall for ett år: antall overskredne terskler (0–3), resten godt under. */
function year(fiscalYear: number, exceeded: number): YearFigures {
  return {
    fiscalYear,
    salesRevenueOre: exceeded >= 1 ? 80n * MILL : 10n * MILL,
    balanceSheetTotalOre: exceeded >= 2 ? 40n * MILL : 5n * MILL,
    averageFte: exceeded >= 3 ? 60 : 10,
  };
}

/** Ordinært norsk foretak, ikke morselskap, ikke allmenn interesse. */
function input(previous: number, current: number, overrides: Partial<ApplicabilityInput> = {}): ApplicabilityInput {
  return {
    previousYear: year(2024, previous),
    currentYear: year(2025, current),
    previousStatus: "no",
    isParentCompany: "no",
    publicInterestEntity: "no",
    norwegian: "yes",
    ...overrides,
  };
}

describe("terskler i ett år", () => {
  test.each([
    [0, false],
    [1, false],
    [2, true],
    [3, true],
  ])("%i overskredne terskler → overskrider: %s", (count, expected) => {
    expect(exceedsThresholds(year(2025, count))).toBe(expected);
  });

  test("nøyaktig lik terskel er ikke overskredet («overskrider» = strengt over)", () => {
    const equal: YearFigures = {
      fiscalYear: 2025,
      salesRevenueOre: THRESHOLDS.salesRevenueOre,
      balanceSheetTotalOre: THRESHOLDS.balanceSheetTotalOre,
      averageFte: THRESHOLDS.averageFte,
    };
    expect(exceedsThresholds(equal)).toBe(false);
  });

  test("én øre / 0,01 årsverk over terskelen er overskredet", () => {
    expect(
      exceedsThresholds({
        fiscalYear: 2025,
        salesRevenueOre: THRESHOLDS.salesRevenueOre + 1n,
        balanceSheetTotalOre: 0n,
        averageFte: 50.01,
      }),
    ).toBe(true);
  });

  test.each([
    ["to kjente over avgjør, selv om ett tall mangler", { salesRevenueOre: 80n * MILL, balanceSheetTotalOre: 40n * MILL, averageFte: null }, true],
    ["to kjente under avgjør, selv om ett tall mangler", { salesRevenueOre: 1n * MILL, balanceSheetTotalOre: null, averageFte: 5 }, false],
    ["én over, én under, én mangler: uavklart", { salesRevenueOre: 80n * MILL, balanceSheetTotalOre: 1n * MILL, averageFte: null }, null],
    ["alt mangler: uavklart", { salesRevenueOre: null, balanceSheetTotalOre: null, averageFte: null }, null],
  ])("%s", (_name, figures, expected) => {
    expect(exceedsThresholds({ fiscalYear: 2025, ...figures })).toBe(expected);
  });
});

describe("to regnskapsår etter hverandre", () => {
  test.each([
    // forrige år, dette år, tidligere status → resultat
    ["0/0 terskler begge år", 0, 0, "no", "likely_out"],
    ["1/1 terskel begge år", 1, 1, "no", "likely_out"],
    ["2/2 terskler begge år", 2, 2, "no", "likely_in"],
    ["3/3 terskler begge år", 3, 3, "no", "likely_in"],
    ["over begge år: blir omfattet selv om tidligere ikke", 2, 2, "no", "likely_in"],
    ["under begge år: faller ut selv om tidligere omfattet", 0, 0, "yes", "likely_out"],
    ["første år over (ny overgang): ikke omfattet ennå", 1, 2, "no", "likely_out"],
    ["første år over, men allerede omfattet: fortsatt omfattet", 1, 2, "yes", "likely_in"],
    ["første år under, tidligere omfattet: fortsatt omfattet", 3, 1, "yes", "likely_in"],
    ["første år under, ikke omfattet: fortsatt ikke omfattet", 3, 1, "no", "likely_out"],
    ["årene peker hver sin vei og historikken er ukjent", 1, 2, "unknown", "manual_review"],
    ["årene peker hver sin vei (ned) og historikken er ukjent", 2, 0, "unknown", "manual_review"],
  ] as const)("%s", (_name, previous, current, previousStatus, expected) => {
    const result = assess(input(previous, current, { previousStatus }));
    expect(result.result).toBe(expected);
    expect(result.ruleVersion).toBe(RULE_VERSION);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  test("ukjent historikk gir aldri et skråsikkert nei", () => {
    for (const [previous, current] of [[0, 2], [2, 0], [1, 3], [3, 1]]) {
      expect(assess(input(previous, current, { previousStatus: "unknown" })).result).toBe("manual_review");
    }
  });

  test("år som ikke henger sammen gir manuell avklaring", () => {
    const result = assess({ ...input(2, 2), previousYear: year(2023, 2) });
    expect(result.result).toBe("manual_review");
    expect(result.reasons.map((r) => r.code)).toEqual(["years_not_consecutive"]);
  });

  test("ufullstendige tall gir manuell avklaring", () => {
    const result = assess({ ...input(2, 2), currentYear: { fiscalYear: 2025, salesRevenueOre: 80n * MILL, balanceSheetTotalOre: null, averageFte: 10 } });
    expect(result.result).toBe("manual_review");
    expect(result.exceeds.current).toBeNull();
  });
});

describe("konsern, allmenn interesse og tilknytning", () => {
  test.each([
    ["morselskap (konsern vurderes samlet)", { isParentCompany: "yes" }, "group"],
    ["usikkert om morselskap", { isParentCompany: "unknown" }, "group"],
    ["utenlandsk virksomhet", { norwegian: "no" }, "foreign_or_unknown_connection"],
    ["ukjent tilknytning", { norwegian: "unknown" }, "foreign_or_unknown_connection"],
    ["ukjent om allmenn interesse", { publicInterestEntity: "unknown" }, "public_interest_unknown"],
  ] as const)("%s → manuell avklaring", (_name, overrides, code) => {
    // Gjelder både over og under tersklene: utenfor den veiledende automatikken.
    for (const [previous, current] of [[0, 0], [3, 3]]) {
      const result = assess(input(previous, current, overrides));
      expect(result.result).toBe("manual_review");
      expect(result.reasons.map((r) => r.code)).toContain(code);
    }
  });

  test("foretak av allmenn interesse er omfattet selv under tersklene", () => {
    const result = assess(input(0, 0, { publicInterestEntity: "yes" }));
    expect(result.result).toBe("likely_in");
    expect(result.reasons.map((r) => r.code)).toEqual(["public_interest_entity"]);
  });
});

describe("tolking av skjemaverdier", () => {
  test.each([
    ["70 000 000", 70_000_000_00n],
    ["70000000,5", 70_000_000_50n],
    ["35 000 000,05", 35_000_000_05n],
    ["0", 0n],
    ["", null],
    ["-5", undefined],
    ["12,345", undefined],
    ["abc", undefined],
  ] as const)("kroner %j → %s øre", (raw, expected) => {
    expect(parseKronerToOre(raw)).toBe(expected);
  });

  test.each([
    ["49,5", 49.5],
    ["50", 50],
    ["", null],
    ["-1", undefined],
    ["5,123", undefined],
  ] as const)("årsverk %j → %s", (raw, expected) => {
    expect(parseFte(raw)).toBe(expected);
  });
});

describe("skjema → vurderingsgrunnlag", () => {
  const values = {
    previousYear: { fiscalYear: "2024", salesRevenue: "80 000 000", balanceSheetTotal: "40 000 000", averageFte: "" },
    currentYear: { fiscalYear: "2025", salesRevenue: "80 000 000", balanceSheetTotal: "40 000 000", averageFte: "60,5" },
    previousStatus: "unknown",
    isParentCompany: "no",
    publicInterestEntity: "no",
    norwegian: "yes",
  } as const;

  test("gyldige verdier gir grunnlag med øre og ukjente tall som null", () => {
    const parsed = toApplicabilityInput(values);
    if (!("input" in parsed)) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.input.previousYear).toEqual({ fiscalYear: 2024, salesRevenueOre: 80_000_000_00n, balanceSheetTotalOre: 40_000_000_00n, averageFte: null });
    expect(parsed.input.currentYear.averageFte).toBe(60.5);
    expect(assess(parsed.input).result).toBe("likely_in");
  });

  test("ugyldige verdier gir feilmelding per felt og ikke noe grunnlag", () => {
    const parsed = toApplicabilityInput({
      ...values,
      currentYear: { ...values.currentYear, fiscalYear: "25", salesRevenue: "mange" },
    });
    expect(parsed).toEqual({
      errors: {
        "currentYear.fiscalYear": expect.any(String),
        "currentYear.salesRevenue": expect.any(String),
      },
    });
  });

  test.each([
    [70_000_000_00n, "70 000 000 kr"],
    [70_000_000_50n, "70 000 000,50 kr"],
    [null, "ikke oppgitt"],
  ] as const)("formatKroner(%s) → %s", (ore, expected) => {
    expect(formatKroner(ore).replace(/\s/g, " ")).toBe(expected);
  });
});
