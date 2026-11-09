import type { ApplicabilityInput, ApplicabilityResult, Reason } from "@/domain/applicability/assess";
import { THRESHOLDS } from "@/domain/applicability/assess";
import { formatKroner } from "@/domain/applicability/form";
import { Table } from "@/components/ui/table";
import { ApplicabilityResultView } from "./applicability-result";

const dateTime = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Oslo" });
const ANSWERS = { yes: "Ja", no: "Nei", unknown: "Vet ikke" } as const;
const fte = (n: number | null) => (n === null ? "ikke oppgitt" : `${String(n).replace(".", ",")} årsverk`);

type Assessment = {
  assessedAt: number;
  ruleVersion: string;
  inputs: ApplicabilityInput;
  result: ApplicabilityResult;
  rationale: Reason[];
};

/** Siste lagrede vurdering med grunnlag, terskler, regelversjon og begrunnelse. */
export function ApplicabilitySummary({ assessment }: { assessment: Assessment }) {
  const { inputs } = assessment;
  return (
    <div className="flex flex-col gap-4">
      <ApplicabilityResultView result={assessment.result} reasons={assessment.rationale} />
      <Table caption="Grunnlaget for vurderingen">
        <thead>
          <tr>
            <th>Regnskapsår</th>
            <th>Salgsinntekt</th>
            <th>Balansesum</th>
            <th>Årsverk</th>
          </tr>
        </thead>
        <tbody>
          {[inputs.previousYear, inputs.currentYear].map((y) => (
            <tr key={y.fiscalYear}>
              <td>{y.fiscalYear}</td>
              <td>{formatKroner(y.salesRevenueOre)}</td>
              <td>{formatKroner(y.balanceSheetTotalOre)}</td>
              <td>{fte(y.averageFte)}</td>
            </tr>
          ))}
          <tr>
            <td>Terskel (må overskrides)</td>
            <td>{formatKroner(THRESHOLDS.salesRevenueOre)}</td>
            <td>{formatKroner(THRESHOLDS.balanceSheetTotalOre)}</td>
            <td>{fte(THRESHOLDS.averageFte)}</td>
          </tr>
        </tbody>
      </Table>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[18rem_1fr]">
        <dt className="text-muted">Omfattet forrige regnskapsår</dt>
        <dd>{ANSWERS[inputs.previousStatus]}</dd>
        <dt className="text-muted">Morselskap i konsern</dt>
        <dd>{ANSWERS[inputs.isParentCompany]}</dd>
        <dt className="text-muted">Foretak av allmenn interesse</dt>
        <dd>{ANSWERS[inputs.publicInterestEntity]}</dd>
        <dt className="text-muted">Hjemmehørende i Norge</dt>
        <dd>{ANSWERS[inputs.norwegian]}</dd>
      </dl>
      <p className="text-sm text-muted">
        Bekreftet og lagret {dateTime.format(new Date(assessment.assessedAt))}. Regelversjon {assessment.ruleVersion}, etter
        åpenhetsloven §§ 2–3.
      </p>
    </div>
  );
}
