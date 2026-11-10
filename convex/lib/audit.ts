/**
 * Revisjonslogg. `writeAudit` skrives med samme `ctx.db` som endringen, altså i
 * samme Convex-mutasjon: kaster loggingen, rulles hele mutasjonen tilbake.
 *
 * Diff tas bare fra en eksplisitt tillatelsesliste per objekttype. Aldri
 * passord, token, tokenhash, e-postadresser eller fritekst med persondata.
 *
 * Append-only i applikasjonen: ingen funksjon oppdaterer eller sletter
 * `auditEvents`, og RLS-reglene nekter endring. Deploy/admin key og
 * Convex-dashboardet kan likevel omgå dette (beslutning 0004).
 */
import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import type { AuditEntityType, AuditEventType, SafeDiff } from "./auditTypes";

/** Felter som kan stå i diff, per objekttype. Alt annet utelates. */
export const AUDIT_DIFF_FIELDS: Record<AuditEntityType, readonly string[]> = {
  organization: ["name", "status", "orgNumber", "legalForm", "industryCode"],
  membership: ["role", "status"],
  invitation: ["status", "expiresAt"],
  applicability: ["result", "ruleVersion"],
  reportingPeriod: ["startDate", "endDate", "publicationDueDate", "status"],
  // Versjon, bekreftelse og status per tema. Selve svarteksten logges aldri.
  businessProfile: [
    "revision", "confirmed", "organizationDescription", "operations", "countries", "responsibility",
    "policies", "routines", "stakeholderDialogue", "remediationProcess",
  ],
  supplier: ["name", "registryOrgNumber", "externalKey", "registeredCountry", "industryCodeSystem", "industryCode", "status"],
  // Beløp som tekst i øre og land som kommaseparerte koder. Kjøpsbeskrivelsen (fritekst) logges aldri.
  supplierPeriod: ["spendOre", "purchaseCategory", "productionCountries", "upstreamUnknown"],
};

type DiffValue = string | number | boolean | null;
type Snapshot = Record<string, unknown> | null | undefined;

function asDiffValue(value: unknown): DiffValue | undefined {
  if (value === undefined) return undefined;
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value as DiffValue;
  return undefined; // objekter/lister logges ikke
}

/** Endrede, tillatte felter mellom før og etter. */
export function safeDiff(entityType: AuditEntityType, before: Snapshot, after: Snapshot): SafeDiff {
  const diff: SafeDiff = {};
  for (const field of AUDIT_DIFF_FIELDS[entityType]) {
    const from = asDiffValue(before?.[field]);
    const to = asDiffValue(after?.[field]);
    if (from === to) continue;
    diff[field] = { ...(from !== undefined && { from }), ...(to !== undefined && { to }) };
  }
  return diff;
}

export type AuditActor = { type: "user"; id: string } | { type: "system" };

export type AuditInput = {
  organizationId: Id<"organizations">;
  actor: AuditActor;
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  before?: Snapshot;
  after?: Snapshot;
  reason?: string;
};

export async function writeAudit(
  ctx: { db: GenericDatabaseWriter<DataModel> },
  input: AuditInput,
): Promise<Id<"auditEvents">> {
  return await ctx.db.insert("auditEvents", {
    organizationId: input.organizationId,
    actorType: input.actor.type,
    ...(input.actor.type === "user" && { actorId: input.actor.id }),
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    occurredAt: Date.now(),
    // Convex gir ikke funksjoner en forespørsels-id; én per hendelse for feilsøking.
    requestId: crypto.randomUUID(),
    safeDiff: safeDiff(input.entityType, input.before, input.after),
    ...(input.reason !== undefined && { reason: input.reason }),
  });
}
