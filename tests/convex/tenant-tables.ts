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
import { SYNTHETIC_REGISTRY_PROFILE } from "../helpers/public-functions";

type Owner = { organizationId: Id<"organizations">; userId: string };

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
