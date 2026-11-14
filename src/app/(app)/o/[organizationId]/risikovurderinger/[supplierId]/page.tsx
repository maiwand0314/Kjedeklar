import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { formatKroner } from "@/domain/applicability/form";
import {
  DATA_QUALITY_LABELS, DECISION_LABELS, FACTOR_LABELS, FRESHNESS_LABELS, LEVEL_LABELS, REVIEW_STATE_LABELS, SOURCE_LABELS, STALE_REASON_LABELS,
  describeMissing,
} from "@/domain/risk/labels";
import { formatPeriod } from "@/domain/reporting/period";
import { fetchAuthQuery } from "@/lib/auth-server";
import { handlePageLoadError } from "@/lib/convex-errors";
import { ReviewForm } from "@/modules/risk/components/review-form";
import { AssessButton } from "@/modules/risk/components/assess-button";

export const metadata = { title: "Risikovurdering av leverandør" };

const dateTime = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Oslo" });

export default async function SupplierRiskPage({ params, searchParams }: PageProps<"/o/[organizationId]/risikovurderinger/[supplierId]">) {
  const { organizationId, supplierId } = await params;
  const { periode } = await searchParams;
  const periods = await fetchAuthQuery(api.organizations.reportingPeriods.list, { organizationId });
  const periodId = typeof periode === "string" ? periode : periods[0]?.id;
  const period = periods.find((p) => p.id === periodId);
  if (!periodId || !period) handlePageLoadError(new Error("Ingen periode"));
  let d;
  try {
    d = await fetchAuthQuery(api.risk.reviews.detail, { organizationId, supplierId, reportingPeriodId: periodId });
  } catch (error) {
    handlePageLoadError(error);
  }
  const { assessment, review } = d;
  const base = `/o/${organizationId}/risikovurderinger`;
  const rule = (ruleId: string) => assessment?.ruleDescriptions.find((r) => r.ruleId === ruleId)?.description;
  const stale = assessment?.status === "stale";
  const overriddenBelow = review.state === "overridden" && assessment && review.level !== null && review.level !== assessment.screeningLevel;

  return (
    <>
      <p className="text-sm">
        <Link href={`${base}?periode=${periodId}`} className="underline">
          Til risikolisten
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{d.supplier.name}</h1>
      <p className="mt-1 text-muted">
        Perioden {formatPeriod(period)}. Innkjøp: {d.spendOre === null ? "ukjent" : formatKroner(d.spendOre)}. Innkjøpsbeløpet påvirker ikke nivået.{" "}
        <Link href={`/o/${organizationId}/leverandorer/${supplierId}?periode=${periodId}`} className="underline">
          Se leverandørens opplysninger
        </Link>
      </p>

      {!assessment ? (
        <section className="mt-8" data-testid="no-assessment">
          <h2 className="text-xl font-semibold">Ikke vurdert</h2>
          <p className="mt-2">Leverandøren har ikke fått en screening for denne perioden. Kjør screeningen først.</p>
          <div className="mt-4">
            <AssessButton organizationId={organizationId} reportingPeriodId={periodId} label="Kjør screening" />
          </div>
        </section>
      ) : (
        <>
          <section aria-labelledby="levels-heading" className="mt-8" data-testid="levels">
            <h2 id="levels-heading" className="text-xl font-semibold">
              Screening og din vurdering
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="rounded border border-border p-4" data-testid="screening-box">
                <h3 className="font-medium">Screening</h3>
                <p className="mt-1 text-2xl" data-testid="screening-level">
                  {LEVEL_LABELS[assessment.screeningLevel]}
                </p>
                <p className="text-sm text-muted">
                  Datakvalitet: {DATA_QUALITY_LABELS[assessment.dataQuality]}. Beregnet {dateTime.format(assessment.assessedAt)}.
                </p>
                <p className="text-sm text-muted">
                  Metode {assessment.methodVersion ?? "ukjent"}, motor {assessment.engineVersion}.
                </p>
              </div>
              <div className="rounded border border-border p-4" data-testid="review-box">
                <h3 className="font-medium">Din vurdering</h3>
                <p className="mt-1 text-2xl" data-testid="review-level">
                  {review.level ? LEVEL_LABELS[review.level] : REVIEW_STATE_LABELS[review.state]}
                </p>
                <p className="text-sm text-muted" data-testid="review-state">
                  {REVIEW_STATE_LABELS[review.state]}
                  {review.current && ` – ${review.current.actor}, ${dateTime.format(review.current.reviewedAt)}`}
                </p>
              </div>
            </div>
            {overriddenBelow && (
              <p className="mt-3" data-testid="override-note">
                Du har overstyrt screeningen ({LEVEL_LABELS[assessment.screeningLevel].toLowerCase()}) til {LEVEL_LABELS[review.level!].toLowerCase()}. Screeningen,
                datamanglene og kontrollsignalene under gjelder fortsatt og er ikke fjernet.
              </p>
            )}
            {stale && (
              <div role="alert" className="mt-3 rounded border border-border bg-surface p-4" data-testid="stale-notice">
                <p>
                  <strong>Screeningen er utdatert.</strong> Resultatet over er slik det ble beregnet, men grunnlaget er endret:
                </p>
                <ul className="mt-1 list-disc pl-6">
                  {assessment.staleReasons.map((r) => (
                    <li key={r}>{STALE_REASON_LABELS[r] ?? r}</li>
                  ))}
                </ul>
                <div className="mt-3">
                  <AssessButton organizationId={organizationId} reportingPeriodId={periodId} label="Kjør screening på nytt" />
                </div>
              </div>
            )}
            {!stale && review.state === "outdated" && (
              <p className="mt-3" data-testid="outdated-note">
                Din tidligere vurdering gjaldt en eldre screening og gjelder ikke lenger. Se gjennom resultatet og bekreft eller overstyr på nytt.
              </p>
            )}
          </section>

          <section aria-labelledby="why-heading" className="mt-10" data-testid="why">
            <h2 id="why-heading" className="text-xl font-semibold">
              Hvorfor dette nivået
            </h2>
            {assessment.triggeredRules.length === 0 ? (
              <p className="mt-2">Ingen regel ga et kjent nivå. Nivået er {LEVEL_LABELS[assessment.screeningLevel].toLowerCase()} fordi grunnlaget mangler, ikke fordi risikoen er vurdert som lav.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {assessment.triggeredRules.map((r) => (
                  <li key={`${r.ruleId}-${r.input}`} className="rounded border border-border p-3" data-testid="rule">
                    <p>
                      <strong>{FACTOR_LABELS[r.factor] ?? r.factor}:</strong> {r.input} gir <strong>{LEVEL_LABELS[r.level].toLowerCase()}</strong> ({r.ruleId})
                    </p>
                    {rule(r.ruleId) && <p className="text-sm text-muted">{rule(r.ruleId)}</p>}
                    <p className="text-sm text-muted">
                      Kilde: {r.sourceRef.dataset} {r.sourceRef.version}, linje {r.sourceRef.entry}. {r.sourceRef.sourceReference}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-sm text-muted">
              Høyeste kjente nivå gjelder, og en kjent høy faktor veier alltid tyngst. Mangler det vesentlige opplysninger, og ingen faktor er høy, blir nivået ukjent.
            </p>
          </section>

          <section aria-labelledby="missing-heading" className="mt-10" data-testid="missing">
            <h2 id="missing-heading" className="text-xl font-semibold">
              Hva som mangler
            </h2>
            {assessment.missingFields.length === 0 ? (
              <p className="mt-2">Ingen mangler registrert i grunnlaget.</p>
            ) : (
              <ul className="mt-3 list-disc pl-6">
                {assessment.missingFields.map((m, i) => (
                  <li key={`${m.field}-${i}`}>{describeMissing(m)}</li>
                ))}
              </ul>
            )}
            {assessment.controlSignals.length > 0 && (
              <>
                <h3 className="mt-4 font-medium">Kontrollsignaler (oppfølging, ikke nivå)</h3>
                <ul className="mt-1 list-disc pl-6">
                  {assessment.controlSignals.map((s) => (
                    <li key={`${s.ruleId}-${s.detail}`}>
                      {FACTOR_LABELS[s.factor] ?? s.factor}: {s.detail}
                      {rule(s.ruleId) && <span className="text-muted"> – {rule(s.ruleId)}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {assessment.staleSources.length > 0 && (
              <>
                <h3 className="mt-4 font-medium">Kilder som ikke er fullt gjennomgått</h3>
                <ul className="mt-1 list-disc pl-6">
                  {assessment.staleSources.map((s) => (
                    <li key={`${s.source}-${s.version}`}>
                      {SOURCE_LABELS[s.source] ?? s.source} {s.version}: {FRESHNESS_LABELS[s.freshness] ?? s.freshness}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="review-heading" className="mt-10">
            <h2 id="review-heading" className="text-xl font-semibold">
              Bekreft eller overstyr
            </h2>
            <p className="mt-1 text-sm text-muted">
              Din vurdering lagres som en ny rad med begrunnelse, ditt navn og tidspunkt. Screeningen endres ikke, og tidligere vurderinger blir stående i
              historikken. Screeningen er prioriteringsstøtte, ikke en bekreftet vurdering av rettigheter eller konsekvenser.
            </p>
            <div className="mt-4">
              <ReviewForm
                key={`${assessment.id}-${review.current?.id ?? "none"}`}
                organizationId={organizationId}
                supplierId={supplierId}
                reportingPeriodId={periodId}
                assessmentId={assessment.id}
                expectedReviewId={review.current?.id ?? null}
                screeningLevel={assessment.screeningLevel}
                hasReview={review.current !== null && review.current.decision !== "revoke"}
                disabledReason={stale ? "Screeningen er utdatert. Kjør den på nytt før du bekrefter eller overstyrer." : undefined}
              />
            </div>
          </section>
        </>
      )}

      <section aria-labelledby="history-heading" className="mt-12" data-testid="history">
        <h2 id="history-heading" className="text-xl font-semibold">
          Historikk
        </h2>
        {d.reviews.length === 0 ? (
          <p className="mt-2">Ingen vurderinger er lagret ennå.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {d.reviews.map((r) => (
              <li key={r.id} className="rounded border border-border p-3" data-testid="review-entry">
                <p>
                  <strong>{DECISION_LABELS[r.decision]}</strong>
                  {r.chosenLevel && <> – {LEVEL_LABELS[r.originalLevel]} → {LEVEL_LABELS[r.chosenLevel]}</>}
                  {!r.chosenLevel && r.decision === "confirm" && <> – {LEVEL_LABELS[r.originalLevel]}</>}
                </p>
                <p className="text-sm text-muted">
                  {r.actor}, {dateTime.format(r.reviewedAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{r.rationale}</p>
                {r.evidenceNote && <p className="mt-1 text-sm text-muted">Henvisning: {r.evidenceNote}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
