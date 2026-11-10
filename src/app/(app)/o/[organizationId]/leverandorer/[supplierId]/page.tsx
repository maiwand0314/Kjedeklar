import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/convex/_generated/api";
import { formatKroner, oreToInput } from "@/domain/applicability/form";
import { formatPeriod } from "@/domain/reporting/period";
import { countryName, countryOptions } from "@/domain/suppliers/countries";
import { fetchAuthQuery } from "@/lib/auth-server";
import { handlePageLoadError } from "@/lib/convex-errors";
import { ArchiveButton } from "@/modules/suppliers/components/archive-button";
import { SupplierForm } from "@/modules/suppliers/components/supplier-form";
import { SupplierPeriodForm } from "@/modules/suppliers/components/supplier-period-form";

export const metadata = { title: "Leverandør" };

export default async function SupplierPage({
  params,
  searchParams,
}: PageProps<"/o/[organizationId]/leverandorer/[supplierId]">) {
  const { organizationId, supplierId } = await params;
  const { periode } = await searchParams;
  const periods = await fetchAuthQuery(api.organizations.reportingPeriods.list, { organizationId });
  // Perioden i adressen er bare en kandidat: Convex laster både leverandør og
  // periode med getOwned. Uten valg brukes den nyeste perioden.
  const periodId = typeof periode === "string" ? periode : periods[0]?.id;
  let detail;
  try {
    detail = await fetchAuthQuery(api.suppliers.queries.get, { organizationId, supplierId, reportingPeriodId: periodId });
  } catch (error) {
    handlePageLoadError(error);
  }
  const { supplier, periodData, sameName } = detail;
  const period = periods.find((p) => p.id === periodId);
  const qs = typeof periode === "string" ? `?periode=${encodeURIComponent(periode)}` : "";
  const base = `/o/${organizationId}/leverandorer`;
  const countries = countryOptions();
  const archived = supplier.status === "archived";

  return (
    <>
      <p className="text-sm">
        <Link href={`${base}${qs}`} className="underline">
          Til leverandørlisten
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{supplier.name}</h1>
      {archived && (
        <p className="mt-2">
          <strong>Arkivert.</strong> Leverandøren vises ikke i listen over aktive leverandører. Opplysningene er bevart.
        </p>
      )}
      {sameName.length > 0 && (
        <div className="mt-4 rounded border border-border bg-surface p-4" data-testid="same-name">
          <p>
            <strong>Mulig duplikat:</strong> en annen leverandør har samme navn. Kjedeklar slår ikke sammen
            leverandører automatisk. Kontroller om det er samme leverandør:
          </p>
          <ul className="mt-2 list-disc pl-6">
            {sameName.map((s) => (
              <li key={s.id}>
                <Link href={`${base}/${s.id}${qs}`} className="underline">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="profil-heading" className="mt-10">
        <h2 id="profil-heading" className="text-xl font-semibold">
          Leverandørprofil
        </h2>
        <p className="mt-1 text-sm text-muted">Opplysninger om leverandøren selv. De gjelder for alle rapportperioder.</p>
        <div className="mt-4">
          <SupplierForm
            organizationId={organizationId}
            countries={countries}
            initial={{
              name: supplier.name,
              registryOrgNumber: supplier.registryOrgNumber ?? "",
              externalKey: supplier.externalKey ?? "",
              registeredCountry: supplier.registeredCountry ?? "",
              industryCodeSystem: supplier.industryCodeSystem ?? "",
              industryCode: supplier.industryCode ?? "",
            }}
            target={{ supplierId: supplier.id, rowVersion: supplier.rowVersion }}
          />
        </div>
      </section>

      <section aria-labelledby="innkjop-heading" className="mt-12">
        <h2 id="innkjop-heading" className="text-xl font-semibold">
          Innkjøp i rapportperioden
        </h2>
        {period ? (
          <>
            <p className="mt-1 text-sm text-muted">
              Gjelder perioden {formatPeriod(period)}. Bytt periode øverst på siden for å se eller registrere et annet år.
            </p>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[14rem_1fr]" data-testid="period-summary">
              <dt className="text-muted">Innkjøp i perioden</dt>
              <dd>{periodData?.spendOre === undefined ? "Ukjent" : formatKroner(periodData.spendOre)}</dd>
              <dt className="text-muted">Kategori</dt>
              <dd>{periodData?.purchaseCategory ?? "Ikke oppgitt"}</dd>
              <dt className="text-muted">Registreringsland</dt>
              <dd>{supplier.registeredCountry ? countryName(supplier.registeredCountry) : "Ukjent"}</dd>
              <dt className="text-muted">Kjente produksjonsland</dt>
              <dd>
                {periodData?.productionCountries.length
                  ? periodData.productionCountries.map(countryName).join(", ")
                  : "Ukjent"}
              </dd>
              <dt className="text-muted">Leddene bak leverandøren</dt>
              <dd>{(periodData?.upstreamUnknown ?? true) ? "Ukjent" : "Oppgitt som kartlagt"}</dd>
            </dl>
            {!periodData && <p className="mt-2 text-sm text-muted">Ingen innkjøpsdata er lagret for denne perioden.</p>}
            <div className="mt-6">
              <SupplierPeriodForm
                key={period.id}
                organizationId={organizationId}
                supplierId={supplier.id}
                periodId={period.id}
                countries={countries}
                initial={{
                  spend: oreToInput(periodData?.spendOre ?? null),
                  purchaseCategory: periodData?.purchaseCategory ?? "",
                  purchaseDescription: periodData?.purchaseDescription ?? "",
                  productionCountries: periodData?.productionCountries ?? [],
                  upstreamUnknown: periodData?.upstreamUnknown ?? true,
                }}
                initialRowVersion={periodData?.rowVersion ?? 0}
              />
            </div>
          </>
        ) : (
          <div className="mt-4">
            <EmptyState title="Ingen rapportperiode ennå">
              <p>
                Innkjøpsdata registreres per rapportperiode.{" "}
                <Link href={`/o/${organizationId}/virksomheten#rapportperiode-heading`} className="underline">
                  Opprett en rapportperiode
                </Link>{" "}
                først.
              </p>
            </EmptyState>
          </div>
        )}
      </section>

      <section aria-labelledby="arkiv-heading" className="mt-12">
        <h2 id="arkiv-heading" className="text-xl font-semibold">
          Arkivering
        </h2>
        <p className="mt-1 text-sm text-muted">
          {archived
            ? "Gjenoppretting legger leverandøren tilbake i listen over aktive leverandører."
            : "Arkivering fjerner leverandøren fra listen over aktive leverandører. Profil, innkjøpsdata og revisjonslogg blir stående."}
        </p>
        <div className="mt-4">
          <ArchiveButton organizationId={organizationId} supplierId={supplier.id} rowVersion={supplier.rowVersion} archived={archived} />
        </div>
      </section>
    </>
  );
}
