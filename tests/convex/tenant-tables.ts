/**
 * Sjekkliste for kundetabeller, som kjørbar testhjelper.
 *
 * Typen `{ [T in TenantTable]: ... }` krever en oppføring for HVER tabell med
 * `organizationId`. En ny kundetabell gir derfor typefeil til den er lagt inn
 * her, og da kjører `references.test.ts` standardtilfellene for referansemisbruk
 * automatisk:
 *
 * - `getOwned` godtar eget dokument og avviser fremmed, slettet, ugyldig id og
 *   id fra en annen tabell med samme NOT_FOUND
 * - innpakket lesing skjuler fremmede dokumenter, både via `get` og `query`
 * - innpakket skriving nekter å endre, slette, erstatte eller opprette
 *   dokumenter i en annen organisasjon
 * - egne dokumenter kan bare endres/opprettes der tabellen eksplisitt tillater det
 *
 * Se også sjekklisten i docs/decisions/0002-tenant-boundary.md.
 */
import type { GenericDatabaseWriter, WithoutSystemFields } from "convex/server";
import type { DataModel, Doc, Id } from "../../convex/_generated/dataModel";
import type { TenantTable } from "../../convex/lib/tenant";
import {
  SYNTHETIC_APPLICABILITY_INPUT,
  SYNTHETIC_IMPORT_BATCH,
  SYNTHETIC_IMPORT_ROW,
  SYNTHETIC_PERIOD,
  SYNTHETIC_PROFILE_ANSWERS,
  SYNTHETIC_REGISTRY_PROFILE,
  SYNTHETIC_SUPPLIER_DOC,
} from "../helpers/public-functions";

/** `reportingPeriodId` og `supplierId` er dokumenter i samme organisasjon, for tabeller som peker på dem. */
export type Owner = {
  organizationId: Id<"organizations">;
  userId: string;
  reportingPeriodId: Id<"reportingPeriods">;
  supplierId: Id<"suppliers">;
  importBatchId: Id<"importBatches">;
};

export type TenantTableCase<T extends TenantTable> = {
  /** Et gyldig nytt dokument i organisasjonen. */
  newDoc: (owner: Owner) => WithoutSystemFields<Doc<T>>;
  /** Et gyldig felt-sett for endringsforsøk. */
  patch: Partial<WithoutSystemFields<Doc<T>>>;
  /** Kan tenantfunksjoner endre egne dokumenter i tabellen? */
  tenantCanModifyOwn: boolean;
  /** Kan tenantfunksjoner opprette dokumenter i egen organisasjon? */
  tenantCanInsertOwn: boolean;
};

export const tenantTableCases: { [T in TenantTable]: TenantTableCase<T> } = {
  memberships: {
    newDoc: ({ organizationId, userId }) => ({
      organizationId,
      userId,
      role: "admin",
      status: "active",
    }),
    patch: { status: "inactive" },
    // Medlemskap og roller endres bare via interne funksjoner.
    tenantCanModifyOwn: false,
    tenantCanInsertOwn: false,
  },
  invitations: {
    newDoc: ({ organizationId, userId }) => ({
      organizationId,
      email: "ny@tenant.example",
      status: "pending",
      expiresAt: Date.now() + 60_000,
      invitedBy: userId,
    }),
    patch: { status: "revoked" },
    // Admin inviterer og tilbakekaller i egen organisasjon.
    tenantCanModifyOwn: true,
    tenantCanInsertOwn: true,
  },
  applicabilityAssessments: {
    newDoc: ({ organizationId, userId }) => ({
      organizationId,
      assessedAt: Date.now(),
      assessedBy: userId,
      ruleVersion: "apenhetsloven-3a-2024-11-01-v1",
      inputs: SYNTHETIC_APPLICABILITY_INPUT,
      result: "likely_in",
      rationale: [{ code: "exceeds_two_years", text: "Syntetisk" }],
      userConfirmedAt: Date.now(),
    }),
    patch: { result: "likely_out" },
    // Ny rad per vurdering; historikk endres aldri.
    tenantCanModifyOwn: false,
    tenantCanInsertOwn: true,
  },
  reportingPeriods: {
    newDoc: ({ organizationId, userId }) => ({
      organizationId,
      ...SYNTHETIC_PERIOD,
      status: "open",
      createdAt: Date.now(),
      createdBy: userId,
    }),
    patch: { publicationDueDate: "2027-06-30" },
    // Opprettes av admin; endres eller slettes ikke fra appen i MVP.
    tenantCanModifyOwn: false,
    tenantCanInsertOwn: true,
  },
  businessProfileRevisions: {
    newDoc: ({ organizationId, userId, reportingPeriodId }) => ({
      organizationId,
      reportingPeriodId,
      revision: 1,
      ...SYNTHETIC_PROFILE_ANSWERS,
      createdAt: Date.now(),
      createdBy: userId,
    }),
    patch: { revision: 2 },
    // Ny rad per lagring; versjoner endres aldri.
    tenantCanModifyOwn: false,
    tenantCanInsertOwn: true,
  },
  suppliers: {
    newDoc: ({ organizationId, userId }) => ({ organizationId, ...SYNTHETIC_SUPPLIER_DOC, createdAt: Date.now(), createdBy: userId }),
    patch: { name: "Kapret AS" },
    // Admin oppretter, endrer og arkiverer i egen organisasjon.
    tenantCanModifyOwn: true,
    tenantCanInsertOwn: true,
  },
  supplierPeriods: {
    newDoc: ({ organizationId, userId, reportingPeriodId, supplierId }) => ({
      organizationId,
      supplierId,
      reportingPeriodId,
      productionCountries: [],
      upstreamUnknown: true,
      rowVersion: 1,
      updatedAt: Date.now(),
      updatedBy: userId,
    }),
    patch: { upstreamUnknown: false },
    // Admin lagrer innkjøpsdata i egen organisasjon.
    tenantCanModifyOwn: true,
    tenantCanInsertOwn: true,
  },
  importBatches: {
    newDoc: ({ organizationId, userId, reportingPeriodId }) => ({
      organizationId,
      reportingPeriodId,
      ...SYNTHETIC_IMPORT_BATCH,
      createdAt: Date.now(),
      createdBy: userId,
      expiresAt: Date.now() + 3_600_000,
    }),
    patch: { policy: { known: "skip" } },
    // Admin velger og bekrefter; grunnlaget opprettes bare av intern mutasjon fra import-actionen.
    tenantCanModifyOwn: true,
    tenantCanInsertOwn: false,
  },
  importRows: {
    newDoc: ({ organizationId, importBatchId }) => ({ organizationId, batchId: importBatchId, ...SYNTHETIC_IMPORT_ROW }),
    patch: { decision: "skip" },
    tenantCanModifyOwn: true,
    tenantCanInsertOwn: false,
  },
  registrySnapshots: {
    newDoc: ({ organizationId, userId }) => ({
      organizationId,
      source: "brreg-enhetsregisteret",
      orgNumber: "920000002",
      fetchedAt: Date.now(),
      fetchedBy: userId,
      selectedFields: SYNTHETIC_REGISTRY_PROFILE,
      sourcePayloadHash: "0".repeat(64),
      mappingVersion: "brreg-enhet-v1",
      status: "preview",
    }),
    patch: { status: "confirmed" },
    // Bekreftes av admin; opprettes bare av intern mutasjon etter oppslag.
    tenantCanModifyOwn: true,
    tenantCanInsertOwn: false,
  },
  auditEvents: {
    newDoc: ({ organizationId, userId }) => ({
      organizationId,
      actorType: "user",
      actorId: userId,
      eventType: "organization.renamed",
      entityType: "organization",
      entityId: organizationId,
      occurredAt: Date.now(),
      requestId: "test",
      safeDiff: {},
    }),
    patch: { reason: "omskrevet" },
    // Append-only: kan legges til, aldri endres eller slettes.
    tenantCanModifyOwn: false,
    tenantCanInsertOwn: true,
  },
};

/** Setter inn et testdokument med rå db (testoppsett, ikke tenantfunksjon). */
export async function insertRaw<T extends TenantTable>(
  db: GenericDatabaseWriter<DataModel>,
  table: T,
  owner: Owner,
): Promise<Id<T>> {
  const c = tenantTableCases[table] as TenantTableCase<T>;
  // convex-test sin db er typet generisk; dokumentet er validert av typen over.
  return (await db.insert(table, c.newDoc(owner) as never)) as Id<T>;
}
