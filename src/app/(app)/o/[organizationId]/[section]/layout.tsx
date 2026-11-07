import { notFound } from "next/navigation";
import { SECTIONS } from "@/modules/organizations/sections";

/**
 * Validerer seksjonen i en layout, som ikke strømmes bak loading.tsx: ukjent
 * seksjon gir da ekte 404 og ikke 200 med «Ikke funnet»-innhold.
 */
export default async function SectionLayout({ children, params }: LayoutProps<"/o/[organizationId]/[section]">) {
  const { section } = await params;
  if (!SECTIONS.some((s) => s.slug === section && s.placeholder)) notFound();
  return children;
}
