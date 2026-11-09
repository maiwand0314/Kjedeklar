import { RESULT_LABELS } from "@/domain/applicability/form";
import type { ApplicabilityResult, Reason } from "@/domain/applicability/assess";

const NEXT_STEP: Record<ApplicabilityResult, string> = {
  likely_in: "Virksomheten bør regne med å ha plikter etter åpenhetsloven. Kontroller gjerne med revisor eller rådgiver.",
  likely_out:
    "Virksomheten er sannsynligvis ikke omfattet. Du kan likevel bruke Kjedeklar frivillig; ingen funksjoner er stengt.",
  manual_review:
    "Dette kan ikke avgjøres automatisk. Avklar med revisor eller rådgiver. Du kan bruke Kjedeklar som før imens.",
};

/** Resultat med tekst (ikke bare farge), begrunnelse og neste steg. Alltid merket veiledende. */
export function ApplicabilityResultView({ result, reasons }: { result: ApplicabilityResult; reasons: Reason[] }) {
  return (
    <div className="rounded border border-border p-4">
      <p>
        <span className="font-semibold">{RESULT_LABELS[result]}</span>{" "}
        <span className="text-sm text-muted">(veiledende, ikke en juridisk vurdering)</span>
      </p>
      <ul className="mt-2 list-disc pl-5">
        {reasons.map((r) => (
          <li key={r.code}>{r.text}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm">{NEXT_STEP[result]}</p>
    </div>
  );
}
