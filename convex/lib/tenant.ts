/**
 * Tenant-byggeklosser. ALLE offentlige Convex-funksjoner som berører kundedata
 * skal lages med disse, ikke med rå `query`/`mutation`/`action` (ESLint håndhever).
 *
 * Kjeden er alltid: verifisert Better Auth-sesjon → aktivt medlemskap i
 * organisasjonen → aktiv organisasjon → rolle → `ctx.tenant`. Organisasjons-id
 * fra klienten (URL, cookie, argument) er bare en kandidat. `ctx.db` erstattes
 * med en innpakket versjon med reglene i `./rls.ts` (default-deny).
 *
 * Begrensning: Convex har ikke radpolicyer i databasen. Interne funksjoner,
 * deploy/admin key og dashboardtilgang går utenom dette vernet.
 * Se docs/decisions/0002-tenant-boundary.md.
 */
import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
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
import { RLS_CONFIG, tenantRules, userRules } from "./rls";

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

/** Roller som får lese kundedata. Kun `admin` i MVP; utvid når nye roller innføres. */
const READ_ROLES: readonly Role[] = ["admin"];
/** Roller som får endre kundedata. Kun `admin` i MVP. */
const WRITE_ROLES: readonly Role[] = ["admin"];

/**
 * Henter verifisert bruker-id fra Better Auth-sesjonen via komponentens API, eller
 * kaster. Appens kode leser aldri Better Auth-tabellene direkte.
 */
export async function requireUserId(ctx: QueryCtx): Promise<string> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw unauthenticated();
  return user._id;
}

/**
 * Verifiserer aktivt medlemskap i en aktiv organisasjon. Kandidaten kan være en
 * hvilken som helst streng: ugyldig format, id fra en annen tabell, slettet,
 * ukjent, fremmed og inaktiv organisasjon gir alle samme NOT_FOUND, så verken
 * data eller eksistens røpes.
 */
export async function resolveTenant(
  ctx: QueryCtx,
  candidateOrganizationId: string,
  allowedRoles: readonly Role[],
): Promise<Tenant> {
  const userId = await requireUserId(ctx);
  const organizationId = ctx.db.normalizeId(
    "organizations",
    candidateOrganizationId,
  );
  if (!organizationId) throw notFound();
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
 * Organisasjonskandidaten tas imot som streng, ikke `v.id(...)`. Da gir et
 * ugyldig format samme nøytrale NOT_FOUND som en fremmed organisasjon, i stedet
 * for en valideringsfeil som skiller seg ut.
 */
const tenantArgs = { organizationId: v.string() };

/** Lesing av kundedata. */
export async function tenantQueryInput(
  ctx: QueryCtx,
  { organizationId }: { organizationId: string },
) {
  const tenant = await resolveTenant(ctx, organizationId, READ_ROLES);
  const db = wrapDatabaseReader({}, ctx.db, tenantRules(tenant), RLS_CONFIG);
  return { ctx: { tenant, db }, args: {} };
}

export const tenantQuery = customQuery(query, {
  args: tenantArgs,
  input: tenantQueryInput,
});

/** Endring av kundedata. Bare redigerende roller. */
export async function tenantMutationInput(
  ctx: MutationCtx,
  { organizationId }: { organizationId: string },
) {
  const tenant = await resolveTenant(ctx, organizationId, WRITE_ROLES);
  const db = wrapDatabaseWriter({}, ctx.db, tenantRules(tenant), RLS_CONFIG);
  return { ctx: { tenant, db }, args: {} };
}

export const tenantMutation = customMutation(mutation, {
  args: tenantArgs,
  input: tenantMutationInput,
});

/** Innlogget bruker uten valgt organisasjon. Ser bare egne medlemskap. */
export async function userQueryInput(ctx: QueryCtx) {
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
}

export const userQuery = customQuery(query, {
  args: {},
  input: userQueryInput,
});

/**
 * Laster et kundeeid dokument og kontrollerer at det tilhører gjeldende tenant.
 * Erstatter sammensatte fremmednøkler: bruk for hver id som kommer inn som
 * argument eller skal lagres som referanse. Ugyldig format, id fra en annen
 * tabell, slettet og fremmed dokument gir samme NOT_FOUND.
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
