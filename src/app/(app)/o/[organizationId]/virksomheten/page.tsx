import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { oreToInput, type FormValues, type YearValues } from "@/domain/applicability/form";
import type { YearFigures } from "@/domain/applicability/assess";
import { ApplicabilityForm } from "@/modules/organizations/components/applicability-form";
import { ApplicabilitySummary } from "@/modules/organizations/components/applicability-summary";
import { RegistryLookup } from "@/modules/organizations/components/registry-lookup";
import { RegistryProfileView } from "@/modules/organizations/components/registry-profile";

export const metadata = { title: "Virksomheten" };

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

export default async function BusinessPage({ params }: PageProps<"/o/[organizationId]/virksomheten">) {
  const { organizationId } = await params;
  const [registry, assessments] = await Promise.all([
    fetchAuthQuery(api.organizations.registry.current, { organizationId }),
    fetchAuthQuery(api.organizations.applicability.history, { organizationId }),
  ]);
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
    </>
  );
}
