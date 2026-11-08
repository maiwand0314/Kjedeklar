import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { RegistryLookup } from "@/modules/organizations/components/registry-lookup";
import { RegistryProfileView } from "@/modules/organizations/components/registry-profile";

export const metadata = { title: "Virksomheten" };

export default async function BusinessPage({ params }: PageProps<"/o/[organizationId]/virksomheten">) {
  const { organizationId } = await params;
  const registry = await fetchAuthQuery(api.organizations.registry.current, { organizationId });
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
    </>
  );
}
