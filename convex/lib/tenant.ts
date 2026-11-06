/**
 * Tenant-byggeklosser. ALLE offentlige Convex-funksjoner som berører kundedata
 * skal lages med disse, ikke med rå `query`/`mutation`/`action` (ESLint håndhever).
 *
 * Kjeden er alltid: verifisert Better Auth-sesjon → aktivt medlemskap i
 * organisasjonen → rolle → `ctx.tenant`. Organisasjons-id fra klienten er bare en
 * kandidat. `ctx.db` erstattes med en innpakket versjon (RLS-hjelper fra
 * convex-helpers) som avviser dokumenter fra andre organisasjoner, med
 * default-deny for tabeller uten regel.
 *
 * Begrensning: Convex har ikke radpolicyer i databasen. Interne funksjoner,
 * deploy/admin key og dashboardtilgang går utenom dette vernet.
 */
import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  type Rules,
  wrapDatabaseReader,
  wrapDatabaseWriter,
} from "convex-helpers/server/rowLevelSecurity";
import type { GenericDatabaseReader } from "convex/server";
import { v } from "convex/values";
import type { DataModel, Doc, Id, TableNames } from "../_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { authComponent } from "../auth";
import { appError, notFound, unauthenticated } from "./errors";

export type Role = Doc<"memberships">["role"];

export type Tenant = {
  organizationId: Id<"organizations">;
  userId: string;
  role: Role;
  membershipId: Id<"memberships">;
};

/** Tabeller som eies av en tenant, dvs. har `organizationId`. */
export type TenantTable = {
  [T in TableNames]: Doc<T> extends { organizationId: Id<"organizations"> }
    ? T
    : never;
}[TableNames];

type RuleCtx = Record<string, never>;
const RLS_CONFIG = { defaultPolicy: "deny" } as const;
const deny = async () => false;

/** Henter verifisert bruker-id fra Better Auth-sesjonen, eller kaster. */
export async function requireUserId(ctx: QueryCtx): Promise<string> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw unauthenticated();
  return user._id;
}

/**
 * Verifiserer aktivt medlemskap i en aktiv organisasjon. Ukjent, fremmed og
 * inaktiv organisasjon gir samme NOT_FOUND, så eksistens ikke røpes.
 */
export async function resolveTenant(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  allowedRoles: readonly Role[],
): Promise<Tenant> {
  const userId = await requireUserId(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_organizationId_and_userId", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId),
    )
    .unique();
  if (!membership || membership.status !== "active") throw notFound();
  const organization = await ctx.db.get("organizations", organizationId);
  if (!organization || organization.status !== "active") throw notFound();
  if (!allowedRoles.includes(membership.role)) throw appError("FORBIDDEN");
  return {
    organizationId,
    userId,
    role: membership.role,
    membershipId: membership._id,
  };
}

/**
 * RLS-regler for tenantfunksjoner. Nye kundetabeller MÅ få en regel her
 * (typisk `sameTenant`), ellers nektes all tilgang (default-deny).
 * Medlemskap og organisasjoner kan ikke endres fra tenantfunksjoner; det skjer
 * bare via interne funksjoner (bootstrap/invitasjon).
 */
export function tenantRules(tenant: Tenant): Rules<RuleCtx, DataModel> {
  const sameTenant = async (
    _ctx: RuleCtx,
    doc: { organizationId: Id<"organizations"> },
  ) => doc.organizationId === tenant.organizationId;
  return {
    organizations: {
      read: async (_ctx, doc) => doc._id === tenant.organizationId,
      modify: deny,
      insert: deny,
    },
    memberships: { read: sameTenant, modify: deny, insert: deny },
  };
}

/** Regler for brukerfunksjoner uten valgt organisasjon (f.eks. organisasjonsvelger). */
function userRules(
  userId: string,
  activeOrganizationIds: ReadonlySet<string>,
): Rules<RuleCtx, DataModel> {
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

const tenantArgs = { organizationId: v.id("organizations") };

/** Lesing av kundedata. Tillatte roller: kun `admin` i MVP; utvid listen når nye roller innføres. */
export async function tenantQueryInput(
  ctx: QueryCtx,
  { organizationId }: { organizationId: Id<"organizations"> },
) {
  const tenant = await resolveTenant(ctx, organizationId, ["admin"]);
  const db = wrapDatabaseReader({}, ctx.db, tenantRules(tenant), RLS_CONFIG);
  return { ctx: { tenant, db }, args: {} };
}

export const tenantQuery = customQuery(query, {
  args: tenantArgs,
  input: tenantQueryInput,
});

/** Endring av kundedata. Bare redigerende roller (kun `admin` i MVP). */
export async function tenantMutationInput(
  ctx: MutationCtx,
  { organizationId }: { organizationId: Id<"organizations"> },
) {
  const tenant = await resolveTenant(ctx, organizationId, ["admin"]);
  const db = wrapDatabaseWriter({}, ctx.db, tenantRules(tenant), RLS_CONFIG);
  return { ctx: { tenant, db }, args: {} };
}

export const tenantMutation = customMutation(mutation, {
  args: tenantArgs,
  input: tenantMutationInput,
});

/** Innlogget bruker uten valgt organisasjon. Ser bare egne medlemskap. */
export const userQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const userId = await requireUserId(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const active = new Set<string>(
      memberships
        .filter((m) => m.status === "active")
        .map((m) => m.organizationId),
    );
    const db = wrapDatabaseReader(
      {},
      ctx.db,
      userRules(userId, active),
      RLS_CONFIG,
    );
    return { ctx: { userId, db }, args: {} };
  },
});

/**
 * Laster et kundeeid dokument og kontrollerer at det tilhører gjeldende tenant.
 * Erstatter sammensatte fremmednøkler: bruk for hver id som kommer inn som
 * argument eller skal lagres som referanse.
 */
export async function getOwned<T extends TenantTable>(
  ctx: { db: GenericDatabaseReader<DataModel>; tenant: Tenant },
  table: T,
  id: string,
): Promise<Doc<T>> {
  const normalized = ctx.db.normalizeId(table, id);
  if (!normalized) throw notFound();
  const doc = (await ctx.db.get(table, normalized)) as Doc<T> | null;
  if (
    !doc ||
    (doc as unknown as { organizationId: Id<"organizations"> }).organizationId !==
      ctx.tenant.organizationId
  ) {
    throw notFound();
  }
  return doc;
}
