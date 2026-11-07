import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { auditEventTypes, auditEntityTypes, safeDiffValidator } from "./lib/auditTypes";

// Better Auth-tabellene ligger i komponenten @convex-dev/better-auth, ikke her.
export default defineSchema({
  // Tenantrot. Én juridisk virksomhet per workspace i MVP.
  organizations: defineTable({
    name: v.string(),
    orgNumber: v.optional(v.string()),
    country: v.string(),
    legalForm: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
  }),

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
