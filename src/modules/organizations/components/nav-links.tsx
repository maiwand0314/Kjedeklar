"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS } from "../sections";

/** Menylenker innen valgt organisasjon. Aktiv side markeres for skjermlesere med aria-current. */
export function NavLinks({ organizationId }: { organizationId: string }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {SECTIONS.map(({ slug, label }) => {
        const href = slug ? `/o/${organizationId}/${slug}` : `/o/${organizationId}`;
        const active = pathname === href;
        return (
          <li key={slug}>
            <Link
              href={href}
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
