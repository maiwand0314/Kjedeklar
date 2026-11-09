/**
 * Veiledende vurdering av om åpenhetsloven gjelder (§§ 2–3). Ren TypeScript uten
 * Convex/Next. Resultatet er aldri en juridisk konklusjon: uklare tilfeller gir
 * manuell avklaring, aldri et skråsikkert nei. Sannhetstabell og kilde:
 * docs/decisions/0005-pliktvurdering.md.
 */

/** Gjeldende ordlyd i § 3 bokstav a (endret ved lov 21. juni 2024 nr. 42, i kraft 1. november 2024). */
export const RULE_VERSION = "apenhetsloven-3a-2024-11-01-v1";
export const RULE_SOURCE = "Åpenhetsloven §§ 2–3 (LOV-2021-06-18-99), lest på Lovdata 9. november 2026";

/** Tersklene «overskrides» bare når verdien er strengt større (lik terskel er ikke overskredet). */
export const THRESHOLDS = {
  salesRevenueOre: 70_000_000_00n,
  balanceSheetTotalOre: 35_000_000_00n,
  averageFte: 50,
} as const;

export type YearFigures = {
  fiscalYear: number;
  salesRevenueOre: bigint | null;
  balanceSheetTotalOre: bigint | null;
  /** Gjennomsnittlige årsverk i regnskapsåret. Ikke Brregs antallAnsatte. */
  averageFte: number | null;
};

export type Answer = "yes" | "no" | "unknown";

export type ApplicabilityInput = {
  currentYear: YearFigures;
  previousYear: YearFigures;
  /** Var virksomheten omfattet for forrige regnskapsår? Trengs når årene peker hver sin vei. */
  previousStatus: Answer;
  /** Morselskap: tersklene gjelder mor og datter samlet. */
  isParentCompany: Answer;
  /** Foretak av allmenn interesse etter regnskapsloven § 1-6. */
  publicInterestEntity: Answer;
  /** Hjemmehørende i Norge (§ 2 første ledd). Utenlandske virksomheter vurderes manuelt. */
  norwegian: Answer;
};

export type ApplicabilityResult = "likely_in" | "likely_out" | "manual_review";

export type Reason = { code: string; text: string };

export type Assessment = {
  result: ApplicabilityResult;
  reasons: Reason[];
  ruleVersion: string;
  /** Per år: true = overskrider minst to terskler, false = gjør ikke, null = kan ikke avgjøres. */
  exceeds: { current: boolean | null; previous: boolean | null };
};

/** Overskrider året minst to av tre terskler? null når manglende tall gjør det uavklart. */
export function exceedsThresholds(year: YearFigures): boolean | null {
  const checks = [
    year.salesRevenueOre === null ? null : year.salesRevenueOre > THRESHOLDS.salesRevenueOre,
    year.balanceSheetTotalOre === null ? null : year.balanceSheetTotalOre > THRESHOLDS.balanceSheetTotalOre,
    year.averageFte === null ? null : year.averageFte > THRESHOLDS.averageFte,
  ];
  if (checks.filter((c) => c === true).length >= 2) return true;
  if (checks.filter((c) => c === false).length >= 2) return false;
  return null;
}

const manual = (reasons: Reason[], exceeds: Assessment["exceeds"]): Assessment => ({
  result: "manual_review",
  reasons,
  ruleVersion: RULE_VERSION,
  exceeds,
});

export function assess(input: ApplicabilityInput): Assessment {
  const exceeds = { current: exceedsThresholds(input.currentYear), previous: exceedsThresholds(input.previousYear) };
  const done = (result: ApplicabilityResult, reasons: Reason[]): Assessment => ({
    result,
    reasons,
    ruleVersion: RULE_VERSION,
    exceeds,
  });

  // Særlige virkeområder og konsern: utenfor den veiledende automatikken.
  const special: Reason[] = [];
  if (input.norwegian !== "yes") {
    special.push({
      code: "foreign_or_unknown_connection",
      text: "Utenlandske virksomheter er omfattet bare hvis de tilbyr varer eller tjenester i Norge og er skattepliktige hit (§ 2 annet ledd). Det må vurderes manuelt.",
    });
  }
  if (input.isParentCompany !== "no") {
    special.push({
      code: "group",
      text: "Et morselskap vurderes sammen med datterselskapene som én enhet (§ 3 bokstav a). Bruk konserntall og vurder manuelt.",
    });
  }
  if (input.publicInterestEntity === "unknown") {
    special.push({
      code: "public_interest_unknown",
      text: "Det er ikke avklart om virksomheten er et foretak av allmenn interesse etter regnskapsloven § 1-6.",
    });
  }
  if (special.length) return manual(special, exceeds);

  if (input.publicInterestEntity === "yes") {
    return done("likely_in", [
      {
        code: "public_interest_entity",
        text: "Foretak av allmenn interesse etter regnskapsloven § 1-6 er større virksomheter uansett tersklene (§ 3 bokstav a).",
      },
    ]);
  }

  if (input.previousYear.fiscalYear !== input.currentYear.fiscalYear - 1) {
    return manual(
      [{ code: "years_not_consecutive", text: "Tallene må gjelde to regnskapsår etter hverandre." }],
      exceeds,
    );
  }
  if (exceeds.current === null || exceeds.previous === null) {
    return manual(
      [
        {
          code: "incomplete_figures",
          text: "Tallene er ufullstendige, så det kan ikke avgjøres om minst to av tre terskler er overskredet begge år.",
        },
      ],
      exceeds,
    );
  }

  const year = (y: number, over: boolean) =>
    `${y}: ${over ? "overskrider" : "overskrider ikke"} minst to av tre terskler.`;
  const yearsText = `${year(input.previousYear.fiscalYear, exceeds.previous)} ${year(input.currentYear.fiscalYear, exceeds.current)}`;

  if (exceeds.current === exceeds.previous) {
    return done(exceeds.current ? "likely_in" : "likely_out", [
      { code: exceeds.current ? "exceeds_two_years" : "below_two_years", text: yearsText },
    ]);
  }

  // Årene peker hver sin vei: status endres først i det andre av to år etter hverandre.
  const unchanged = {
    code: "status_unchanged",
    text: `${yearsText} Endret status får først virkning i det andre av to regnskapsår etter hverandre (§ 3 bokstav a), så tidligere status gjelder.`,
  };
  if (input.previousStatus === "unknown") {
    return manual(
      [{ code: "previous_status_unknown", text: `${unchanged.text} Tidligere status er ukjent og må avklares.` }],
      exceeds,
    );
  }
  return done(input.previousStatus === "yes" ? "likely_in" : "likely_out", [unchanged]);
}
