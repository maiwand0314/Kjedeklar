import { redirect } from "next/navigation";
import { Disclosure } from "@/components/ui/disclosure";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { handlePageLoadError } from "@/lib/convex-errors";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import { NavLinks } from "@/modules/organizations/components/nav-links";
import { OrganizationSwitcher } from "@/modules/organizations/components/organization-switcher";

/**
 * Appskall for valgt organisasjon. Organisasjons-id i URL er bare en kandidat:
 * Convex verifiserer medlemskap. Fremmed, ukjent, inaktiv eller ugyldig id gir
 * samme «Ikke funnet» (404). Ingen cookie eller annen klientverdi brukes som
 * valgt organisasjon.
 */
export default async function OrganizationLayout({
  children,
  params,
}: LayoutProps<"/o/[organizationId]">) {
  if (!(await isAuthenticated())) redirect("/logg-inn");
  const { organizationId } = await params;

  let organization: { id: string; name: string };
  let organizations: { id: string; name: string }[];
  try {
    [organization, organizations] = await Promise.all([
      fetchAuthQuery(api.organizations.queries.current, { organizationId }),
      fetchAuthQuery(api.organizations.queries.listMine, {}),
    ]);
  } catch (error) {
    handlePageLoadError(error);
  }

  const nav = (
    <nav aria-label="Hovedmeny">
      <NavLinks organizationId={organization.id} />
    </nav>
  );

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <a
        href="#innhold"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-20 focus:rounded focus:bg-background focus:px-3 focus:py-2"
      >
        Hopp til innholdet
      </a>
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4 md:flex">
        <p className="px-3 font-semibold">Kjedeklar</p>
        {nav}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <Disclosure
            className="relative md:hidden"
            summaryClassName="cursor-pointer list-none rounded border border-input px-3 py-1.5 font-medium"
            summary="Meny"
          >
            <div className="absolute z-10 mt-1 w-64 rounded border border-border bg-background p-2 shadow-lg">
              {nav}
            </div>
          </Disclosure>
          <OrganizationSwitcher current={organization} organizations={organizations} />
          <div className="ml-auto">
            <LogoutButton />
          </div>
        </header>
        <main id="innhold" className="flex-1 px-4 py-8 md:px-8">
          <div className="max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
