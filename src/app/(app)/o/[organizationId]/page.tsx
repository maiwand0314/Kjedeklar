import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Oversikt" };

export default async function OverviewPage({ params }: PageProps<"/o/[organizationId]">) {
  const { organizationId } = await params;
  return (
    <>
      <h1 className="text-2xl font-semibold">Oversikt</h1>
      <p className="mt-2 text-muted">Status for arbeidet med åpenhetsloven i virksomheten.</p>
      <div className="mt-8">
        <EmptyState title="Ingen data ennå">
          <p>
            Oversikten fylles ut når virksomhetsprofil, leverandører og vurderinger er registrert.
            Administratorer kan invitere flere under{" "}
            <Link href={`/o/${organizationId}/innstillinger`} className="underline">
              Innstillinger
            </Link>
            .
          </p>
        </EmptyState>
      </div>
    </>
  );
}
