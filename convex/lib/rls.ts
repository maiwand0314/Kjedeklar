/**
 * RLS-regler for den innpakkede `ctx.db` i tenant- og brukerfunksjoner.
 *
 * Default-deny er eksplisitt på to nivåer:
 * 1. Typen `ExhaustiveRules` krever en regel for HVER tabell i skjemaet, med
 *    alle tre operasjoner (read/modify/insert). En ny tabell uten regel gir
 *    typefeil, ikke stille tilgang.
 * 2. `RLS_CONFIG.defaultPolicy = "deny"` avviser kjøretidstilgang til tabeller
 *    uten regel, som en ekstra sikring.
 *
 * Reglene er et vern i applikasjonslaget, ikke radpolicyer i databasen. Interne
 * funksjoner, deploy/admin key og dashboardtilgang går utenom dem.
 * Se docs/decisions/0002-tenant-boundary.md.
 */
import type { Rules } from "convex-helpers/server/rowLevelSecurity";
import type {
  DataModel,
  Doc,
  Id,
  TableNames,
} from "../_generated/dataModel";

/** Reglene trenger ingen egen kontekst; tenant/bruker fanges i closure. */
export type RuleCtx = Record<string, never>;

export const RLS_CONFIG = { defaultPolicy: "deny" } as const;

type TableRule<T extends TableNames> = Required<
  NonNullable<Rules<RuleCtx, DataModel>[T]>
>;

/** Én eksplisitt regel per tabell og operasjon. */
export type ExhaustiveRules = { [T in TableNames]: TableRule<T> };

const deny = async () => false;

/** Konteksten tenantreglene trenger: hvilken organisasjon som er verifisert. */
export type TenantScope = { organizationId: Id<"organizations"> };

/**
 * Regler for tenantfunksjoner (`tenantQuery`/`tenantMutation`).
 *
 * Nye kundetabeller får typisk `sameTenant` for lesing og en bevisst vurdert
 * regel for endring. `memberships` kan bare leses og endres
 * kun via interne funksjoner (bootstrap/invitasjon). `auditEvents` er append-only.
 */
export function tenantRules(scope: TenantScope): ExhaustiveRules {
  const sameTenant = async (
    _ctx: RuleCtx,
    doc: { organizationId: Id<"organizations"> },
  ) => doc.organizationId === scope.organizationId;
  return {
    organizations: {
      read: async (_ctx, doc: Doc<"organizations">) =>
        doc._id === scope.organizationId,
      // Admin kan endre egen organisasjon (f.eks. navn); hvilke felt styres av
      // mutasjonen. Opprettelse skjer bare via operatør-bootstrap.
      modify: async (_ctx, doc: Doc<"organizations">) => doc._id === scope.organizationId,
      insert: deny,
    },
    memberships: { read: sameTenant, modify: deny, insert: deny },
    // Admin inviterer og tilbakekaller i egen organisasjon. Aksept skjer via
    // invitasjonsbyggeklossene, ikke tenantfunksjoner.
    invitations: { read: sameTenant, modify: sameTenant, insert: sameTenant },
    // Append-only: kan leses og legges til i egen organisasjon, aldri endres.
    auditEvents: { read: sameTenant, modify: deny, insert: sameTenant },
    // Opprettes av intern mutasjon etter Brreg-oppslag; admin bekrefter.
    // Bekreftede snapshots er historikk og kan ikke endres.
    registrySnapshots: {
      read: sameTenant,
      modify: async (_ctx, doc) => doc.organizationId === scope.organizationId && doc.status === "preview",
      insert: deny,
    },
    // Ny rad per vurdering; historikk endres aldri.
    applicabilityAssessments: { read: sameTenant, modify: deny, insert: sameTenant },
    // Perioder opprettes av admin og endres ikke fra appen i MVP.
    reportingPeriods: { read: sameTenant, modify: deny, insert: sameTenant },
    // Ny rad per lagring; gamle versjoner endres aldri.
    businessProfileRevisions: { read: sameTenant, modify: deny, insert: sameTenant },
    // Admin oppretter og redigerer i egen organisasjon. Ingen funksjon sletter.
    suppliers: { read: sameTenant, modify: sameTenant, insert: sameTenant },
    supplierPeriods: { read: sameTenant, modify: sameTenant, insert: sameTenant },
    // Grunnlaget lagres av intern mutasjon fra import-actionen. Admin velger og bekrefter i egen organisasjon.
    importBatches: { read: sameTenant, modify: sameTenant, insert: deny },
    importRows: { read: sameTenant, modify: sameTenant, insert: deny },
    // Admin oppretter jobber i egen organisasjon. Status endres bare av interne jobbfunksjoner.
    jobs: { read: sameTenant, modify: deny, insert: sameTenant },
  };
}

/**
 * Regler for brukerfunksjoner uten valgt organisasjon (organisasjonsvelger).
 * Brukeren ser egne medlemskap og organisasjoner med aktivt medlemskap. Ingen
 * skriving.
 */
export function userRules(
  userId: string,
  activeOrganizationIds: ReadonlySet<string>,
): ExhaustiveRules {
  return {
    organizations: {
      read: async (_ctx, doc) => activeOrganizationIds.has(doc._id),
      modify: deny,
      insert: deny,
    },
    memberships: {
      read: async (_ctx, doc) => doc.userId === userId,
      modify: deny,
      insert: deny,
    },
    invitations: { read: deny, modify: deny, insert: deny },
    auditEvents: { read: deny, modify: deny, insert: deny },
    registrySnapshots: { read: deny, modify: deny, insert: deny },
    applicabilityAssessments: { read: deny, modify: deny, insert: deny },
    reportingPeriods: { read: deny, modify: deny, insert: deny },
    businessProfileRevisions: { read: deny, modify: deny, insert: deny },
    suppliers: { read: deny, modify: deny, insert: deny },
    supplierPeriods: { read: deny, modify: deny, insert: deny },
    importBatches: { read: deny, modify: deny, insert: deny },
    importRows: { read: deny, modify: deny, insert: deny },
    jobs: { read: deny, modify: deny, insert: deny },
  };
}

/** Det en verifisert invitasjon gir tilgang til. Se `convex/lib/invitation.ts`. */
export type InvitationScope = {
  invitationId: Id<"invitations">;
  organizationId: Id<"organizations">;
  /** Innlogget bruker som godtar. Mangler for anonym forhåndsvisning. */
  userId?: string;
};

/**
 * Regler for invitasjonsfunksjoner. Tokenet er tilgangsbeviset, og det gir bare
 * tilgang til én invitasjon, dens organisasjon og den aksepterende brukerens
 * eget medlemskap i den organisasjonen. Ingen roller kan velges.
 */
export function invitationRules(scope: InvitationScope): ExhaustiveRules {
  const ownMembership = async (
    _ctx: RuleCtx,
    doc: { organizationId: Id<"organizations">; userId: string },
  ) =>
    scope.userId !== undefined &&
    doc.organizationId === scope.organizationId &&
    doc.userId === scope.userId;
  const thisInvitation = async (_ctx: RuleCtx, doc: Doc<"invitations">) =>
    doc._id === scope.invitationId;
  return {
    organizations: {
      read: async (_ctx, doc) => doc._id === scope.organizationId,
      modify: deny,
      insert: deny,
    },
    memberships: {
      read: ownMembership,
      modify: ownMembership,
      insert: async (ctx, doc) => (await ownMembership(ctx, doc)) && doc.role === "admin",
    },
    invitations: {
      read: thisInvitation,
      modify: async (ctx, doc) => scope.userId !== undefined && (await thisInvitation(ctx, doc)),
      insert: deny,
    },
    // Aksepten logges i invitasjonens organisasjon; ingen lesing eller endring.
    auditEvents: {
      read: deny,
      modify: deny,
      insert: async (_ctx, doc) =>
        scope.userId !== undefined && doc.organizationId === scope.organizationId,
    },
    registrySnapshots: { read: deny, modify: deny, insert: deny },
    applicabilityAssessments: { read: deny, modify: deny, insert: deny },
    reportingPeriods: { read: deny, modify: deny, insert: deny },
    businessProfileRevisions: { read: deny, modify: deny, insert: deny },
    suppliers: { read: deny, modify: deny, insert: deny },
    supplierPeriods: { read: deny, modify: deny, insert: deny },
    importBatches: { read: deny, modify: deny, insert: deny },
    importRows: { read: deny, modify: deny, insert: deny },
    jobs: { read: deny, modify: deny, insert: deny },
  };
}
