import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { countryName } from "@/domain/suppliers/countries";
import { REGISTRY_STATE_LABELS, registryErrorText, SUGGESTION_LABELS } from "@/domain/suppliers/registry";
import { RegistryProfileView } from "@/modules/organizations/components/registry-profile";
import { RefreshWhileQueued, RequestRegistryButton, SuggestionRow } from "./registry-controls";

const dateTime = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Oslo" });

/** Brreg-status for én leverandør: sist hentet, feil, registerforslag og knapp for ny henting. */
export async function RegistrySection({
  organizationId,
  supplierId,
  rowVersion,
  archived,
}: {
  organizationId: string;
  supplierId: string;
  rowVersion: number;
  archived: boolean;
}) {
  const info = await fetchAuthQuery(api.suppliers.enrichment.get, { organizationId, supplierId });
  const display = (field: string, value: string | null) => (value === null ? "Ukjent" : field === "registeredCountry" ? countryName(value) : value);
  return (
    <section aria-labelledby="register-heading" className="mt-12">
      <h2 id="register-heading" className="text-xl font-semibold">
        Enhetsregisteret
      </h2>
      <p className="mt-1 text-sm text-muted">
        For leverandører med norsk organisasjonsnummer. Registerverdier er forslag: de endrer ikke profilen før du godtar dem, og
        registerstatus er et kontrollsignal, ikke en vurdering av leverandøren.
      </p>
      <RefreshWhileQueued active={info.state === "queued"} />
      <p className="mt-4" data-testid="registry-state">
        <strong>Status:</strong> {REGISTRY_STATE_LABELS[info.state]}
        {info.state === "failed" && <span> – {registryErrorText(info.errorCode)}</span>}
      </p>
      {info.state === "not_found" && <p className="mt-1 text-sm">Organisasjonsnummeret finnes ikke i Enhetsregisteret. Kontroller nummeret.</p>}
      {info.profile && info.fetchedAt !== null && (
        <div className="mt-4">
          {info.state !== "succeeded" && (
            <p className="mb-2 text-sm text-muted">Viser siste vellykkede henting ({dateTime.format(new Date(info.fetchedAt))}).</p>
          )}
          <RegistryProfileView profile={info.profile} fetchedAt={info.fetchedAt} gaps={info.gaps} />
        </div>
      )}
      {info.suggestions.length > 0 && !archived && (
        <div className="mt-6" data-testid="registry-suggestions">
          <h3 className="font-semibold">Forslag fra registeret</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {info.suggestions.map((s) => (
              <SuggestionRow
                key={s.field}
                organizationId={organizationId}
                supplierId={supplierId}
                rowVersion={rowVersion}
                field={s.field}
                label={SUGGESTION_LABELS[s.field]}
                current={display(s.field, s.current)}
                proposed={display(s.field, s.proposed)}
                expectedValue={s.proposed}
              />
            ))}
          </ul>
        </div>
      )}
      {info.industryCodeSource && (
        <p className="mt-4 text-sm text-muted">Næringskoden er tatt fra Enhetsregisteret, hentet {dateTime.format(new Date(info.industryCodeSource.fetchedAt))}.</p>
      )}
      {info.state !== "not_applicable" && info.state !== "queued" && (
        <div className="mt-6">
          <RequestRegistryButton
            organizationId={organizationId}
            supplierId={supplierId}
            label={info.state === "not_fetched" ? "Hent fra Enhetsregisteret" : "Hent på nytt"}
          />
        </div>
      )}
      {info.state === "not_applicable" && (
        <p className="mt-2 text-sm text-muted">Leverandøren har ikke norsk organisasjonsnummer og registreres manuelt.</p>
      )}
    </section>
  );
}
