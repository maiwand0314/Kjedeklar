import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { nameKey } from "../../src/domain/suppliers/supplier";
import { getOwned, tenantQuery } from "../lib/tenant";
import { supplierPeriodFields, supplierProfileFields } from "./validators";

/**
 * Leverandører i valgt organisasjon, sortert på navn og paginert. Aktive som
 * standard; `archived` gir de arkiverte. `search` treffer starten av navnet.
 */
export const list = tenantQuery({
  args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()), archived: v.optional(v.boolean()) },
  returns: v.object({
    page: v.array(
      v.object({
        id: v.id("suppliers"),
        name: v.string(),
        registryOrgNumber: v.optional(v.string()),
        registeredCountry: v.optional(v.string()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { paginationOpts, search, archived }) => {
    const organizationId = ctx.tenant.organizationId;
    const prefix = nameKey(search ?? "");
    const result = await ctx.db
      .query("suppliers")
      .withIndex("by_organizationId_and_status_and_nameKey", (q) => {
        const scoped = q.eq("organizationId", organizationId).eq("status", archived ? "archived" : "active");
        // shortcut: treffer bare starten av navnet, bytt til søkeindeks når kundene trenger treff midt i navnet.
        return prefix ? scoped.gte("nameKey", prefix).lt("nameKey", `${prefix}￿`) : scoped;
      })
      .paginate(paginationOpts);
    return {
      page: result.page.map((s) => ({
        id: s._id,
        name: s.name,
        registryOrgNumber: s.registryOrgNumber,
        registeredCountry: s.registeredCountry,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * Én leverandør: profilen, innkjøpsdata for valgt periode (om de finnes) og
 * andre aktive leverandører med samme navn, som forslag om mulig duplikat.
 */
export const get = tenantQuery({
  args: { supplierId: v.string(), reportingPeriodId: v.optional(v.string()) },
  returns: v.object({
    supplier: v.object({
      id: v.id("suppliers"),
      ...supplierProfileFields,
      status: v.union(v.literal("active"), v.literal("archived")),
      rowVersion: v.number(),
    }),
    periodData: v.union(v.null(), v.object({ ...supplierPeriodFields, rowVersion: v.number() })),
    sameName: v.array(v.object({ id: v.id("suppliers"), name: v.string() })),
  }),
  handler: async (ctx, { supplierId, reportingPeriodId }) => {
    const organizationId = ctx.tenant.organizationId;
    const supplier = await getOwned(ctx, "suppliers", supplierId);
    const period = reportingPeriodId === undefined ? null : await getOwned(ctx, "reportingPeriods", reportingPeriodId);
    const row =
      period &&
      (await ctx.db
        .query("supplierPeriods")
        .withIndex("by_organizationId_and_supplierId_and_reportingPeriodId", (q) =>
          q.eq("organizationId", organizationId).eq("supplierId", supplier._id).eq("reportingPeriodId", period._id),
        )
        .unique());
    // shortcut: bare helt like navn (uten hensyn til store bokstaver), utvid når importen trenger bedre forslag.
    const sameName = await ctx.db
      .query("suppliers")
      .withIndex("by_organizationId_and_status_and_nameKey", (q) =>
        q.eq("organizationId", organizationId).eq("status", "active").eq("nameKey", supplier.nameKey),
      )
      .take(6);
    return {
      supplier: {
        id: supplier._id,
        name: supplier.name,
        registryOrgNumber: supplier.registryOrgNumber,
        externalKey: supplier.externalKey,
        registeredCountry: supplier.registeredCountry,
        industryCodeSystem: supplier.industryCodeSystem,
        industryCode: supplier.industryCode,
        status: supplier.status,
        rowVersion: supplier.rowVersion,
      },
      periodData: row
        ? {
            spendOre: row.spendOre,
            purchaseCategory: row.purchaseCategory,
            purchaseDescription: row.purchaseDescription,
            productionCountries: row.productionCountries,
            upstreamUnknown: row.upstreamUnknown,
            rowVersion: row.rowVersion,
          }
        : null,
      sameName: sameName.filter((s) => s._id !== supplier._id).map((s) => ({ id: s._id, name: s.name })),
    };
  },
});
