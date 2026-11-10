import { normalizeSupplier } from "../../src/domain/suppliers/supplier";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { appError } from "../lib/errors";
import type { Tenant } from "../lib/tenant";

type Ctx = { db: QueryCtx["db"]; tenant: Tenant };

/**
 * Validerer profilen og kontrollerer at norsk org.nr. og egen leverandør-ID ikke
 * allerede er brukt av en annen leverandør i organisasjonen (også arkiverte).
 * Brukes av manuell registrering og av importen, så reglene er de samme. Likt
 * navn stopper ingenting; det vises bare som forslag om mulig duplikat.
 */
export async function checkedProfile(ctx: Ctx, args: Parameters<typeof normalizeSupplier>[0], self?: Id<"suppliers">) {
  const parsed = normalizeSupplier(args);
  if ("errors" in parsed) throw appError("INVALID_INPUT");
  const { organizationId } = ctx.tenant;
  const { registryOrgNumber, externalKey } = parsed.value;
  if (registryOrgNumber) {
    const existing = await ctx.db
      .query("suppliers")
      .withIndex("by_organizationId_and_registryOrgNumber", (q) => q.eq("organizationId", organizationId).eq("registryOrgNumber", registryOrgNumber))
      .first();
    if (existing && existing._id !== self) throw appError("SUPPLIER_EXISTS");
  }
  if (externalKey) {
    // To om gangen, så en eldre dublett ikke hindrer leverandøren i å beholde sin egen ID.
    const existing = await ctx.db
      .query("suppliers")
      .withIndex("by_organizationId_and_externalKey", (q) => q.eq("organizationId", organizationId).eq("externalKey", externalKey))
      .take(2);
    if (existing.some((s) => s._id !== self)) throw appError("SUPPLIER_KEY_EXISTS");
  }
  return parsed.value;
}

/** Innkjøpsdata for én leverandør i én periode, eller null. Høyst én rad per par. */
export function periodRow(ctx: Ctx, supplierId: Id<"suppliers">, reportingPeriodId: Id<"reportingPeriods">) {
  return ctx.db
    .query("supplierPeriods")
    .withIndex("by_organizationId_and_supplierId_and_reportingPeriodId", (q) =>
      q.eq("organizationId", ctx.tenant.organizationId).eq("supplierId", supplierId).eq("reportingPeriodId", reportingPeriodId),
    )
    .unique();
}
