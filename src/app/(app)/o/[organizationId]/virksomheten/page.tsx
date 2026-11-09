import { EmptyState } from "@/components/ui/empty-state";
import { Table } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { handlePageLoadError } from "@/lib/convex-errors";
import { oreToInput, type FormValues, type YearValues } from "@/domain/applicability/form";
import type { YearFigures } from "@/domain/applicability/assess";
import { formatIsoDate, formatPeriod, suggestPeriod } from "@/domain/reporting/period";
import { emptyAnswers, PROFILE_TOPICS, profileGaps } from "@/domain/reporting/profile";
import { ApplicabilityForm } from "@/modules/organizations/components/applicability-form";
import { ApplicabilitySummary } from "@/modules/organizations/components/applicability-summary";
import { PeriodForm } from "@/modules/organizations/components/period-form";
import { ProfileForm } from "@/modules/organizations/components/profile-form";
import { RegistryLookup } from "@/modules/organizations/components/registry-lookup";
import { RegistryProfileView } from "@/modules/organizations/components/registry-profile";

export const metadata = { title: "Virksomheten" };

const dateTime = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Oslo" });
const topicLabels = (keys: string[]) => PROFILE_TOPICS.filter((t) => keys.includes(t.key)).map((t) => t.label).join(", ");

const toValues = (y: YearFigures): YearValues => ({
  fiscalYear: String(y.fiscalYear),
  salesRevenue: oreToInput(y.salesRevenueOre),
  balanceSheetTotal: oreToInput(y.balanceSheetTotalOre),
  averageFte: y.averageFte === null ? "" : String(y.averageFte).replace(".", ","),
});

const emptyYear = (fiscalYear: number): YearValues => ({
  fiscalYear: String(fiscalYear),
  salesRevenue: "",
  balanceSheetTotal: "",
  averageFte: "",
});

export default async function BusinessPage({ params, searchParams }: PageProps<"/o/[organizationId]/virksomheten">) {
  const { organizationId } = await params;
  const { periode } = await searchParams;
  const [registry, assessments, periods] = await Promise.all([
    fetchAuthQuery(api.organizations.registry.current, { organizationId }),
    fetchAuthQuery(api.organizations.applicability.history, { organizationId }),
    fetchAuthQuery(api.organizations.reportingPeriods.list, { organizationId }),
  ]);
  // Perioden i adressen er bare en kandidat: Convex laster den med getOwned, så
  // en ugyldig eller fremmed id gir 404. Uten valg brukes den nyeste perioden.
  const periodId = typeof periode === "string" ? periode : periods[0]?.id;
  let profile;
  try {
    profile = periodId
      ? await fetchAuthQuery(api.organizations.businessProfile.current, { organizationId, reportingPeriodId: periodId })
      : null;
  } catch (error) {
    handlePageLoadError(error);
  }
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(new Date());
  const gaps = profileGaps(profile?.latest?.answers ?? null);
  const notEstablished = PROFILE_TOPICS.filter((t) => profile?.latest?.answers[t.key].status === "not_established").map((t) => t.key);
  const latest = assessments[0];
  // Forslag til år når ingen vurdering finnes; kunden kan endre det.
  const lastYear = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Oslo" }).format(new Date())) - 1;
  const initial: FormValues = latest
    ? {
        previousYear: toValues(latest.inputs.previousYear),
        currentYear: toValues(latest.inputs.currentYear),
        previousStatus: latest.inputs.previousStatus,
        isParentCompany: latest.inputs.isParentCompany,
        publicInterestEntity: latest.inputs.publicInterestEntity,
        norwegian: latest.inputs.norwegian,
      }
    : {
        previousYear: emptyYear(lastYear - 1),
        currentYear: emptyYear(lastYear),
        previousStatus: "unknown",
        isParentCompany: "unknown",
        publicInterestEntity: "unknown",
        norwegian: "yes",
      };
  return (
    <>
      <h1 className="text-2xl font-semibold">Virksomheten</h1>
      <section aria-labelledby="register-heading" className="mt-8">
        <h2 id="register-heading" className="text-xl font-semibold">
          Opplysninger fra Enhetsregisteret
        </h2>
        <div className="mt-4">
          {registry.profile && registry.fetchedAt ? (
            <RegistryProfileView profile={registry.profile} fetchedAt={registry.fetchedAt} gaps={registry.gaps} />
          ) : (
            <EmptyState title="Ikke bekreftet ennå">
              <p>
                Hent virksomhetens opplysninger fra Enhetsregisteret med organisasjonsnummeret, og bekreft dem.
                Organisasjonsnummeret gir ikke tilgang til andre arbeidsområder.
              </p>
            </EmptyState>
          )}
        </div>
        <h3 className="mt-8 font-semibold">{registry.profile ? "Oppdater fra registeret" : "Hent fra registeret"}</h3>
        <div className="mt-3">
          <RegistryLookup
            organizationId={organizationId}
            currentName={registry.name}
            currentSnapshotId={registry.snapshotId}
            currentOrgNumber={registry.profile?.orgNumber ?? null}
          />
        </div>
      </section>
      <section aria-labelledby="plikt-heading" className="mt-12">
        <h2 id="plikt-heading" className="text-xl font-semibold">
          Er virksomheten omfattet av åpenhetsloven?
        </h2>
        <p className="mt-1 text-sm text-muted">
          Veiledende vurdering etter åpenhetsloven §§ 2–3. Hver lagret vurdering bevares som historikk.
        </p>
        <div className="mt-4">
          {latest ? (
            <ApplicabilitySummary assessment={latest} />
          ) : (
            <EmptyState title="Ingen vurdering ennå">
              <p>Fyll inn tallene og svarene under for å få en veiledende vurdering.</p>
            </EmptyState>
          )}
        </div>
        <h3 className="mt-8 font-semibold">{latest ? "Ny vurdering" : "Vurder plikten"}</h3>
        <div className="mt-3">
          <ApplicabilityForm organizationId={organizationId} initial={initial} />
        </div>
      </section>
      <section aria-labelledby="rapportperiode-heading" className="mt-12">
        <h2 id="rapportperiode-heading" className="text-xl font-semibold">
          Rapportperiode
        </h2>
        <p className="mt-1 text-sm text-muted">
          Perioden redegjørelsen skal dekke. Kjedeklar sender ingen påminnelser om fristen.
        </p>
        <div className="mt-4">
          {profile ? (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[12rem_1fr]">
              <dt className="text-muted">Valgt periode</dt>
              <dd>{formatPeriod(profile.period)}</dd>
              <dt className="text-muted">Publiseringsfrist</dt>
              <dd>{formatIsoDate(profile.period.publicationDueDate)}</dd>
            </dl>
          ) : (
            <EmptyState title="Ingen rapportperiode ennå">
              <p>Opprett perioden redegjørelsen skal dekke. Virksomhetsprofilen fylles ut per periode.</p>
            </EmptyState>
          )}
        </div>
        <h3 className="mt-8 font-semibold">Ny rapportperiode</h3>
        <p className="mt-1 text-sm text-muted">
          Forslaget er et kalenderår. Endre datoene hvis virksomheten har avvikende regnskapsår.
        </p>
        <div className="mt-3">
          <PeriodForm key={periods.length} organizationId={organizationId} suggestion={suggestPeriod(today, periods)} />
        </div>
      </section>
      {profile && (
        <section aria-labelledby="profil-heading" className="mt-12">
          <h2 id="profil-heading" className="text-xl font-semibold">
            Virksomhetsprofil
          </h2>
          <p className="mt-1 text-sm text-muted">
            Egen virksomhet, ansvar og rutiner for perioden {formatPeriod(profile.period)}. Hver lagring bevares som en
            egen versjon. Svar bare med det som faktisk er på plass.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {profile.latest ? (
              <p>
                Versjon {profile.latest.revision}, lagret {dateTime.format(new Date(profile.latest.savedAt))}.{" "}
                {profile.latest.confirmedAt ? "Bekreftet internt." : "Ikke bekreftet."}
              </p>
            ) : (
              <p>Profilen er ikke lagret for denne perioden.</p>
            )}
            {gaps.length > 0 && (
              <p data-testid="profile-gaps">
                <strong>Ikke besvart ({gaps.length}):</strong> {topicLabels(gaps)}
              </p>
            )}
            {notEstablished.length > 0 && (
              <p>
                <strong>Oppgitt som ikke etablert:</strong> {topicLabels(notEstablished)}
              </p>
            )}
          </div>
          <div className="mt-6">
            <ProfileForm
              key={profile.period.id}
              organizationId={organizationId}
              periodId={profile.period.id}
              initial={profile.latest?.answers ?? emptyAnswers()}
              initialRevision={profile.latest?.revision ?? 0}
            />
          </div>
          {profile.history.length > 0 && (
            <>
              <h3 className="mt-8 font-semibold">Versjonshistorikk</h3>
              <div className="mt-3">
                <Table caption="Versjoner av virksomhetsprofilen">
                  <thead>
                    <tr>
                      <th>Versjon</th>
                      <th>Lagret</th>
                      <th>Bekreftet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.history.map((r) => (
                      <tr key={r.revision}>
                        <td>{r.revision}</td>
                        <td>{dateTime.format(new Date(r.savedAt))}</td>
                        <td>{r.confirmed ? "Ja" : "Nei"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
