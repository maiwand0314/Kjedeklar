import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

/**
 * Køen alle bakgrunnsjobber går gjennom. Workpool begrenser hvor mange som
 * kjører samtidig og står for nye forsøk med ventetid. Forsøk er av som
 * standard: hver jobbtype oppgir sine egne grenser (se handlers.ts).
 */
export const jobPool = new Workpool(components.jobWorkpool, {
  maxParallelism: 5,
  retryActionsByDefault: false,
  // Bare advarsler og feil. Workpool logger funksjonsnavn og id-er, aldri argumenter.
  logLevel: "WARN",
});
