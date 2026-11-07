import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { handlePageLoadError } from "../../src/lib/convex-errors";

/** Hva Next.js-funksjonen kastet: digest for redirect/notFound, ellers selve feilen. */
function thrown(error: unknown): unknown {
  try {
    handlePageLoadError(error);
  } catch (e) {
    return (e as { digest?: string }).digest ?? e;
  }
  throw new Error("handlePageLoadError returnerte");
}

describe("handlePageLoadError", () => {
  test("manglende innlogging sender til innloggingen", () => {
    expect(thrown(new ConvexError({ code: "UNAUTHENTICATED" }))).toMatch(/^NEXT_REDIRECT;.*\/logg-inn/);
  });

  test("avslag gir 404", () => {
    expect(thrown(new ConvexError({ code: "NOT_FOUND" }))).toMatch(/404/);
  });

  test("andre feil (nedetid, kodefeil) kastes videre og skjules ikke som 404", () => {
    const outage = new Error("fetch failed");
    expect(thrown(outage)).toBe(outage);
    const forbidden = new ConvexError({ code: "FORBIDDEN" });
    expect(thrown(forbidden)).toBe(forbidden);
  });
});
