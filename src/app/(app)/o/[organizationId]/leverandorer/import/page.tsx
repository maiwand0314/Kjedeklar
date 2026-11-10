import Link from "next/link";
import { ImportPreview } from "@/modules/suppliers/components/import/import-preview";

export const metadata = { title: "Forhåndsvis CSV-fil" };

export default async function SupplierImportPage({ params, searchParams }: PageProps<"/o/[organizationId]/leverandorer/import">) {
  const { organizationId } = await params;
  const { periode } = await searchParams;
  const qs = typeof periode === "string" ? `?periode=${encodeURIComponent(periode)}` : "";
  return (
    <>
      <p className="text-sm">
        <Link href={`/o/${organizationId}/leverandorer${qs}`} className="underline">
          Til leverandørlisten
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Forhåndsvis CSV-fil</h1>
      <p className="mt-2 text-muted">
        Last opp en leverandørliste fra regnskapssystemet eller et regneark, og se hvordan Kjedeklar leser den: hvilke
        kolonner som brukes, hvilke verdier som er forstått, og hva som må rettes eller avklares før import.
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
        <ImportPreview organizationId={organizationId} />
      </div>
    </>
  );
}
