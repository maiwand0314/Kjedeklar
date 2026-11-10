/**
 * Rapportperiode og virksomhetsprofil som ren logikk (oppgave 08): eksplisitte
 * datoer uten antakelse om kalenderår, og profilsvar der «ikke besvart» og
 * «ikke etablert» aldri blir til en beskrivelse.
 */
import { describe, expect, test } from "vitest";
import { formatPeriod, isIsoDate, suggestPeriod, validatePeriod } from "../../src/domain/reporting/period";
import {
  emptyAnswers,
  MAX_ANSWER_LENGTH,
  normalizeAnswers,
  profileGaps,
  PROFILE_TOPICS,
  type ProfileAnswers,
} from "../../src/domain/reporting/profile";

describe("datoer", () => {
  test.each(["2025-01-01", "2024-02-29", "2100-12-31"])("%s er en gyldig dato", (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  test.each([
    ["2025-02-29", "ikke skuddår"],
    ["2025-02-30", "finnes ikke"],
    ["2025-13-01", "måned 13"],
    ["2025-00-10", "måned 0"],
    ["2025-1-1", "uten ledende null"],
    ["01.01.2025", "norsk format"],
    ["2025-01-01T00:00:00Z", "tidsstempel"],
    ["1999-12-31", "før 2000"],
    ["2101-01-01", "etter 2100"],
    ["", "tom"],
  ])("%s avvises (%s)", (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});

describe("validering av rapportperiode", () => {
  test("kalenderår med frist 30. juni året etter er gyldig", () => {
    expect(validatePeriod({ startDate: "2025-01-01", endDate: "2025-12-31", publicationDueDate: "2026-06-30" })).toEqual({});
  });

  test("avvikende regnskapsår er gyldig og vises med egne datoer", () => {
    const period = { startDate: "2024-07-01", endDate: "2025-06-30", publicationDueDate: "2025-12-31" };
    expect(validatePeriod(period)).toEqual({});
    expect(formatPeriod(period)).toBe("01.07.2024 – 30.06.2025");
  });

  test("frist samme dag som perioden slutter er tillatt", () => {
    expect(validatePeriod({ startDate: "2025-01-01", endDate: "2025-12-31", publicationDueDate: "2025-12-31" })).toEqual({});
  });

  test.each([
    ["slutt før start", "2025-12-31", "2025-01-01"],
    ["slutt samme dag som start", "2025-01-01", "2025-01-01"],
  ])("%s avvises ved sluttdatoen", (_name, startDate, endDate) => {
    expect(validatePeriod({ startDate, endDate, publicationDueDate: "2026-06-30" })).toEqual({
      endDate: "Sluttdatoen må være etter startdatoen.",
    });
  });

  test("frist før periodens slutt avvises", () => {
    expect(validatePeriod({ startDate: "2025-01-01", endDate: "2025-12-31", publicationDueDate: "2025-06-30" })).toEqual({
      publicationDueDate: "Fristen kan ikke være før perioden er slutt.",
    });
  });

  test("ugyldige datoer gir feil per felt, uten følgefeil om rekkefølge", () => {
    expect(validatePeriod({ startDate: "", endDate: "2025-02-30", publicationDueDate: "i juni" })).toEqual({
      startDate: "Velg en gyldig startdato.",
      endDate: "Velg en gyldig sluttdato.",
      publicationDueDate: "Velg en gyldig frist.",
    });
  });
});

describe("forslag til ny periode", () => {
  test("til og med juni foreslås fjoråret, fra juli inneværende år", () => {
    expect(suggestPeriod("2026-06-30", [])).toEqual({ startDate: "2025-01-01", endDate: "2025-12-31", publicationDueDate: "2026-06-30" });
    expect(suggestPeriod("2026-07-01", [])).toEqual({ startDate: "2026-01-01", endDate: "2026-12-31", publicationDueDate: "2027-06-30" });
  });

  test("år som allerede finnes hoppes over; avvikende perioder teller ikke som kalenderår", () => {
    const existing = [
      { startDate: "2025-01-01", endDate: "2025-12-31" },
      { startDate: "2026-01-01", endDate: "2026-12-31" },
      { startDate: "2027-07-01", endDate: "2028-06-30" },
    ];
    expect(suggestPeriod("2026-03-15", existing).startDate).toBe("2027-01-01");
  });

  test("forslaget er alltid en gyldig periode", () => {
    for (const today of ["2026-01-01", "2026-06-30", "2026-07-01", "2026-12-31"]) {
      expect(validatePeriod(suggestPeriod(today, []))).toEqual({});
    }
  });
});

describe("virksomhetsprofil", () => {
  const answers = (patch: Partial<ProfileAnswers>): ProfileAnswers => ({ ...emptyAnswers(), ...patch });

  test("tom profil er gyldig, og alle temaer er ubesvart", () => {
    expect(normalizeAnswers(emptyAnswers())).toEqual(emptyAnswers());
    expect(profileGaps(emptyAnswers())).toEqual(PROFILE_TOPICS.map((t) => t.key));
    expect(profileGaps(null)).toEqual(PROFILE_TOPICS.map((t) => t.key));
  });

  test("beskrivelser trimmes, og tekst uten «beskrevet» lagres ikke", () => {
    const result = normalizeAnswers(
      answers({
        operations: { status: "described", text: "  Import av syntetiske testvarer.  " },
        policies: { status: "not_established", text: "gammel tekst" },
        routines: { status: "unknown", text: "kladd" },
      }),
    );
    expect(result?.operations).toEqual({ status: "described", text: "Import av syntetiske testvarer." });
    expect(result?.policies).toEqual({ status: "not_established", text: "" });
    expect(result?.routines).toEqual({ status: "unknown", text: "" });
  });

  test("«beskrevet» uten tekst eller med for lang tekst avvises", () => {
    expect(normalizeAnswers(answers({ policies: { status: "described", text: "   " } }))).toBeNull();
    expect(normalizeAnswers(answers({ policies: { status: "described", text: "a".repeat(MAX_ANSWER_LENGTH + 1) } }))).toBeNull();
    expect(normalizeAnswers(answers({ policies: { status: "described", text: "a".repeat(MAX_ANSWER_LENGTH) } }))).not.toBeNull();
  });

  test("«ikke etablert» finnes bare for praksistemaer", () => {
    expect(normalizeAnswers(answers({ countries: { status: "not_established", text: "" } }))).toBeNull();
    expect(normalizeAnswers(answers({ remediationProcess: { status: "not_established", text: "" } }))).not.toBeNull();
  });

  test("«ikke etablert» er et svar, ikke et hull; bare ubesvarte temaer er hull", () => {
    const gaps = profileGaps(
      answers({
        organizationDescription: { status: "described", text: "Syntetisk AS" },
        policies: { status: "not_established", text: "" },
      }),
    );
    expect(gaps).not.toContain("organizationDescription");
    expect(gaps).not.toContain("policies");
    expect(gaps).toHaveLength(PROFILE_TOPICS.length - 2);
  });
});
