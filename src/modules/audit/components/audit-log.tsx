import Link from "next/link";
import { Table } from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { formatKroner } from "@/domain/applicability/form";
import { PROFILE_TOPICS } from "@/domain/reporting/profile";

const EVENTS: Record<string, string> = {
  "organization.provisioned": "Virksomheten ble opprettet",
  "organization.renamed": "Navnet ble endret",
  "membership.created": "Administrator lagt til",
  "membership.status_changed": "Medlemskap endret",
  "invitation.created": "Invitasjon sendt",
  "invitation.renewed": "Invitasjon fornyet",
  "invitation.revoked": "Invitasjon tilbakekalt",
  "invitation.accepted": "Invitasjon godtatt",
  "applicability.assessed": "Pliktvurdering lagret",
  "reporting_period.created": "Rapportperiode opprettet",
  "business_profile.saved": "Virksomhetsprofil lagret",
  "supplier.created": "Leverandør opprettet",
  "supplier.updated": "Leverandør endret",
  "supplier.archived": "Leverandør arkivert",
  "supplier.restored": "Leverandør gjenopprettet",
  "supplier_period.saved": "Innkjøpsdata lagret",
};

const FIELDS: Record<string, string> = {
  name: "Navn",
  status: "Status",
  role: "Rolle",
  expiresAt: "Utløper",
  result: "Resultat",
  ruleVersion: "Regelversjon",
  startDate: "Fra og med",
  endDate: "Til og med",
  publicationDueDate: "Publiseringsfrist",
  revision: "Versjon",
  confirmed: "Bekreftet",
  registryOrgNumber: "Organisasjonsnummer",
  externalKey: "Egen leverandør-ID",
  registeredCountry: "Registreringsland",
  industryCodeSystem: "Kodeverk",
  industryCode: "Bransjekode",
  spendOre: "Innkjøp",
  purchaseCategory: "Kategori",
  productionCountries: "Kjente produksjonsland",
  upstreamUnknown: "Oppstrøms ukjent",
  ...Object.fromEntries(PROFILE_TOPICS.map((t) => [t.key, t.label])),
};

const VALUES: Record<string, string> = {
  active: "aktiv",
  inactive: "inaktiv",
  pending: "venter",
  accepted: "godtatt",
  revoked: "tilbakekalt",
  admin: "administrator",
  likely_in: "sannsynlig omfattet",
  likely_out: "sannsynlig ikke omfattet",
  manual_review: "manuell avklaring",
  open: "åpen",
  archived: "arkivert",
  described: "beskrevet",
  not_established: "ikke etablert",
  unknown: "ikke besvart",
};

const FILTERS = [
  { key: undefined, label: "Alle" },
  { key: "organization", label: "Virksomhet" },
  { key: "membership", label: "Medlemskap" },
  { key: "invitation", label: "Invitasjoner" },
  { key: "applicability", label: "Pliktvurdering" },
  { key: "reportingPeriod", label: "Rapportperioder" },
  { key: "businessProfile", label: "Virksomhetsprofil" },
  { key: "supplier", label: "Leverandører" },
  { key: "supplierPeriod", label: "Innkjøpsdata" },
] as const;

type EntityType = NonNullable<(typeof FILTERS)[number]["key"]>;

const dateFormat = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

function formatValue(field: string, value: unknown): string {
  if (value === undefined || value === null) return "–";
  if (field === "expiresAt" && typeof value === "number") return dateFormat.format(new Date(value));
  if (field === "spendOre" && typeof value === "string") return formatKroner(BigInt(value));
  if (typeof value === "string") return VALUES[value] ?? value;
  if (typeof value === "boolean") return value ? "ja" : "nei";
  return String(value);
}

function describeDiff(diff: Record<string, { from?: unknown; to?: unknown }>): string {
  return Object.entries(diff)
    .map(([field, { from, to }]) =>
      from === undefined ? `${FIELDS[field] ?? field}: ${formatValue(field, to)}` : `${FIELDS[field] ?? field}: ${formatValue(field, from)} → ${formatValue(field, to)}`,
    )
    .join("; ");
}

/** Revisjonslogg for valgt organisasjon, med filter og «Vis eldre» (25 per side). */
export async function AuditLog({
  organizationId,
  entityType,
  cursor,
  period,
}: {
  organizationId: string;
  entityType?: EntityType;
  cursor?: string;
  /** Valgt rapportperiode fra adressen; følger med lenkene i loggen. */
  period?: string;
}) {
  const result = await fetchAuthQuery(api.audit.queries.list, {
    organizationId,
    entityType,
    paginationOpts: { numItems: 25, cursor: cursor ?? null },
  });
  const base = `/o/${organizationId}/innstillinger`;
  const href = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams(
      Object.entries({ ...params, periode: period }).filter((e): e is [string, string] => e[1] !== undefined),
    ).toString();
    return `${base}${search ? `?${search}` : ""}#revisjonslogg`;
  };

  return (
    <section aria-labelledby="revisjonslogg" className="mt-12">
      <h2 id="revisjonslogg" className="text-xl font-semibold">
        Revisjonslogg
      </h2>
      <p className="mt-1 text-sm text-muted">
        Endringer i virksomheten, medlemskap, invitasjoner, rapportperioder, virksomhetsprofil og leverandører. Loggen kan ikke endres fra appen.
      </p>
      <nav aria-label="Filtrer revisjonslogg" className="mt-4 flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={href({ logg: f.key })}
            aria-current={entityType === f.key ? "page" : undefined}
            className="rounded border border-border px-3 py-1 aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {result.page.length === 0 ? (
        <p className="mt-6 text-muted">Ingen hendelser.</p>
      ) : (
        <div className="mt-4">
          <Table caption="Revisjonslogg">
            <thead>
              <tr>
                <th>Tidspunkt</th>
                <th>Hendelse</th>
                <th>Utført av</th>
                <th>Endring</th>
              </tr>
            </thead>
            <tbody>
              {result.page.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{dateFormat.format(new Date(e.occurredAt))}</td>
                  <td>{EVENTS[e.eventType] ?? e.eventType}</td>
                  <td>{e.actor}</td>
                  <td>{describeDiff(e.safeDiff) || "–"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <div className="mt-4 flex gap-4 text-sm">
        {cursor && (
          <Link href={href({ logg: entityType })} className="underline">
            Til nyeste
          </Link>
        )}
        {!result.isDone && (
          <Link href={href({ logg: entityType, etter: result.continueCursor })} className="underline">
            Vis eldre
          </Link>
        )}
      </div>
    </section>
  );
}
