import { registryStatusText, type RegistryProfile } from "@/domain/brreg/enhet";

const dateTime = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Oslo" });
const date = new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeZone: "Europe/Oslo" });

export const formatOrgNumber = (n: string) => n.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");


/** Viser registeropplysninger med kilde, hentetid og datamangler. */
export function RegistryProfileView({
  profile,
  fetchedAt,
  gaps,
}: {
  profile: RegistryProfile;
  fetchedAt: number;
  gaps: string[];
}) {

  const address = profile.address
    ? [...profile.address.lines, [profile.address.postalCode, profile.address.city].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ")
    : null;
  return (
    <div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]">
        <dt className="text-muted">Navn i registeret</dt>
        <dd>{profile.name}</dd>
        <dt className="text-muted">Organisasjonsnummer</dt>
        <dd>{formatOrgNumber(profile.orgNumber)}</dd>
        <dt className="text-muted">Organisasjonsform</dt>
        <dd>{profile.legalForm ? `${profile.legalForm} – ${profile.legalFormDescription ?? ""}` : "Mangler"}</dd>
        <dt className="text-muted">{profile.addressKind === "postadresse" ? "Postadresse" : "Forretningsadresse"}</dt>
        <dd>{address ?? "Mangler"}</dd>
        <dt className="text-muted">Næringskode</dt>
        <dd>
          {profile.industryCode
            ? `${profile.industryCode} – ${profile.industryDescription ?? ""} (SN, versjon ikke oppgitt av registeret)`
            : "Mangler"}
        </dd>
        <dt className="text-muted">Registerstatus</dt>
        <dd>{registryStatusText(profile, (iso) => date.format(new Date(iso)))}</dd>
      </dl>
      {gaps.length > 0 && (
        <div role="note" className="mt-4 rounded border border-border p-3">
          <p className="font-medium">Datamangler som må avklares</p>
          <ul className="mt-1 list-disc pl-5">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-sm text-muted">
        Kilde: Enhetsregisteret (Brønnøysundregistrene), hentet {dateTime.format(new Date(fetchedAt))}.
      </p>
    </div>
  );
}
