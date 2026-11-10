/** Norske beløpsformater → øre, uten flyttall og uten gjetting. */
import { describe, expect, test } from "vitest";
import { formatKroner } from "../../src/domain/applicability/form";
import { parseAmount, type AmountResult } from "../../src/domain/import/amount";

const ok = (ore: bigint): AmountResult => ({ kind: "ok", ore });
const invalid = (reason: "format" | "currency" | "decimals" | "too_large"): AmountResult => ({ kind: "invalid", reason });

describe("automatisk desimaltegn", () => {
  test.each([
    ["125000", 12_500_000n],
    ["125 000", 12_500_000n],
    ["1 250,50", 125_050n],
    ["1 250,50", 125_050n], // hardt mellomrom fra Excel
    ["1 250,50", 125_050n], // smalt hardt mellomrom
    ["1250,5", 125_050n],
    ["12,50", 1_250n],
    ["0,01", 1n],
    ["0", 0n],
    ["0,00", 0n],
    ["007", 700n],
    ["1.234.567,89", 123_456_789n], // punktum som tusenskille
    ["1,234,567.89", 123_456_789n], // amerikansk format
    ["1.234.567", 123_456_700n], // to punktum kan bare være tusenskiller
    ["1.234,5", 123_450n],
    ["1 234.56", 123_456n],
    ["12.50", 1_250n],
    ["1.5", 150n],
    ["kr 2 500,-", 250_000n],
    ["2 500 kr", 250_000n],
    ["NOK 1250,00", 125_000n],
    ["Kr. 99,90", 9_990n],
    ["+100", 10_000n],
  ])("%j → %s øre", (raw, ore) => {
    expect(parseAmount(raw, "auto")).toEqual(ok(ore));
  });

  test("tomt felt er ukjent, ikke null kroner", () => {
    expect(parseAmount("", "auto")).toEqual({ kind: "empty" });
    expect(parseAmount("    ", "auto")).toEqual({ kind: "empty" });
    expect(parseAmount("0", "auto")).toEqual(ok(0n));
  });

  test("stort beløp er eksakt, også over grensen for flyttall", () => {
    // 2^53 + 1 øre: det første heltallet et flyttall ikke kan holde.
    const ore = 9_007_199_254_740_993n;
    expect(parseAmount("90 071 992 547 409,93", "auto")).toEqual(ok(ore));
    expect(Number(ore) === Number(ore - 1n)).toBe(true);
    expect(parseAmount("999 999 999 999 999,99", "auto")).toEqual(ok(99_999_999_999_999_999n));
    expect(parseAmount("1 000 000 000 000 000", "auto")).toEqual(invalid("too_large")); // 16 siffer
  });

  test.each(["1.234", "1,234", "12,345", "123.456", "100,000", "1,000"])(
    "%j kan være tusenskille eller desimaltegn og blir tvetydig, ikke gjettet",
    (raw) => {
      expect(parseAmount(raw, "auto")).toEqual({ kind: "ambiguous" });
    },
  );

  test.each([
    ["-5 000", -500_000n],
    ["−5 000", -500_000n], // typografisk minus
    ["(1 250,50)", -125_050n], // regnskapsformat
    ["1 250-", -125_000n], // minus bak, slik noen økonomisystemer skriver
    ["kr -100", -10_000n],
    ["-kr 100", -10_000n],
    ["-0", 0n],
  ])("negativt beløp %j leses som negativt, så det kan avklares", (raw, ore) => {
    expect(parseAmount(raw, "auto")).toEqual(ok(ore));
  });

  test.each([
    ["EUR 1 000", "currency"],
    ["1 000 €", "currency"],
    ["$250", "currency"],
    ["100 SEK", "currency"],
    ["1,25E+06", "format"], // vitenskapelig notasjon fra regneark
    ["tolv", "format"],
    ["12 34", "format"], // mellomrom som ikke er tusenskille
    ["1.234 567,89", "format"], // to ulike tusenskiller
    ["1,2,3", "format"],
    ["1'234.50", "format"],
    ["=1+1", "format"], // formel
    ["0,125", "decimals"],
    ["1234,567", "decimals"],
    ["12.3456", "decimals"],
  ] as const)("%j avvises (%s)", (raw, reason) => {
    expect(parseAmount(raw, "auto")).toEqual(invalid(reason));
  });
});

describe("visning av beløp", () => {
  test("negative beløp vises med ett minustegn foran, også når bare øredelen er igjen", () => {
    const shown = (ore: bigint) => formatKroner(ore).replace(/\s/g, " ");
    expect(shown(-250_050n)).toBe("−2 500,50 kr");
    expect(shown(-500_000n)).toBe("−5 000 kr");
    expect(shown(-50n)).toBe("−0,50 kr");
    expect(shown(250_050n)).toBe("2 500,50 kr");
    expect(shown(0n)).toBe("0 kr");
  });
});

describe("valgt desimaltegn avklarer tvetydige beløp", () => {
  test("komma som desimaltegn: punktum er tusenskille", () => {
    expect(parseAmount("1.234", "comma")).toEqual(ok(123_400n));
    expect(parseAmount("1.234,5", "comma")).toEqual(ok(123_450n));
    expect(parseAmount("1,234", "comma")).toEqual(invalid("decimals"));
    expect(parseAmount("12.50", "comma")).toEqual(invalid("format"));
  });

  test("punktum som desimaltegn: komma er tusenskille", () => {
    expect(parseAmount("1,234", "dot")).toEqual(ok(123_400n));
    expect(parseAmount("1,234.5", "dot")).toEqual(ok(123_450n));
    expect(parseAmount("1.234", "dot")).toEqual(invalid("decimals"));
    expect(parseAmount("12,50", "dot")).toEqual(invalid("format"));
  });
});
