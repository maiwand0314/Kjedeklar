/**
 * Register over alle mutasjoner og om de skriver revisjonslogg (oppgave 05).
 * En mutasjon som ikke står her, får `tests/unit/audit-registry.test.ts` til å
 * feile. Velg `logged` (filen må bruke writeAudit/consumeInvitation) eller
 * `exempt` med en begrunnelse som tåler review.
 */
export type AuditClassification = { logged: true } | { exempt: string };

export const auditedMutations: Record<string, AuditClassification> = {
  "organizations/mutations:rename": { logged: true },
  "invitations/mutations:create": { logged: true },
  "invitations/mutations:revoke": { logged: true },
  "invitations/mutations:acceptAsCurrentUser": { logged: true },
  "invitations/internal:consumeForUser": { logged: true },
  "ops/organizations:createWorkspace": { logged: true },
  "ops/organizations:setMembership": { logged: true },
  "ops/workspaces:provision": { logged: true },
  "ops/testing:auditRollbackProbe": { logged: true },
  "organizations/registry:confirm": { logged: true },
  "organizations/registryInternal:storePreview": {
    exempt: "Lagrer bare en forhåndsvisning av et Brreg-oppslag; ingen kundedata endres før bekreftelse, som logges.",
  },
  "invitations/internal:attachToken": {
    exempt: "Lagrer bare tokenhash ved e-postsending; logges ikke for å holde token unna loggen.",
  },
  "ops/testing:expireInvitation": { exempt: "Testfunksjon, bare på test-backend." },
};
