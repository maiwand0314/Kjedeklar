import { notFound, redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { errorCode } from "@/lib/convex-errors";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import { InvitationsPanel } from "@/modules/invitations/components/invitations-panel";

/**
 * Beskyttet side. Organisasjons-id i URL er bare en kandidat: Convex verifiserer
 * medlemskap. Fremmed, ukjent, inaktiv eller ugyldig id gir samme «Ikke funnet»
 * (404). Ingen cookie eller annen klientverdi brukes som valgt organisasjon.
 */
export default async function OrganizationPage({
  params,
}: PageProps<"/o/[organizationId]">) {
  if (!(await isAuthenticated())) redirect("/logg-inn");
  const { organizationId } = await params;

  let organization: { id: string; name: string; role: string };
  try {
    organization = await fetchAuthQuery(api.organizations.queries.current, {
      organizationId,
    });
  } catch (error) {
    if (errorCode(error) === "UNAUTHENTICATED") redirect("/logg-inn");
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-300 pb-4">
        <p className="font-semibold">Kjedeklar</p>
        <LogoutButton />
      </header>
      <p className="mt-8 text-sm uppercase tracking-wide text-zinc-600">
        Valgt organisasjon
      </p>
      <h1 className="mt-1 text-3xl font-semibold" data-testid="organization-name">
        {organization.name}
      </h1>
      <InvitationsPanel organizationId={organization.id} />
    </main>
  );
}
