import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { errorCode } from "@/lib/convex-errors";
import { LogoutButton } from "@/modules/auth/components/logout-button";

export default async function HomePage() {
  if (!(await isAuthenticated())) redirect("/logg-inn");

  let organizations: { id: string; name: string }[];
  try {
    organizations = await fetchAuthQuery(api.organizations.queries.listMine, {});
  } catch (error) {
    if (errorCode(error) === "UNAUTHENTICATED") redirect("/logg-inn");
    throw error;
  }

  if (organizations.length === 1) redirect(`/o/${organizations[0].id}`);

  return (
    <main className="mx-auto w-full max-w-md px-6 py-24">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Velg organisasjon</h1>
        <LogoutButton />
      </div>
      {organizations.length === 0 ? (
        <p className="mt-6 text-muted">
          Du har ingen aktive organisasjoner. Kontakt den som inviterte deg.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {organizations.map((org) => (
            <li key={org.id}>
              <Link href={`/o/${org.id}`} className="underline">
                {org.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
