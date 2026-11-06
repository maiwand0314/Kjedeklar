import { notFound } from "../lib/errors";
import { tenantQuery, userQuery } from "../lib/tenant";

/** Valgt organisasjon for innlogget medlem. Fremmed/ukjent gir NOT_FOUND. */
export const current = tenantQuery({
  args: {},
  handler: async (ctx) => {
    const organization = await ctx.db.get(
      "organizations",
      ctx.tenant.organizationId,
    );
    if (!organization) throw notFound();
    return {
      id: organization._id,
      name: organization.name,
      role: ctx.tenant.role,
    };
  },
});

/** Organisasjoner der innlogget bruker har aktivt medlemskap. */
export const listMine = userQuery({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
      .collect();
    const result: { id: string; name: string }[] = [];
    for (const membership of memberships) {
      if (membership.status !== "active") continue;
      const organization = await ctx.db.get(
        "organizations",
        membership.organizationId,
      );
      if (organization && organization.status === "active") {
        result.push({ id: organization._id, name: organization.name });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, "nb"));
  },
});
