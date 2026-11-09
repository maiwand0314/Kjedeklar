import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { AuditLog } from "@/modules/audit/components/audit-log";
import { InvitationsPanel } from "@/modules/invitations/components/invitations-panel";
import { RenameOrganizationForm } from "@/modules/organizations/components/rename-form";

export const metadata = { title: "Innstillinger" };

const ENTITY_TYPES = ["organization", "membership", "invitation", "applicability", "reportingPeriod", "businessProfile"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

export default async function SettingsPage({
  params,
  searchParams,
}: PageProps<"/o/[organizationId]/innstillinger">) {
  const { organizationId } = await params;
  const { logg, etter, periode } = await searchParams;
  const entityType = ENTITY_TYPES.find((t) => t === logg) as EntityType | undefined;
  const organization = await fetchAuthQuery(api.organizations.queries.current, { organizationId });
  return (
    <>
      <h1 className="text-2xl font-semibold">Innstillinger</h1>
      <section aria-labelledby="virksomhet-heading" className="mt-8">
        <h2 id="virksomhet-heading" className="text-xl font-semibold">
          Virksomheten
        </h2>
        <div className="mt-4">
          <RenameOrganizationForm organizationId={organizationId} name={organization.name} />
        </div>
      </section>
      <div className="mt-12">
        <InvitationsPanel organizationId={organizationId} />
      </div>
      <AuditLog
        organizationId={organizationId}
        entityType={entityType}
        cursor={typeof etter === "string" ? etter : undefined}
        period={typeof periode === "string" ? periode : undefined}
      />
    </>
  );
}
