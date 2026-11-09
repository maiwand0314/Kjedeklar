"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Disclosure } from "@/components/ui/disclosure";
import { formatPeriod } from "@/domain/reporting/period";

type Period = { id: string; startDate: string; endDate: string };

/**
 * Viser valgt rapportperiode og bytte mellom organisasjonens egne perioder.
 * Valget ligger i adressen (`?periode=`), ikke i cookie. En id som ikke er en
 * egen periode, velger ingenting her; siden som bruker perioden svarer 404.
 */
export function PeriodSwitcher({ organizationId, periods }: { organizationId: string; periods: Period[] }) {
  const pathname = usePathname();
  const requested = useSearchParams().get("periode");
  const selected = periods.find((p) => p.id === requested) ?? periods[0];
  if (!selected) {
    return (
      <Link href={`/o/${organizationId}/virksomheten#rapportperiode-heading`} className="text-sm underline">
        Opprett rapportperiode
      </Link>
    );
  }
  const label = (
    <>
      <span className="text-sm text-muted">Rapportperiode:</span>{" "}
      <span data-testid="selected-period">{formatPeriod(selected)}</span>
    </>
  );
  if (periods.length < 2) return <p>{label}</p>;
  return (
    <Disclosure
      className="relative"
      summaryClassName="cursor-pointer list-none rounded px-2 py-1 hover:bg-surface"
      summary={
        <>
          {label} <span className="text-sm text-muted">(bytt periode)</span>
        </>
      }
    >
      <ul aria-label="Bytt rapportperiode" className="absolute z-10 mt-1 min-w-64 rounded border border-border bg-background p-1 shadow-lg">
        {periods.map((p) => (
          <li key={p.id}>
            <Link
              href={`${pathname}?periode=${p.id}`}
              aria-current={p.id === selected.id ? "true" : undefined}
              onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
              className="block rounded px-3 py-2 hover:bg-surface aria-[current]:font-semibold"
            >
              {formatPeriod(p)}
            </Link>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
