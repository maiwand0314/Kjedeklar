import { ConvexError } from "convex/values";

export type AppErrorCode = "UNAUTHENTICATED" | "NOT_FOUND" | "FORBIDDEN";

const messages: Record<AppErrorCode, string> = {
  UNAUTHENTICATED: "Du må logge inn.",
  NOT_FOUND: "Ikke funnet.",
  FORBIDDEN: "Du har ikke tilgang til denne handlingen.",
};

export function appError(code: AppErrorCode) {
  return new ConvexError({ code, message: messages[code] });
}

/** Samme svar for ukjent, fremmed og manglende ressurs, så eksistens ikke røpes. */
export const notFound = () => appError("NOT_FOUND");
export const unauthenticated = () => appError("UNAUTHENTICATED");
