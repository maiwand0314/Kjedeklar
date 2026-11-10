"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SECTIONS } from "../sections";

/**
 * Menylenker innen valgt organisasjon. Aktiv side markeres for skjermlesere med
 * aria-current. Valgt rapportperiode (`?periode=`) følger med lenkene, men bare
 * når den er en av organisasjonens egne perioder.
 */
export function NavLinks({ organizationId, periodIds }: { organizationId: string; periodIds: string[] }) {
  const pathname = usePathname();
  const period = useSearchParams().get("periode");
  const query = period && periodIds.includes(period) ? `?periode=${period}` : "";
  return (
    <ul className="flex flex-col gap-1">
      {SECTIONS.map(({ slug, label }) => {
        const href = slug ? `/o/${organizationId}/${slug}` : `/o/${organizationId}`;
        const active = pathname === href;
        return (
          <li key={slug}>
            <Link
              href={`${href}${query}`}
              aria-current={active ? "page" : undefined}
              // Lukk mobilmenyen (<details>) etter valg; layouten blir stående ved navigering.
              onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
              className={`block rounded px-3 py-2 ${active ? "bg-primary text-primary-foreground" : "hover:bg-surface"}`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
