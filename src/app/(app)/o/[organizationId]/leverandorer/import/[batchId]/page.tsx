import Link from "next/link";
import { Table } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { formatKroner } from "@/domain/applicability/form";
import { ENTRY_KINDS, type EntryKind } from "@/domain/import/plan";
import { formatPeriod } from "@/domain/reporting/period";
import { countryName } from "@/domain/suppliers/countries";
import { fetchAuthQuery } from "@/lib/auth-server";
import { handlePageLoadError } from "@/lib/convex-errors";
import { DECISION_LABELS, EntryDecision } from "@/modules/suppliers/components/import/entry-decision";
import { ImportDecisions } from "@/modules/suppliers/components/import/import-decisions";

export const metadata = { title: "Import" };

const dateTime = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Oslo" });
const KIND_LABELS: Record<EntryKind, string> = {
  new_clean: "Ny leverandør",
  new_warning: "Ny leverandør med avklaringer",
  known: "Finnes fra før",
  unclear: "Uklart treff",
  error: "Feil",
};
const FILTER_LABELS: Record<EntryKind, string> = {
  new_clean: "Nye",
  new_warning: "Nye med avklaringer",
  known: "Finnes fra før",
  unclear: "Uklare treff",
  error: "Feil",
};
const OUTCOME_LABELS = {
  created: "Opprettet",
  updated: "Oppdatert",
  unchanged: "Uendret: filen hadde ingen nye verdier",
  skipped: "Utelatt",
  conflict: "Ikke importert: endret etter at grunnlaget ble laget",
} as const;
const orgNumber = (n: string) => n.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
const clip = (text: string) => (text.length > 120 ? `${text.slice(0, 120)}…` : text);

export default async function ImportBatchPage({ params, searchParams }: PageProps<"/o/[organizationId]/leverandorer/import/[batchId]">) {
  const { organizationId, batchId } = await params;
  const { type, etter, periode } = await searchParams;
  const kind = ENTRY_KINDS.find((k) => k === type);
  const cursor = typeof etter === "string" ? etter : undefined;
  let loaded;
  try {
    loaded = await Promise.all([
      fetchAuthQuery(api.suppliers.import.batches.get, { organizationId, batchId }),
      fetchAuthQuery(api.suppliers.import.batches.rows, { organizationId, batchId, kind, paginationOpts: { numItems: 25, cursor: cursor ?? null } }),
    ]);
  } catch (error) {
    handlePageLoadError(error);
  }
  const [batch, entries] = loaded;
  const base = `/o/${organizationId}/leverandorer`;
  const href = (extra: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(
      Object.entries({ periode: typeof periode === "string" ? periode : undefined, ...extra }).filter((e): e is [string, string] => e[1] !== undefined),
    ).toString();
    return `${base}/import/${batch.id}${qs ? `?${qs}` : ""}`;
  };
  const editable = batch.status === "draft" && !batch.expired;
  const { result } = batch;

  return (
    <>
      <p className="text-sm">
        <Link href={`${base}/import${typeof periode === "string" ? `?periode=${encodeURIComponent(periode)}` : ""}`} className="underline">
          Til import fra CSV
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Import av «{batch.fileName}»</h1>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[14rem_1fr]" data-testid="import-batch">
        <dt className="text-muted">Rapportperiode</dt>
        <dd>{formatPeriod(batch.period)}</dd>
        <dt className="text-muted">Grunnlaget ble laget</dt>
        <dd>{dateTime.format(new Date(batch.createdAt))}</dd>
        <dt className="text-muted">Innhold</dt>
        <dd>
          {batch.rowCount} rader i filen, {batch.entryCount} leverandører
        </dd>
        <dt className="text-muted">Status</dt>
        <dd>
          {batch.status === "committed"
            ? `Fullført ${dateTime.format(new Date(batch.committedAt ?? batch.createdAt))}`
            : batch.status === "committing"
              ? "Bekreftet, men ikke fullført"
              : batch.expired
                ? "Utløpt, ikke importert"
                : `Utkast. Ingenting er importert ennå. Må bekreftes innen ${dateTime.format(new Date(batch.expiresAt))}.`}
        </dd>
      </dl>

      {batch.repeatsCommittedAt !== undefined && batch.status === "draft" && (
        <p className="mt-4 rounded border border-border bg-surface p-4">
          <strong>Denne filen er importert før</strong> for samme periode ({dateTime.format(new Date(batch.repeatsCommittedAt))}). En ny
          import oppretter ikke leverandørene på nytt; beløp erstattes med verdiene i filen og legges ikke sammen.
        </p>
      )}
      {batch.status === "draft" && batch.expired && (
        <p role="alert" className="mt-4 text-danger">
          Importgrunnlaget er utløpt og kan ikke bekreftes. Last opp filen på nytt.
        </p>
      )}

      {batch.status === "committed" ? (
        <section aria-labelledby="resultat-heading" className="mt-10">
          <h2 id="resultat-heading" className="text-xl font-semibold">
            Resultat
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[14rem_1fr]" data-testid="import-result">
            <dt className="text-muted">Opprettet</dt>
            <dd>{result.created} nye leverandører</dd>
            <dt className="text-muted">Oppdatert</dt>
            <dd>{result.updated} leverandører fikk nye innkjøpsdata</dd>
            <dt className="text-muted">Uendret</dt>
            <dd>{result.unchanged} hadde ingen nye verdier i filen</dd>
            <dt className="text-muted">Utelatt</dt>
            <dd>{result.skipped} oppføringer, etter valgene som ble bekreftet</dd>
            <dt className="text-muted">Ikke importert</dt>
            <dd>{result.conflicts} på grunn av endringer etter at grunnlaget ble laget</dd>
          </dl>
          {result.conflicts > 0 && (
            <p className="mt-4">
              Oppføringene som ikke ble importert, gjelder leverandører som ble endret eller opprettet av andre etter at
              grunnlaget ble laget. Last opp filen på nytt for å gå gjennom dem med oppdaterte opplysninger.
            </p>
          )}
        </section>
      ) : (
        (editable || batch.status === "committing") && (
          <section aria-labelledby="valg-heading" className="mt-10">
            <h2 id="valg-heading" className="text-xl font-semibold">
              {batch.status === "committing" ? "Importen er ikke fullført" : "Velg og bekreft"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {batch.status === "committing"
                ? "Importen er bekreftet og delvis gjennomført. Fortsett for å behandle resten; ingenting behandles to ganger."
                : `Nye leverandører uten avklaringer (${batch.kindCounts.new_clean}) opprettes. Alt annet krever et valg, samlet her eller for hver oppføring i tabellen under. Ingenting endres før du bekrefter.`}
            </p>
            <div className="mt-4">
              <ImportDecisions
                // Ny nøkkel når valgene er lagret, så det som vises alltid er det serveren har.
                key={batch.rowVersion}
                organizationId={organizationId}
                batch={{
                  id: batch.id,
                  status: batch.status === "committing" ? "committing" : "draft",
                  rowVersion: batch.rowVersion,
                  policy: batch.policy,
                  kindCounts: batch.kindCounts,
                  undecided: batch.undecided,
                  processed: batch.processed,
                  entryCount: batch.entryCount,
                }}
              />
            </div>
          </section>
        )
      )}

      <section aria-labelledby="oppforinger-heading" className="mt-12">
        <h2 id="oppforinger-heading" className="text-xl font-semibold">
          Oppføringer
        </h2>
        <nav aria-label="Vis oppføringer" className="mt-4 flex flex-wrap gap-2 text-sm">
          {[undefined, ...ENTRY_KINDS].map((k) => (
            <Link
              key={k ?? "alle"}
              href={href({ type: k })}
              aria-current={kind === k ? "page" : undefined}
              className="rounded border border-border px-3 py-1 aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {k ? `${FILTER_LABELS[k]} (${batch.kindCounts[k]})` : `Alle (${batch.entryCount})`}
            </Link>
          ))}
        </nav>
        <div className="mt-4">
          {entries.page.length === 0 ? (
            <p>Ingen oppføringer av denne typen.</p>
          ) : (
            <Table caption="Oppføringer i importgrunnlaget">
              <thead>
                <tr>
                  <th scope="col">Rad</th>
                  <th scope="col">Navn</th>
                  <th scope="col">Organisasjonsnummer</th>
                  <th scope="col">Egen leverandør-ID</th>
                  <th scope="col">Registreringsland</th>
                  <th scope="col">Innkjøp i perioden</th>
                </tr>
              </thead>
              {entries.page.map((entry) => (
                <tbody key={entry.id}>
                  <tr className="border-b-0! align-top">
                    <th scope="row" className="whitespace-nowrap font-normal">
                      {entry.rowNumber}
                      {entry.sourceRowCount > 1 && <span className="block text-xs text-muted">{entry.sourceRowCount} rader</span>}
                    </th>
                    <td>{entry.values.name ? clip(entry.values.name) : "Mangler"}</td>
                    <td className="whitespace-nowrap">{entry.values.registryOrgNumber ? orgNumber(entry.values.registryOrgNumber) : "Ukjent"}</td>
                    <td className="whitespace-nowrap">{entry.values.externalKey ?? "Ukjent"}</td>
                    <td className="whitespace-nowrap">
                      {entry.values.registeredCountry ? `${countryName(entry.values.registeredCountry)} (${entry.values.registeredCountry})` : "Ukjent"}
                    </td>
                    <td className="whitespace-nowrap">{entry.values.spendOre === undefined ? "Ukjent" : formatKroner(entry.values.spendOre)}</td>
                  </tr>
                  <tr>
                    <td />
                    <td colSpan={5} className="pt-0!">
                      <div className="sticky left-0 w-[calc(100cqw-4rem)]">
                        <p>
                          <span className="text-muted">Type:</span> {KIND_LABELS[entry.kind]}
                          {entry.candidates.length > 0 && (
                            <>
                              {": "}
                              {entry.candidates.map((c, i) => (
                                <span key={c.id}>
                                  {i > 0 && ", "}
                                  <Link href={`${base}/${c.id}`} className="underline">
                                    {c.name}
                                  </Link>
                                  {c.archived && " (arkivert)"}
                                </span>
                              ))}
                            </>
                          )}
                        </p>
                        {entry.issues.length > 0 && (
                          <ul className="mt-1 flex flex-col gap-1">
                            {entry.issues.map((issue, i) => (
                              <li key={i}>
                                <strong>{issue.level === "error" ? "Feil" : "Må avklares"}:</strong> {issue.message}
                              </li>
                            ))}
                          </ul>
                        )}
                        {entry.outcome ? (
                          <p className="mt-1">
                            <span className="text-muted">Resultat:</span> {OUTCOME_LABELS[entry.outcome]}
                            {entry.supplier && (
                              <>
                                {" – "}
                                <Link href={`${base}/${entry.supplier.id}`} className="underline">
                                  {entry.supplier.name}
                                </Link>
                              </>
                            )}
                            {entry.previousSpendOre !== undefined && ` (tidligere beløp: ${formatKroner(entry.previousSpendOre)})`}
                          </p>
                        ) : editable ? (
                          <EntryDecision
                            key={batch.rowVersion}
                            organizationId={organizationId}
                            batchId={batch.id}
                            rowVersion={batch.rowVersion}
                            entry={{
                              id: entry.id,
                              rowNumber: entry.rowNumber,
                              kind: entry.kind,
                              matchKind: entry.matchKind,
                              candidates: entry.candidates.map(({ id, name }) => ({ id, name })),
                              decision: entry.decision,
                              ownDecision: entry.ownDecision,
                              targetSupplierId: entry.targetSupplierId,
                            }}
                          />
                        ) : (
                          <p className="mt-1">
                            <span className="text-muted">Valg:</span> {entry.decision ? DECISION_LABELS[entry.decision] : "Ikke valgt"}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              ))}
            </Table>
          )}
        </div>
        <div className="mt-4 flex gap-4 text-sm">
          {cursor && (
            <Link href={href({ type: kind })} className="underline">
              Til starten
            </Link>
          )}
          {!entries.isDone && (
            <Link href={href({ type: kind, etter: entries.continueCursor })} className="underline">
              Vis flere
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
