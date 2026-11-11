import Link from "next/link";
import { Table } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { formatPeriod } from "@/domain/reporting/period";
import { fetchAuthQuery } from "@/lib/auth-server";
import { ImportPreview } from "@/modules/suppliers/components/import/import-preview";

export const metadata = { title: "Importer fra CSV" };

const dateTime = new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Oslo" });
const STATUS = { draft: "Utkast, ikke bekreftet", committing: "Ikke fullført", committed: "Fullført" } as const;

export default async function SupplierImportPage({ params, searchParams }: PageProps<"/o/[organizationId]/leverandorer/import">) {
  const { organizationId } = await params;
  const { periode } = await searchParams;
  const [periods, batches] = await Promise.all([
    fetchAuthQuery(api.organizations.reportingPeriods.list, { organizationId }),
    fetchAuthQuery(api.suppliers.import.batches.list, { organizationId }),
  ]);
  const selected = typeof periode === "string" && periods.some((p) => p.id === periode) ? periode : undefined;
  const qs = selected ? `?periode=${selected}` : "";
  const base = `/o/${organizationId}/leverandorer`;
  return (
    <>
      <p className="text-sm">
        <Link href={`${base}${qs}`} className="underline">
          Til leverandørlisten
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Importer fra CSV</h1>
      <p className="mt-2 text-muted">
        Last opp en leverandørliste fra regnskapssystemet eller et regneark, og se hvordan Kjedeklar leser den: hvilke
        kolonner som brukes, hvilke verdier som er forstått, og hva som må rettes eller avklares. Ingenting importeres
        før du har gått gjennom oppføringene og bekreftet.
      </p>
      <p className="mt-2 text-muted">
        Filen trenger en kolonne med leverandørens navn. Organisasjonsnummer, egen leverandør-ID, land, innkjøpsbeløp i
        norske kroner, bransjekode, kategori og beskrivelse er valgfrie. Tomme felt vises som ukjent.{" "}
        <a href="/maler/leverandorer-mal.csv" download className="underline">
          Last ned en mal med eksempelrader
        </a>
        .
      </p>
      <div className="mt-8">
        <ImportPreview organizationId={organizationId} periods={periods} initialPeriodId={selected} />
      </div>

      {batches.length > 0 && (
        <section aria-labelledby="importer-heading" className="mt-12">
          <h2 id="importer-heading" className="text-xl font-semibold">
            Tidligere importer
          </h2>
          <p className="mt-1 text-sm text-muted">De ti siste importgrunnlagene. Et utkast må bekreftes innen ett døgn.</p>
          <div className="mt-4">
            <Table caption="Tidligere importer">
              <thead>
                <tr>
                  <th scope="col">Opprettet</th>
                  <th scope="col">Fil</th>
                  <th scope="col">Rapportperiode</th>
                  <th scope="col">Status</th>
                  <th scope="col">Oppføringer</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap">
                      <Link href={`${base}/import/${b.id}${qs}`} className="underline">
                        {dateTime.format(new Date(b.createdAt))}
                      </Link>
                    </td>
                    <td>{b.fileName}</td>
                    <td className="whitespace-nowrap">{b.period ? formatPeriod(b.period) : "–"}</td>
                    <td>{b.expired ? "Utløpt, ikke importert" : STATUS[b.status]}</td>
                    <td className="whitespace-nowrap">
                      {b.status === "draft" ? b.entryCount : `${b.processed} av ${b.entryCount} behandlet`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </section>
      )}
    </>
  );
}
