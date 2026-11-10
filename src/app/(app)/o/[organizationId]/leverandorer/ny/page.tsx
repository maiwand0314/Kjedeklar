import Link from "next/link";
import { countryOptions } from "@/domain/suppliers/countries";
import { SupplierForm } from "@/modules/suppliers/components/supplier-form";

export const metadata = { title: "Ny leverandør" };

const EMPTY = { name: "", registryOrgNumber: "", externalKey: "", registeredCountry: "", industryCodeSystem: "", industryCode: "" };

export default async function NewSupplierPage({ params, searchParams }: PageProps<"/o/[organizationId]/leverandorer/ny">) {
  const { organizationId } = await params;
  const { periode } = await searchParams;
  const qs = typeof periode === "string" ? `?periode=${encodeURIComponent(periode)}` : "";
  const base = `/o/${organizationId}/leverandorer`;
  return (
    <>
      <p className="text-sm">
        <Link href={`${base}${qs}`} className="underline">
          Til leverandørlisten
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Ny leverandør</h1>
      <p className="mt-2 text-muted">
        Bare navnet er påkrevd. La felt stå tomme når opplysningen ikke er kjent; de vises da som ukjent.
      </p>
      <div className="mt-6">
        <SupplierForm organizationId={organizationId} countries={countryOptions()} initial={EMPTY} createdHref={`${base}/:id${qs}`} />
      </div>
    </>
  );
}
