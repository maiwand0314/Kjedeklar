import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
});
