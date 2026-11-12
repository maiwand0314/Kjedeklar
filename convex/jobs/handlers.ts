/**
 * Tillatte jobbtyper. En jobb kan bare kjøre en handler som står her; typen
 * kommer aldri som fritt valg fra klienten. Hver type sier hvilken tabell
 * `inputRef` peker inn i, hvor mange forsøk den får, hva arbeidet er (i en
 * action) og hvordan resultatet skrives (i en mutasjon). Se types.ts.
 */
import { probeHandler } from "./testHandler";
import type { JobHandler } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- hver type har sin egen form på resultatet
const HANDLERS: Record<string, JobHandler<any>> = {
  "test.probe": probeHandler,
};

/** Handleren for en type, eller undefined. Bare egne nøkler, så «constructor» og lignende aldri treffer. */
export const jobHandler = (type: string): JobHandler | undefined =>
  Object.prototype.hasOwnProperty.call(HANDLERS, type) ? HANDLERS[type] : undefined;
