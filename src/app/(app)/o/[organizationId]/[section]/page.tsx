import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { SECTIONS } from "@/modules/organizations/sections";

/** Plassholder for seksjoner som ikke er bygget ennå. Ukjent seksjon gir 404. */
function find(slug: string) {
  return SECTIONS.find((s) => s.slug === slug && s.placeholder);
}

export async function generateMetadata({
  params,
}: PageProps<"/o/[organizationId]/[section]">): Promise<Metadata> {
  return { title: find((await params).section)?.label };
}

export default async function SectionPage({ params }: PageProps<"/o/[organizationId]/[section]">) {
  const section = find((await params).section);
  if (!section?.placeholder) notFound();
  return (
    <>
      <h1 className="text-2xl font-semibold">{section.label}</h1>
      <div className="mt-8">
        <EmptyState title={section.placeholder.title}>
          <p>{section.placeholder.text}</p>
        </EmptyState>
      </div>
    </>
  );
}
