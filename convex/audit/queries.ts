import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { authComponent } from "../auth";
import { auditEntityTypes, auditEventTypes, safeDiffValidator } from "../lib/auditTypes";
import { tenantQuery } from "../lib/tenant";

/**
 * Revisjonslogg for valgt organisasjon, nyeste først, med valgfritt filter på
 * objekttype. Aktør vises med navn (andre administratorer i samme organisasjon).
 */
export const list = tenantQuery({
  args: { paginationOpts: paginationOptsValidator, entityType: v.optional(auditEntityTypes) },
  returns: v.object({
    page: v.array(
      v.object({
        id: v.id("auditEvents"),
        occurredAt: v.number(),
        eventType: auditEventTypes,
        entityType: auditEntityTypes,
        entityId: v.string(),
        actor: v.string(),
        safeDiff: safeDiffValidator,
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { paginationOpts, entityType }) => {
    const organizationId = ctx.tenant.organizationId;
    const query = entityType
      ? ctx.db
          .query("auditEvents")
          .withIndex("by_organizationId_and_entityType_and_occurredAt", (q) =>
            q.eq("organizationId", organizationId).eq("entityType", entityType),
          )
      : ctx.db
          .query("auditEvents")
          .withIndex("by_organizationId_and_occurredAt", (q) => q.eq("organizationId", organizationId));
    const result = await query.order("desc").paginate(paginationOpts);

    const names = new Map<string, string>();
    for (const id of new Set(result.page.flatMap((e) => (e.actorId ? [e.actorId] : [])))) {
      const user = await authComponent.getAnyUserById(ctx, id);
      names.set(id, user?.name ?? "Tidligere bruker");
    }
    return {
      page: result.page.map((e) => ({
        id: e._id,
        occurredAt: e.occurredAt,
        eventType: e.eventType,
        entityType: e.entityType,
        entityId: e.entityId,
        actor: e.actorType === "system" ? "Kjedeklar (system)" : (names.get(e.actorId ?? "") ?? "Ukjent"),
        safeDiff: e.safeDiff,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
