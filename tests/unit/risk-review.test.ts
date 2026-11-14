import { describe, expect, test } from "vitest";
import { checkRationale, effectiveReview, groupOrder, prioritySort, type ListLevel, type PrioritySortable } from "../../src/domain/risk/review";

describe("begrunnelse", () => {
  test.each([
    ["", "too_short"],
    ["   ok   ", "too_short"],
    ["kort tekst her", "too_short"],
    ["abcdefghijklmnopqrstuvwxyz", "too_few_words"],
    ["ok ok ok ok ok ok ok ok", "repetitive"],
    ["aaaa bbbb aaaa bbbb aaaa bbbb", "repetitive"],
    ["x".repeat(2001), "too_long"],
  ] as const)("avviser %j", (text, reason) => {
    expect(checkRationale(text)).toEqual({ ok: false, reason });
  });

  test("godtar en forklaring og normaliserer mellomrom", () => {
    expect(checkRationale("  Vi har besøkt   fabrikken og sett revisjonsrapporten.\n")).toEqual({
      ok: true,
      text: "Vi har besøkt fabrikken og sett revisjonsrapporten.",
    });
  });
});

describe("kundens gjeldende vurdering", () => {
  const current = { id: "a2", status: "current" as const };
  test("ingen vurdering gir ingen kundevurdering", () => {
    expect(effectiveReview("high", null, current)).toEqual({ state: "none", level: null });
  });
  test("bekreftelse følger screeningen, overstyring gir valgt nivå", () => {
    expect(effectiveReview("high", { decision: "confirm", assessmentId: "a2" }, current)).toEqual({ state: "confirmed", level: "high" });
    expect(effectiveReview("high", { decision: "override", chosenLevel: "low", assessmentId: "a2" }, current)).toEqual({ state: "overridden", level: "low" });
  });
  test("ny screening eller utdatert grunnlag gjør vurderingen utdatert uten gjeldende nivå", () => {
    expect(effectiveReview("high", { decision: "override", chosenLevel: "low", assessmentId: "a1" }, current)).toEqual({ state: "outdated", level: null });
    expect(effectiveReview("high", { decision: "confirm", assessmentId: "a2" }, { id: "a2", status: "stale" })).toEqual({ state: "outdated", level: null });
  });
  test("tilbaketrukket vurdering gir ingen kundevurdering, også etter ny screening", () => {
    expect(effectiveReview("high", { decision: "revoke", assessmentId: "a1" }, current)).toEqual({ state: "revoked", level: null });
  });
});

describe("risikoprioritert rekkefølge", () => {
  const order = groupOrder(["high", "unknown", "moderate", "low"]);
  const row = (id: string, level: ListLevel, spendOre: bigint | null): PrioritySortable => ({ id, nameKey: id, level, spendOre });

  test("gruppene: høy, ukjent, ikke vurdert, moderat, lav", () => {
    expect(order).toEqual(["high", "unknown", "not_assessed", "moderate", "low"]);
  });
  test("manglende eller ufullstendig metode gir standardrekkefølgen", () => {
    expect(groupOrder(undefined)).toEqual(order);
    expect(groupOrder(["low", "bogus"])).toEqual(["low", "high", "unknown", "not_assessed", "moderate"]);
  });
  test("beløp sorterer fallende innenfor nivå; kjent null før ukjent beløp", () => {
    const sorted = prioritySort([row("a", "high", null), row("b", "high", 0n), row("c", "high", 500n), row("d", "high", 9_000n)], order);
    expect(sorted.map((r) => r.id)).toEqual(["d", "c", "b", "a"]);
  });
  test("et enormt beløp flytter aldri lav (eller moderat) foran høy eller ukjent, uansett beløp", () => {
    const levels: ListLevel[] = ["high", "unknown", "not_assessed", "moderate", "low"];
    const amounts = [null, 0n, 1n, 10n ** 18n];
    // Alle kombinasjoner av nivå og beløp: rekkefølgen etter nivå er alltid den samme.
    const rows = levels.flatMap((level) => amounts.map((spend, i) => row(`${level}-${i}`, level, spend)));
    for (let seed = 0; seed < 25; seed++) {
      const shuffled = [...rows].sort((a, b) => Math.sin(seed * 7 + a.id.length * a.id.charCodeAt(0)) - Math.sin(seed * 7 + b.id.length * b.id.charCodeAt(1)));
      const ranks = prioritySort(shuffled, order).map((r) => order.indexOf(r.level));
      expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
    }
  });
  test("stabil ved likt beløp og endrer ikke inndata", () => {
    const input = [row("b", "low", 5n), row("a", "low", 5n)];
    expect(prioritySort(input, order).map((r) => r.id)).toEqual(["a", "b"]);
    expect(input.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
