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
  "organizations/applicability:assess": { logged: true },
  "organizations/reportingPeriods:create": { logged: true },
  "organizations/businessProfile:save": { logged: true },
  "suppliers/mutations:create": { logged: true },
  "suppliers/mutations:update": { logged: true },
  "suppliers/mutations:setArchived": { logged: true },
  "suppliers/mutations:savePeriod": { logged: true },
  "suppliers/import/batches:startCommit": { logged: true },
  "suppliers/import/batches:commitChunk": { logged: true },
  "suppliers/import/store:finalizeBatch": { logged: true },
  "suppliers/import/batches:setPolicy": {
    exempt: "Fellesvalg i et importutkast; endrer ingen leverandørdata. Valgene som gjaldt, logges når importen bekreftes.",
  },
  "suppliers/import/batches:decide": {
    exempt: "Valg for én oppføring i et importutkast; endrer ingen leverandørdata. Bekreftelsen og gjennomføringen logges.",
  },
  "suppliers/import/store:createBatch": {
    exempt: "Oppretter et grunnlag som ikke er synlig før alle oppføringene er lagret; da logges det (finalizeBatch).",
  },
  "suppliers/import/store:addEntries": {
    exempt: "Lagrer oppføringer i et grunnlag under oppretting; logges samlet når grunnlaget er ferdig (finalizeBatch).",
  },
  "organizations/registryInternal:storePreview": {
    exempt: "Lagrer bare en forhåndsvisning av et Brreg-oppslag; ingen kundedata endres før bekreftelse, som logges.",
  },
  "invitations/internal:attachToken": {
    exempt: "Lagrer bare tokenhash ved e-postsending; logges ikke for å holde token unna loggen.",
  },
  "ops/testing:expireInvitation": { exempt: "Testfunksjon, bare på test-backend." },
  "ops/testing:setImportRowName": { exempt: "Testfunksjon, bare på test-backend." },
};
