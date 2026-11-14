import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { Table } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { formatKroner } from "@/domain/applicability/form";
import { DATA_QUALITY_LABELS, GROUP_HEADINGS, LEVEL_LABELS, REVIEW_STATE_LABELS } from "@/domain/risk/labels";
import type { ListLevel, ReviewState } from "@/domain/risk/review";
import { formatPeriod } from "@/domain/reporting/period";
import { fetchAuthQuery } from "@/lib/auth-server";
import { handlePageLoadError } from "@/lib/convex-errors";
import { AssessButton } from "@/modules/risk/components/assess-button";

export const metadata = { title: "Risikovurderinger" };

const PAGE_SIZE = 50;
const one = (value: string | string[] | undefined) => (typeof value === "string" && value ? value : undefined);
const LEVELS = Object.keys(LEVEL_LABELS) as ListLevel[];
const STATES = Object.keys(REVIEW_STATE_LABELS) as ReviewState[];

export default async function RiskPage({ params, searchParams }: PageProps<"/o/[organizationId]/risikovurderinger">) {
  const { organizationId } = await params;
  const query = await searchParams;
  const periods = await fetchAuthQuery(api.organizations.reportingPeriods.list, { organizationId });
  const periodId = one(query.periode) ?? periods[0]?.id;
  const period = periods.find((p) => p.id === periodId);
  const base = `/o/${organizationId}/risikovurderinger`;
  if (!period) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Risikovurderinger</h1>
        <div className="mt-8">
          <EmptyState title="Ingen rapportperiode ennå">
            <p>
              Screeningen gjelder en rapportperiode.{" "}
              <Link href={`/o/${organizationId}/virksomheten#rapportperiode-heading`} className="underline">
                Opprett en rapportperiode
              </Link>{" "}
              først.
            </p>
          </EmptyState>
        </div>
      </>
    );
  }

  const level = LEVELS.find((l) => l === one(query.nivaa));
  const reviewState = STATES.find((s) => s === one(query.vurdering));
  const search = one(query.sok);
  const page = Math.max(1, Number(one(query.side)) || 1);
  let result, versions;
  try {
    [result, versions] = await Promise.all([
      fetchAuthQuery(api.risk.reviews.list, {
        organizationId,
        reportingPeriodId: period.id,
        level,
        reviewState,
        search,
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
      fetchAuthQuery(api.risk.queries.activeVersions, { organizationId }),
    ]);
  } catch (error) {
    handlePageLoadError(error);
  }

  const href = (extra: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries({ periode: periodId, nivaa: level, vurdering: reviewState, sok: search, ...extra }).filter((e): e is [string, string] => e[1] !== undefined),
    ).toString();
    return `${base}${qs ? `?${qs}` : ""}`;
  };
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const total = Object.values(result.counts.screening).reduce((a, b) => a + b, 0);
  const notReviewed = [versions.country, versions.industry, versions.method].filter((v) => v && v.freshness !== "current");

  return (
    <>
      <h1 className="text-2xl font-semibold">Risikovurderinger</h1>
      <p className="mt-2 text-muted">
        Screeningen er Kjedeklars prioriteringsstøtte for perioden {formatPeriod(period)}: den viser hvor du bør se nærmere først. Den er ikke en
        juridisk vurdering og ikke bevis mot en leverandør. Din egen vurdering av hver leverandør lagres ved siden av screeningen.
      </p>

      {!versions.method && (
        <p role="alert" className="mt-4 rounded border border-border bg-surface p-4" data-testid="no-method">
          <strong>Ingen aktiv metodeversjon.</strong> Screeningen kan ikke kjøres før en godkjent metodeversjon er aktivert.
        </p>
      )}
      {notReviewed.length > 0 && (
        <p className="mt-4 rounded border border-border bg-surface p-4" data-testid="sources-notice">
          <strong>Grunnlaget er ikke fullt gjennomgått.</strong> Minst én kilde eller metodeversjon er ikke faglig gjennomgått, eller gjennomgangen er utløpt.
          Resultatene viser det som «ufullstendig».
        </p>
      )}
      {result.truncated && (
        <p role="alert" className="mt-4 rounded border border-border bg-surface p-4" data-testid="truncated">
          <strong>Listen er ikke komplett.</strong> Det er flere leverandører enn listen kan lese om gangen, så noen mangler. Kontakt oss før du bruker listen
          som oversikt.
        </p>
      )}

      <div className="mt-6">
        <AssessButton organizationId={organizationId} reportingPeriodId={period.id} label="Kjør screening for alle leverandører" />
        <p className="mt-1 text-sm text-muted">Beregner screening for leverandører med nytt eller endret grunnlag. Uendrede får ingen ny vurdering.</p>
      </div>

      <section aria-labelledby="counts-heading" className="mt-8" data-testid="counts">
        <h2 id="counts-heading" className="text-xl font-semibold">
          Oversikt ({total} aktive leverandører)
        </h2>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="font-medium">Screening</h3>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4">
              {(Object.keys(result.counts.screening) as ListLevel[])
                .sort((a, b) => result.groupOrder.indexOf(a) - result.groupOrder.indexOf(b))
                .map((l) => (
                  <div key={l} className="contents">
                    <dt className="text-muted">{LEVEL_LABELS[l]}</dt>
                    <dd data-testid={`count-screening-${l}`}>{result.counts.screening[l]}</dd>
                  </div>
                ))}
            </dl>
          </div>
          <div>
            <h3 className="font-medium">Din vurdering</h3>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4">
              {STATES.map((s) => (
                <div key={s} className="contents">
                  <dt className="text-muted">{REVIEW_STATE_LABELS[s]}</dt>
                  <dd data-testid={`count-review-${s}`}>{result.counts.review[s]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <form method="get" action={base} role="search" className="mt-8 flex flex-wrap items-end gap-3">
        {periodId && <input type="hidden" name="periode" value={periodId} />}
        <SelectField id="filter-level" name="nivaa" label="Screening" defaultValue={level ?? ""}>
          <option value="">Alle nivåer</option>
          {result.groupOrder.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABELS[l]}
            </option>
          ))}
        </SelectField>
        <SelectField id="filter-review" name="vurdering" label="Din vurdering" defaultValue={reviewState ?? ""}>
          <option value="">Alle</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {REVIEW_STATE_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <Field id="filter-search" name="sok" label="Søk på starten av navnet" defaultValue={search ?? ""} />
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      <div className="mt-6">
        {result.rows.length === 0 ? (
          <EmptyState title={level || reviewState || search ? "Ingen treff" : "Ingen leverandører ennå"}>
            <p>
              {level || reviewState || search
                ? "Ingen leverandører passer filteret."
                : "Legg til leverandører, og kjør så screeningen."}
            </p>
          </EmptyState>
        ) : (
          <Table caption="Leverandører i risikoprioritert rekkefølge">
            <thead>
              <tr>
                <th>Leverandør</th>
                <th>Screening</th>
                <th>Datakvalitet</th>
                <th>Innkjøp i perioden</th>
                <th>Din vurdering</th>
              </tr>
            </thead>
            {result.rows.map((row, i) => (
              <tbody key={row.supplierId} data-testid="risk-row">
                {(i === 0 || result.rows[i - 1].level !== row.level) && (
                  <tr data-testid={`group-${row.level}`}>
                    <th colSpan={5} scope="colgroup" className="bg-surface pt-4 text-base">
                      {GROUP_HEADINGS[row.level]}
                    </th>
                  </tr>
                )}
                <tr>
                  <td>
                    <Link href={`${base}/${row.supplierId}${periodId ? `?periode=${periodId}` : ""}`} className="underline">
                      {row.name}
                    </Link>
                  </td>
                  <td>
                    <strong>{LEVEL_LABELS[row.level]}</strong>
                    {row.stale && <span className="block text-muted">Utdatert – kjør screeningen på nytt</span>}
                  </td>
                  <td>
                    {row.dataQuality ? DATA_QUALITY_LABELS[row.dataQuality] : "–"}
                    {row.missingCount > 0 && <span className="block text-muted">{row.missingCount} mangel{row.missingCount === 1 ? "" : "er"}</span>}
                  </td>
                  <td>{row.spendOre === null ? "Beløp ukjent" : formatKroner(row.spendOre)}</td>
                  <td>
                    {REVIEW_STATE_LABELS[row.reviewState]}
                    {row.effectiveLevel && <span className="block text-muted">Nivå: {LEVEL_LABELS[row.effectiveLevel]}</span>}
                  </td>
                </tr>
              </tbody>
            ))}
          </Table>
        )}
      </div>

      {pages > 1 && (
        <nav aria-label="Sider" className="mt-4 flex items-center gap-4 text-sm">
          {page > 1 && (
            <Link href={href({ side: String(page - 1) })} className="underline">
              Forrige side
            </Link>
          )}
          <span>
            Side {page} av {pages} ({result.total} leverandører)
          </span>
          {page < pages && (
            <Link href={href({ side: String(page + 1) })} className="underline">
              Neste side
            </Link>
          )}
        </nav>
      )}
      <p className="mt-6 text-sm text-muted">
        Listen er sortert etter screeningen: høy, ukjent, ikke vurdert, moderat, lav. Innenfor samme nivå kommer størst innkjøp først, og ukjent beløp sist.
        Innkjøpsbeløpet påvirker aldri nivået, og din vurdering endrer ikke rekkefølgen.
      </p>
    </>
  );
}
