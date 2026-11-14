import { v } from "convex/values";
import { nameKey, normalizeSupplierPeriod, type SupplierPeriodData } from "../../src/domain/suppliers/supplier";
import { writeAudit } from "../lib/audit";
import { appError } from "../lib/errors";
import { getOwned, tenantMutation } from "../lib/tenant";
import { checkedProfile } from "./model";
import { supplierPeriodFields, supplierProfileFields } from "./validators";

/** Valgfrie felt som fjernes når de ikke lenger er oppgitt (patch med undefined sletter feltet). */
const CLEARED_PROFILE = {
  registryOrgNumber: undefined,
  externalKey: undefined,
  registeredCountry: undefined,
  industryCodeSystem: undefined,
  industryCode: undefined,
};
const CLEARED_PERIOD = { spendOre: undefined, purchaseCategory: undefined, purchaseDescription: undefined };

/** Det som kan stå i revisjonsloggen om innkjøpsdata. Kjøpsbeskrivelsen (fritekst) er ikke med. */
const periodSnapshot = (data: SupplierPeriodData) => ({
  spendOre: data.spendOre?.toString(),
  purchaseCategory: data.purchaseCategory,
  productionCountries: data.productionCountries.join(", ") || undefined,
  upstreamUnknown: data.upstreamUnknown,
});

export const create = tenantMutation({
  args: supplierProfileFields,
  returns: v.id("suppliers"),
  handler: async (ctx, args) => {
    const { organizationId, userId } = ctx.tenant;
    const profile = await checkedProfile(ctx, args);
    const doc = {
      organizationId,
      ...profile,
      nameKey: nameKey(profile.name),
      status: "active" as const,
      rowVersion: 1,
      createdAt: Date.now(),
      createdBy: userId,
    };
    const supplierId = await ctx.db.insert("suppliers", doc);
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "user", id: userId },
      eventType: "supplier.created",
      entityType: "supplier",
      entityId: supplierId,
      after: doc,
    });
    return supplierId;
  },
});

/** Endrer profilen. `expectedRowVersion` er versjonen brukeren så; er den utdatert, avvises endringen. */
export const update = tenantMutation({
  args: { supplierId: v.string(), expectedRowVersion: v.number(), ...supplierProfileFields },
  returns: v.object({ rowVersion: v.number() }),
  handler: async (ctx, { supplierId, expectedRowVersion, ...args }) => {
    const { organizationId, userId } = ctx.tenant;
    const supplier = await getOwned(ctx, "suppliers", supplierId);
    if (supplier.rowVersion !== expectedRowVersion) throw appError("CONFLICT");
    const profile = await checkedProfile(ctx, args, supplier._id);
    // En næringskode endret for hånd stammer ikke lenger fra registersvaret.
    const industryEdited = profile.industryCode !== supplier.industryCode || profile.industryCodeSystem !== supplier.industryCodeSystem;
    const changes = {
      ...CLEARED_PROFILE,
      ...profile,
      ...(industryEdited && { industryCodeSource: undefined }),
      nameKey: nameKey(profile.name),
      rowVersion: supplier.rowVersion + 1,
    };
    await ctx.db.patch("suppliers", supplier._id, changes);
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "user", id: userId },
      eventType: "supplier.updated",
      entityType: "supplier",
      entityId: supplier._id,
      before: supplier,
      after: { ...supplier, ...changes },
    });
    return { rowVersion: changes.rowVersion };
  },
});

/**
 * Arkiverer eller gjenoppretter. Ingenting slettes: profil, innkjøpsdata og logg blir stående.
 * Status rører ingen profilfelt, så `rowVersion` økes ikke; ellers ville et åpent profilskjema få falsk konflikt.
 */
export const setArchived = tenantMutation({
  args: { supplierId: v.string(), expectedRowVersion: v.number(), archived: v.boolean() },
  returns: v.object({ rowVersion: v.number() }),
  handler: async (ctx, { supplierId, expectedRowVersion, archived }) => {
    const { organizationId, userId } = ctx.tenant;
    const supplier = await getOwned(ctx, "suppliers", supplierId);
    if (supplier.rowVersion !== expectedRowVersion) throw appError("CONFLICT");
    const status = archived ? ("archived" as const) : ("active" as const);
    if (supplier.status === status) return { rowVersion: supplier.rowVersion };
    const changes = { status, archivedAt: archived ? Date.now() : undefined };
    await ctx.db.patch("suppliers", supplier._id, changes);
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "user", id: userId },
      eventType: archived ? "supplier.archived" : "supplier.restored",
      entityType: "supplier",
      entityId: supplier._id,
      before: supplier,
      after: { ...supplier, ...changes },
    });
    return { rowVersion: supplier.rowVersion };
  },
});

/**
 * Lagrer innkjøpsdata for én leverandør i én rapportperiode; begge lastes med
 * getOwned. Det finnes høyst én rad per par. `expectedRowVersion` er 0 når
 * ingen rad finnes ennå.
 */
export const savePeriod = tenantMutation({
  args: { supplierId: v.string(), reportingPeriodId: v.string(), expectedRowVersion: v.number(), ...supplierPeriodFields },
  returns: v.object({ supplierPeriodId: v.id("supplierPeriods"), rowVersion: v.number() }),
  handler: async (ctx, { supplierId, reportingPeriodId, expectedRowVersion, ...args }) => {
    const { organizationId, userId } = ctx.tenant;
    const supplier = await getOwned(ctx, "suppliers", supplierId);
    const period = await getOwned(ctx, "reportingPeriods", reportingPeriodId);
    const parsed = normalizeSupplierPeriod(args);
    if ("errors" in parsed) throw appError("INVALID_INPUT");
    const existing = await ctx.db
      .query("supplierPeriods")
      .withIndex("by_organizationId_and_supplierId_and_reportingPeriodId", (q) =>
        q.eq("organizationId", organizationId).eq("supplierId", supplier._id).eq("reportingPeriodId", period._id),
      )
      .unique();
    if ((existing?.rowVersion ?? 0) !== expectedRowVersion) throw appError("CONFLICT");
    const meta = { rowVersion: expectedRowVersion + 1, updatedAt: Date.now(), updatedBy: userId };
    let supplierPeriodId = existing?._id;
    if (supplierPeriodId) {
      await ctx.db.patch("supplierPeriods", supplierPeriodId, { ...CLEARED_PERIOD, ...parsed.value, ...meta });
    } else {
      supplierPeriodId = await ctx.db.insert("supplierPeriods", {
        organizationId,
        supplierId: supplier._id,
        reportingPeriodId: period._id,
        ...parsed.value,
        ...meta,
      });
    }
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "user", id: userId },
      eventType: "supplier_period.saved",
      entityType: "supplierPeriod",
      entityId: supplierPeriodId,
      before: existing && periodSnapshot(existing),
      after: periodSnapshot(parsed.value),
    });
    return { supplierPeriodId, rowVersion: meta.rowVersion };
  },
});
