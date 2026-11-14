/**
 * Lesefunksjoner for kunder. De gir bare metadata og datakvalitet om versjoner
 * som er aktivert eller pensjonert (demo bare i lokale miljøer), aldri
 * uaktiverte versjoner og aldri innholdet. Reglene i convex/lib/rls.ts
 * håndhever det samme på den innpakkede `ctx.db`.
 */
import { v } from "convex/values";
import { visibleToTenants } from "../../src/domain/risk/datasets/lifecycle.ts";
import { notFound } from "../lib/errors";
import { tenantQuery } from "../lib/tenant";
import { isLocalEnv } from "../ops/guard";
import { versionView } from "./model";
import { versionViewValidator } from "./validators";

/** De aktive versjonene som gjelder nå: produksjon, eller demo i lokale miljøer når ingen produksjonsversjon er aktiv. */
export const activeVersions = tenantQuery({
  args: {},
  returns: v.object({
    country: v.union(versionViewValidator, v.null()),
    industry: v.union(versionViewValidator, v.null()),
    method: v.union(versionViewValidator, v.null()),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const environments = isLocalEnv() ? (["production", "demo"] as const) : (["production"] as const);
    const dataset = async (kind: "country" | "industry") => {
      for (const environment of environments) {
        const doc = await ctx.db
          .query("riskDatasetVersions")
          .withIndex("by_kind_and_environment_and_status", (q) => q.eq("kind", kind).eq("environment", environment).eq("status", "active"))
          .first();
        if (doc) return versionView(kind, doc, now);
      }
      return null;
    };
    const method = async () => {
      for (const environment of environments) {
        const doc = await ctx.db
          .query("riskMethodVersions")
          .withIndex("by_environment_and_status", (q) => q.eq("environment", environment).eq("status", "active"))
          .first();
        if (doc) return versionView("method", doc, now);
      }
      return null;
    };
    return { country: await dataset("country"), industry: await dataset("industry"), method: await method() };
  },
});

/** Én aktiv eller pensjonert versjon, så en gammel vurdering kan vise hvilket grunnlag den bygger på. Ellers «ikke funnet». */
export const getVersion = tenantQuery({
  args: { kind: v.union(v.literal("country"), v.literal("industry"), v.literal("method")), versionId: v.string() },
  returns: versionViewValidator,
  handler: async (ctx, { kind, versionId }) => {
    if (kind === "method") {
      const id = ctx.db.normalizeId("riskMethodVersions", versionId);
      const doc = id && (await ctx.db.get("riskMethodVersions", id));
      if (!doc || !visibleToTenants(doc, isLocalEnv())) throw notFound();
      return versionView("method", doc, Date.now());
    }
    const id = ctx.db.normalizeId("riskDatasetVersions", versionId);
    const doc = id && (await ctx.db.get("riskDatasetVersions", id));
    if (!doc || doc.kind !== kind || !visibleToTenants(doc, isLocalEnv())) throw notFound();
    return versionView(kind, doc, Date.now());
  },
});
