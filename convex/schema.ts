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
    status: v.union(v.literal("preview"), v.literal("confirmed")),
    confirmedAt: v.optional(v.number()),
    confirmedBy: v.optional(v.string()),
  }).index("by_organizationId_and_fetchedAt", ["organizationId", "fetchedAt"]),

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
