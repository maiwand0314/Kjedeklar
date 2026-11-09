import { v, type Infer } from "convex/values";

/** Hendelsene som logges. Nye hendelser legges til her. */
export const auditEventTypes = v.union(
  v.literal("organization.provisioned"),
  v.literal("organization.renamed"),
  v.literal("organization.registry_confirmed"),
  v.literal("applicability.assessed"),
  v.literal("membership.created"),
  v.literal("membership.status_changed"),
  v.literal("invitation.created"),
  v.literal("invitation.renewed"),
  v.literal("invitation.revoked"),
  v.literal("invitation.accepted"),
);

export const auditEntityTypes = v.union(
  v.literal("organization"),
  v.literal("membership"),
  v.literal("invitation"),
  v.literal("applicability"),
);

const diffValue = v.union(v.string(), v.number(), v.boolean(), v.null());

/** Feltnavn → før/etter. Bare felter fra tillatelseslisten i audit.ts. */
export const safeDiffValidator = v.record(
  v.string(),
  v.object({ from: v.optional(diffValue), to: v.optional(diffValue) }),
);

export type AuditEventType = Infer<typeof auditEventTypes>;
export type AuditEntityType = Infer<typeof auditEntityTypes>;
export type SafeDiff = Infer<typeof safeDiffValidator>;
