import { ConvexError } from "convex/values";
import { notFound, redirect } from "next/navigation";

export function errorCode(error: unknown): string | undefined {
  if (error instanceof ConvexError) {
    const data = error.data as { code?: unknown } | undefined;
    return typeof data?.code === "string" ? data.code : undefined;
  }
  return undefined;
}

/** Norsk brukermelding fra en ConvexError (meldingene er skrevet i Convex), ellers generell. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: unknown } | undefined;
    if (typeof data?.message === "string") return data.message;
  }
  return "Noe gikk galt. Prøv igjen.";
}

/**
 * Feil fra Convex når en side lastes: manglende innlogging sender til
 * innloggingen, avslag (NOT_FOUND) gir 404, og alt annet (nedetid, feil i
 * koden) kastes videre til feilsiden i stedet for å skjules som «Ikke funnet».
 */
export function handlePageLoadError(error: unknown): never {
  const code = errorCode(error);
  if (code === "UNAUTHENTICATED") redirect("/logg-inn");
  if (code === "NOT_FOUND") notFound();
  throw error;
}
