import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { auditEventTypes, auditEntityTypes, safeDiffValidator } from "./lib/auditTypes";
import {
  applicabilityInputValidator,
  applicabilityResultValidator,
  reasonsValidator,
} from "./organizations/applicabilityValidators";
import { profileAnswerFields } from "./organizations/profileValidators";
import { registryProfileValidator } from "./organizations/registryValidators";
import { importBatchFields, importRowFields } from "./suppliers/import/validators";
import { industryCodeSourceValidator, registryEnrichmentValidator, supplierPeriodFields, supplierProfileFields } from "./suppliers/validators";

// Better Auth-tabellene ligger i komponenten @convex-dev/better-auth, ikke her.
export default defineSchema({
  // Tenantrot. Én juridisk virksomhet per workspace i MVP.
  organizations: defineTable({
    name: v.string(),
    orgNumber: v.optional(v.string()),
    country: v.string(),
    legalForm: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    // Bekreftede registeropplysninger (oppgave 06). Navnet over er
    // visningsnavnet og endres bare når brukeren eksplisitt velger det.
    industryCode: v.optional(v.string()),
    registryProfile: v.optional(registryProfileValidator),
    registrySnapshotId: v.optional(v.id("registrySnapshots")),
    registryConfirmedAt: v.optional(v.number()),
    registryConfirmedBy: v.optional(v.string()),
  }),

  // Minimalt utdrag fra Enhetsregisteret per oppslag. «preview» til brukeren
  // bekrefter; bekreftede snapshots er historikk og endres ikke.
  registrySnapshots: defineTable({
    organizationId: v.id("organizations"),
    source: v.literal("brreg-enhetsregisteret"),
    orgNumber: v.string(),
    fetchedAt: v.number(),
    fetchedBy: v.string(),
    selectedFields: registryProfileValidator,
    sourcePayloadHash: v.string(),
    mappingVersion: v.string(),
    // «fetched»: hentet for en leverandør (oppgave 13). Historikk, endres ikke.
    status: v.union(v.literal("preview"), v.literal("confirmed"), v.literal("fetched")),
    supplierId: v.optional(v.id("suppliers")),
    confirmedAt: v.optional(v.number()),
    confirmedBy: v.optional(v.string()),
  })
    .index("by_organizationId_and_fetchedAt", ["organizationId", "fetchedAt"])
    .index("by_organizationId_and_supplierId_and_fetchedAt", ["organizationId", "supplierId", "fetchedAt"]),

  // Veiledende pliktvurdering (oppgave 07). Ny rad per vurdering; gamle endres
  // aldri. Resultatet er regnet ut på serveren fra input og regelversjon.
  applicabilityAssessments: defineTable({
    organizationId: v.id("organizations"),
    assessedAt: v.number(),
    assessedBy: v.string(),
    ruleVersion: v.string(),
    inputs: applicabilityInputValidator,
    result: applicabilityResultValidator,
    rationale: reasonsValidator,
    userConfirmedAt: v.number(),
  }).index("by_organizationId_and_assessedAt", ["organizationId", "assessedAt"]),

  // Rapportperiode (oppgave 08): eksplisitte datoer `YYYY-MM-DD` og en frist
  // kunden setter selv. Lik start og slutt finnes bare én gang per organisasjon
  // (kontrolleres i mutasjonen). Bare «open» til en oppgave innfører lukking.
  reportingPeriods: defineTable({
    organizationId: v.id("organizations"),
    startDate: v.string(),
    endDate: v.string(),
    publicationDueDate: v.string(),
    status: v.literal("open"),
    createdAt: v.number(),
    createdBy: v.string(),
  }).index("by_organizationId_and_startDate_and_endDate", ["organizationId", "startDate", "endDate"]),

  // Virksomhetsprofil per periode. Ny rad per lagring; gamle versjoner endres
  // aldri. Bekreftelse er intern og ingen underskrift.
  businessProfileRevisions: defineTable({
    organizationId: v.id("organizations"),
    reportingPeriodId: v.id("reportingPeriods"),
    revision: v.number(),
    ...profileAnswerFields,
    createdAt: v.number(),
    createdBy: v.string(),
    confirmedBy: v.optional(v.string()),
    confirmedAt: v.optional(v.number()),
  }).index("by_organizationId_and_reportingPeriodId_and_revision", ["organizationId", "reportingPeriodId", "revision"]),

  // Leverandørprofil (oppgave 09), adskilt fra innkjøpsdata per periode. Norsk
  // org.nr. er unikt per organisasjon når det er satt (kontrolleres i
  // mutasjonen). Arkivering sletter ingenting. `nameKey` er navnet i små
  // bokstaver, for sortering, søk og forslag om mulig duplikat.
  suppliers: defineTable({
    organizationId: v.id("organizations"),
    ...supplierProfileFields,
    nameKey: v.string(),
    // Brreg-beriking (oppgave 13). Rører ikke `rowVersion`: status er ikke en profilendring.
    registryEnrichment: v.optional(registryEnrichmentValidator),
    industryCodeSource: v.optional(industryCodeSourceValidator),
    status: v.union(v.literal("active"), v.literal("archived")),
    archivedAt: v.optional(v.number()),
    rowVersion: v.number(),
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index("by_organizationId_and_registryOrgNumber", ["organizationId", "registryOrgNumber"])
    .index("by_organizationId_and_externalKey", ["organizationId", "externalKey"])
    .index("by_organizationId_and_status_and_nameKey", ["organizationId", "status", "nameKey"]),

  // Innkjøp fra én leverandør i én rapportperiode; én rad per par (kontrolleres
  // i mutasjonen). Manglende `spendOre` er ukjent beløp, `0n` er kjent null.
  supplierPeriods: defineTable({
    organizationId: v.id("organizations"),
    supplierId: v.id("suppliers"),
    reportingPeriodId: v.id("reportingPeriods"),
    ...supplierPeriodFields,
    rowVersion: v.number(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_organizationId_and_supplierId_and_reportingPeriodId", ["organizationId", "supplierId", "reportingPeriodId"]),

  // Importgrunnlag fra en CSV-fil (oppgave 11). Råfilen lagres aldri, bare
  // normaliserte oppføringer. «preparing» til alle oppføringene er lagret, så
  // «draft» mens brukeren velger, «committing» fra bekreftelse til alt er
  // behandlet, og «committed». Ingenting slettes fra appen.
  importBatches: defineTable({ organizationId: v.id("organizations"), ...importBatchFields })
    .index("by_organizationId_and_idempotencyKey", ["organizationId", "idempotencyKey"])
    .index("by_organizationId", ["organizationId"])
    // «period» er reportingPeriodId; Convex tillater indeksnavn på høyst 64 tegn.
    .index("by_organizationId_and_period_and_status_and_committedAt", ["organizationId", "reportingPeriodId", "status", "committedAt"]),

  // Én oppføring per leverandør i filen, med valg og resultat. `rowNumber` er
  // første rad i filen oppføringen bygger på.
  importRows: defineTable({ organizationId: v.id("organizations"), ...importRowFields })
    .index("by_organizationId_and_batchId_and_rowNumber", ["organizationId", "batchId", "rowNumber"])
    .index("by_organizationId_and_batchId_and_kind_and_decision", ["organizationId", "batchId", "kind", "decision"]),

  // Bakgrunnsjobber (oppgave 12). Opprettes av en tenantmutasjon, idempotent på
  // (organisasjon, type, idempotencyKey). Status endres bare av interne
  // funksjoner. `inputRef` er id-en til et dokument i samme organisasjon, i
  // tabellen jobbtypen arbeider på; `runAfter` er tidligste neste forsøk.
  jobs: defineTable({
    organizationId: v.id("organizations"),
    type: v.string(),
    inputRef: v.string(),
    idempotencyKey: v.string(),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("succeeded"), v.literal("failed")),
    attempts: v.number(),
    maxAttempts: v.number(),
    runAfter: v.number(),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_organizationId_and_type_and_idempotencyKey", ["organizationId", "type", "idempotencyKey"])
    .index("by_organizationId", ["organizationId"]),

  memberships: defineTable({
    organizationId: v.id("organizations"),
    // Better Auth-brukerens id (dokument i komponentens user-tabell).
    userId: v.string(),
    role: v.literal("admin"),
    status: v.union(v.literal("active"), v.literal("inactive")),
  })
    .index("by_organizationId_and_userId", ["organizationId", "userId"])
    .index("by_userId", ["userId"]),

  // Engangsinvitasjon til administrator. Råtokenet lagres aldri, bare SHA-256-
  // hashen, og den settes av e-postjobben som lager tokenet.
  invitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(), // normalisert: trimmet og små bokstaver
    tokenHash: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked")),
    expiresAt: v.number(),
    invitedBy: v.optional(v.string()), // mangler ved operatør-bootstrap
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_organizationId_and_email", ["organizationId", "email"])
    .index("by_tokenHash", ["tokenHash"]),

  // Revisjonslogg. Skrives bare via convex/lib/audit.ts, i samme mutasjon som
  // endringen. Ingen funksjon oppdaterer eller sletter (se beslutning 0004).
  auditEvents: defineTable({
    organizationId: v.id("organizations"),
    actorType: v.union(v.literal("user"), v.literal("system")),
    actorId: v.optional(v.string()), // Better Auth-bruker; mangler for system
    eventType: auditEventTypes,
    entityType: auditEntityTypes,
    entityId: v.string(),
    occurredAt: v.number(), // UTC-ms, satt i mutasjonen
    requestId: v.string(),
    safeDiff: safeDiffValidator,
    reason: v.optional(v.string()),
  })
    .index("by_organizationId_and_occurredAt", ["organizationId", "occurredAt"])
    .index("by_organizationId_and_entityType_and_occurredAt", [
      "organizationId",
      "entityType",
      "occurredAt",
    ]),
});
