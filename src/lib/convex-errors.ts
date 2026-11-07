import { ConvexError } from "convex/values";

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
