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
 * regel for endring. `organizations` og `memberships` kan bare leses: de endres
 * kun via interne funksjoner (bootstrap/invitasjon).
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
      modify: deny,
      insert: deny,
    },
    memberships: { read: sameTenant, modify: deny, insert: deny },
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
  };
}
