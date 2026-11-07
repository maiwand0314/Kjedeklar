import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { placeholderSection } from "@/modules/organizations/sections";

/** Plassholder for seksjoner som ikke er bygget ennå. Ukjent seksjon stoppes i layout.tsx. */
export async function generateMetadata({
  params,
}: PageProps<"/o/[organizationId]/[section]">): Promise<Metadata> {
  return { title: placeholderSection((await params).section)?.label };
}

export default async function SectionPage({ params }: PageProps<"/o/[organizationId]/[section]">) {
  const section = placeholderSection((await params).section);
  if (!section) notFound(); // stoppet allerede i layout.tsx; gir TypeScript en sikker verdi
  return (
    <>
      <h1 className="text-2xl font-semibold">{section.label}</h1>
      <div className="mt-8">
        <EmptyState title={section.title}>
          <p>{section.text}</p>
        </EmptyState>
      </div>
    </>
  );
}
