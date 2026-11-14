import { ConvexError } from "convex/values";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "ALREADY_MEMBER"
  | "INVITATION_INVALID"
  | "ACCOUNT_EXISTS"
  | "CONFLICT"
  | "PREVIEW_EXPIRED"
  | "PERIOD_EXISTS"
  | "SUPPLIER_EXISTS"
  | "SUPPLIER_KEY_EXISTS"
  | "IMPORT_EXPIRED"
  | "IMPORT_STALE"
  | "IMPORT_UNDECIDED"
  | "RISK_METHOD_MISSING"
  | "RATIONALE_INVALID"
  | "REVIEW_STALE";

const messages: Record<AppErrorCode, string> = {
  UNAUTHENTICATED: "Du må logge inn.",
  NOT_FOUND: "Ikke funnet.",
  FORBIDDEN: "Du har ikke tilgang til denne handlingen.",
  INVALID_INPUT: "Ugyldige opplysninger.",
  ALREADY_MEMBER: "Personen er allerede medlem av organisasjonen.",
  // Samme svar for ukjent, brukt, utløpt, tilbakekalt og feil mottaker.
  INVITATION_INVALID: "Invitasjonen er ugyldig eller utløpt.",
  ACCOUNT_EXISTS: "Det finnes allerede en konto for denne e-postadressen. Logg inn for å godta invitasjonen.",
  CONFLICT: "Opplysningene er endret siden du så dem. Last siden på nytt og prøv igjen.",
  PREVIEW_EXPIRED: "Oppslaget er for gammelt. Slå opp på nytt før du bekrefter.",
  PERIOD_EXISTS: "Det finnes allerede en rapportperiode med disse datoene.",
  SUPPLIER_EXISTS: "Det finnes allerede en leverandør med dette organisasjonsnummeret. Se også blant arkiverte leverandører.",
  SUPPLIER_KEY_EXISTS: "Det finnes allerede en leverandør med denne leverandør-ID-en. Se også blant arkiverte leverandører.",
  IMPORT_EXPIRED: "Importgrunnlaget er utløpt. Last opp filen på nytt og gå gjennom valgene.",
  IMPORT_STALE:
    "En annen import til samme rapportperiode pågår eller er gjennomført etter at dette grunnlaget ble laget. Fullfør en import som ikke er ferdig, og last opp filen på nytt, så forslagene bygger på leverandørene slik de er nå.",
  IMPORT_UNDECIDED: "Noen oppføringer mangler valg. Ta stilling til alle før importen bekreftes.",
  RISK_METHOD_MISSING: "Det finnes ingen aktiv metodeversjon for risikoscreening ennå.",
  RATIONALE_INVALID: "Begrunnelsen må forklare vurderingen med minst fire ord og 20 tegn.",
  REVIEW_STALE:
    "Grunnlaget for screeningen er endret siden den ble beregnet. Kjør screeningen på nytt og se gjennom resultatet før du bekrefter eller overstyrer.",
};

export function appError(code: AppErrorCode) {
  return new ConvexError({ code, message: messages[code] });
}

/** Samme svar for ukjent, fremmed og manglende ressurs, så eksistens ikke røpes. */
export const notFound = () => appError("NOT_FOUND");
export const unauthenticated = () => appError("UNAUTHENTICATED");
