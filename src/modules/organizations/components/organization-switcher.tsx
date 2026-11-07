import { Disclosure } from "@/components/ui/disclosure";

type Organization = { id: string; name: string };

/**
 * Viser valgt organisasjon og bytte mellom egne medlemskap (fra listMine).
 * Bytte er en vanlig sidelasting (<a>, ikke next/link): all klienttilstand,
 * ruterbuffer og eventuelle Convex-abonnementer for forrige kunde forsvinner,
 * så ingenting fra den kan vises under den nye.
 */
export function OrganizationSwitcher({
  current,
  organizations,
}: {
  current: Organization;
  organizations: Organization[];
}) {
  const name = (
    <span className="font-semibold" data-testid="organization-name">
      {current.name}
    </span>
  );
  if (organizations.length < 2) return <p>{name}</p>;
  return (
    <Disclosure
      className="relative"
      summaryClassName="cursor-pointer list-none rounded px-2 py-1 hover:bg-surface"
      summary={
        <>
          {name} <span className="text-sm text-muted">(bytt virksomhet)</span>
        </>
      }
    >
      <ul aria-label="Bytt virksomhet" className="absolute z-10 mt-1 min-w-64 rounded border border-border bg-background p-1 shadow-lg">
        {organizations.map((org) => (
          <li key={org.id}>
            <a
              href={`/o/${org.id}`}
              aria-current={org.id === current.id ? "true" : undefined}
              className="block rounded px-3 py-2 hover:bg-surface aria-[current]:font-semibold"
            >
              {org.name}
            </a>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
