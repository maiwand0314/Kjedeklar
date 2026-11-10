import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Table } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { countryName } from "@/domain/suppliers/countries";
import { fetchAuthQuery } from "@/lib/auth-server";
import { formatOrgNumber } from "@/modules/organizations/components/registry-profile";

export const metadata = { title: "Leverandører" };

const one = (value: string | string[] | undefined) => (typeof value === "string" && value ? value : undefined);

export default async function SuppliersPage({ params, searchParams }: PageProps<"/o/[organizationId]/leverandorer">) {
  const { organizationId } = await params;
  const query = await searchParams;
  const [search, cursor, periode] = [one(query.sok), one(query.etter), one(query.periode)];
  const archived = query.arkiverte === "1";
  const result = await fetchAuthQuery(api.suppliers.queries.list, {
    organizationId,
    search,
    archived,
    paginationOpts: { numItems: 25, cursor: cursor ?? null },
  });

  const base = `/o/${organizationId}/leverandorer`;
  // Valgt rapportperiode følger med alle lenker på siden.
  const href = (path: string, extra: Record<string, string | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries({ ...extra, periode }).filter((e): e is [string, string] => e[1] !== undefined),
    ).toString();
    return `${base}${path}${qs ? `?${qs}` : ""}`;
  };
  const filter = { sok: search, arkiverte: archived ? "1" : undefined };

  return (
    <>
      <h1 className="text-2xl font-semibold">Leverandører</h1>
      <p className="mt-2 text-muted">
        Leverandørene virksomheten kjøper fra. Innkjøpsbeløp og produksjonsland registreres per rapportperiode på
        hver leverandør.
      </p>
      <p className="mt-4 flex flex-wrap gap-2">
        <Link href={href("/ny")} className="inline-block rounded bg-primary px-4 py-2 font-medium text-primary-foreground">
          Ny leverandør
        </Link>
        <Link href={href("/import")} className="inline-block rounded border border-input px-4 py-2 font-medium">
          Forhåndsvis CSV-fil
        </Link>
      </p>

      <form method="get" action={base} role="search" className="mt-8 flex flex-wrap items-end gap-2">
        <Field id="supplier-search" name="sok" label="Søk på starten av navnet" defaultValue={search ?? ""} />
        {archived && <input type="hidden" name="arkiverte" value="1" />}
        {periode && <input type="hidden" name="periode" value={periode} />}
        <Button type="submit" variant="secondary">
          Søk
        </Button>
      </form>
      <nav aria-label="Vis leverandører" className="mt-4 flex gap-2 text-sm">
        {(
          [
            ["Aktive", false],
            ["Arkiverte", true],
          ] as const
        ).map(([label, value]) => (
          <Link
            key={label}
            href={href("", { sok: search, arkiverte: value ? "1" : undefined })}
            aria-current={archived === value ? "page" : undefined}
            className="rounded border border-border px-3 py-1 aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {result.page.length === 0 ? (
          <EmptyState title={search ? "Ingen treff" : archived ? "Ingen arkiverte leverandører" : "Ingen leverandører ennå"}>
            <p>
              {search
                ? `Ingen ${archived ? "arkiverte" : "aktive"} leverandører har et navn som starter med «${search}».`
                : archived
                  ? "Arkiverte leverandører vises her. Ingenting slettes ved arkivering."
                  : "Legg til den første leverandøren med «Ny leverandør»."}
            </p>
          </EmptyState>
        ) : (
          <Table caption={archived ? "Arkiverte leverandører" : "Aktive leverandører"}>
            <thead>
              <tr>
                <th>Navn</th>
                <th>Organisasjonsnummer</th>
                <th>Registreringsland</th>
              </tr>
            </thead>
            <tbody>
              {result.page.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={href(`/${s.id}`)} className="underline">
                      {s.name}
                    </Link>
                  </td>
                  <td>{s.registryOrgNumber ? formatOrgNumber(s.registryOrgNumber) : "Ukjent"}</td>
                  <td>{s.registeredCountry ? countryName(s.registeredCountry) : "Ukjent"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
      <div className="mt-4 flex gap-4 text-sm">
        {cursor && (
          <Link href={href("", filter)} className="underline">
            Til starten
          </Link>
        )}
        {!result.isDone && (
          <Link href={href("", { ...filter, etter: result.continueCursor })} className="underline">
            Vis flere
          </Link>
        )}
      </div>
    </>
  );
}
