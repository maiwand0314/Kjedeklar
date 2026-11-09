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
  | "PERIOD_EXISTS";

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
};

export function appError(code: AppErrorCode) {
  return new ConvexError({ code, message: messages[code] });
}

/** Samme svar for ukjent, fremmed og manglende ressurs, så eksistens ikke røpes. */
export const notFound = () => appError("NOT_FOUND");
export const unauthenticated = () => appError("UNAUTHENTICATED");
