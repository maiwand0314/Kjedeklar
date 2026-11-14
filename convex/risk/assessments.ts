/**
 * Screeningvurderinger av leverandører (oppgave 15). Motoren er ren
 * (src/domain/risk/engine.ts); her hentes grunnlaget, resultatet lagres som en
 * ny uforanderlig rad, og «utdatert» regnes ut ved lesing. Se beslutning 0013.
 */
import { v } from "convex/values";
import { ENGINE_VERSION, assess, type EngineData } from "../../src/domain/risk/engine.ts";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { writeAudit } from "../lib/audit";
import { appError } from "../lib/errors";
import { getOwned, tenantMutation, tenantQuery } from "../lib/tenant";
import { activeDocs, assessmentInput, basisOf, staleReasons } from "./model";
import { assessmentResultFields } from "./validators";

/**
 * Leverandører per kall. Målt mot lokal backend (tests/integration/risk-assess.test.ts, 2 000 leverandører): med
 * 200 per kall tok den tregeste siden rundt 0,5 s inkludert nettverk; 2 000 i ett kall gikk også, men tok over 2 s.
 * 200 gir god margin for tregere miljøer, og pilotens 2 000 leverandører blir elleve kall (en tom side til slutt).
 * Kalleren henter neste side med `nextCursor`. Ingen egen kø eller jobb trengs.
 */
export const ASSESS_BATCH_SIZE = 200;

/**
 * Beregner screening for én side aktive leverandører i en periode og lagrer en ny vurdering for dem som har endret
 * grunnlag eller versjon. Uendrede leverandører får ingen ny rad. Gamle vurderinger endres aldri. Kalles igjen
 * med `nextCursor` til den er `null`.
 */
export const assessPeriod = tenantMutation({
  args: { reportingPeriodId: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.object({ assessed: v.number(), unchanged: v.number(), nextCursor: v.union(v.string(), v.null()) }),
  handler: async (ctx, { reportingPeriodId, cursor }) => {
    const { organizationId, userId } = ctx.tenant;
    const period = await getOwned(ctx, "reportingPeriods", reportingPeriodId);
    const data: EngineData | null = await loadEngineData(ctx);
    const active = await activeDocs(ctx);
    if (!data || !active.method) throw appError("RISK_METHOD_MISSING");

    const page = await ctx.db
      .query("suppliers")
      .withIndex("by_organizationId_and_status_and_nameKey", (q) => q.eq("organizationId", organizationId).eq("status", "active"))
      .paginate({ numItems: ASSESS_BATCH_SIZE, cursor });

    const now = Date.now();
    let assessed = 0;
    let unchanged = 0;
    for (const supplier of page.page) {
      const { input, supplierPeriodId } = await assessmentInput(ctx, supplier, period._id);
      const basis = await basisOf(input, active, now);
      const latest = await ctx.db
        .query("riskAssessments")
        .withIndex("by_organizationId_and_period_and_supplier_and_assessedAt", (q) =>
          q.eq("organizationId", organizationId).eq("reportingPeriodId", period._id).eq("supplierId", supplier._id),
        )
        .order("desc")
        .first();
      if (latest && staleReasons(latest, basis).length === 0) {
        unchanged++;
        continue;
      }
      await ctx.db.insert("riskAssessments", {
        organizationId,
        supplierId: supplier._id,
        reportingPeriodId: period._id,
        ...(supplierPeriodId && { supplierPeriodId }),
        methodVersionId: active.method._id,
        ...(active.country && { countryDatasetVersionId: active.country._id }),
        ...(active.industry && { industryDatasetVersionId: active.industry._id }),
        engineVersion: ENGINE_VERSION,
        inputSnapshot: input,
        inputHash: basis.inputHash,
        ...assess(input, data),
        assessedAt: now,
        assessedBy: userId,
      });
      assessed++;
    }
    if (assessed > 0) {
      await writeAudit(ctx, {
        organizationId,
        actor: { type: "user", id: userId },
        eventType: "risk.assessed",
        entityType: "reportingPeriod",
        entityId: period._id,
        after: { riskAssessed: assessed, riskUnchanged: unchanged },
      });
    }
    return { assessed, unchanged, nextCursor: page.isDone ? null : page.continueCursor };
  },
});

async function loadEngineData(ctx: { runQuery: (ref: typeof internal.risk.internal.engineData, args: Record<string, never>) => Promise<unknown> }): Promise<EngineData | null> {
  const raw = (await ctx.runQuery(internal.risk.internal.engineData, {})) as {
    method: (EngineData["method"] & { id: string }) | null;
    country: (NonNullable<EngineData["country"]> & { id: string }) | null;
    industry: (NonNullable<EngineData["industry"]> & { id: string }) | null;
  };
  return raw.method ? { method: raw.method, country: raw.country, industry: raw.industry } : null;
}

const versionLabel = async (ctx: { db: { get: (table: "riskDatasetVersions" | "riskMethodVersions", id: never) => Promise<{ version: string } | null> } }, table: "riskDatasetVersions" | "riskMethodVersions", id: string | undefined) =>
  id ? ((await ctx.db.get(table, id as never))?.version ?? null) : null;

const summaryFields = {
  id: v.id("riskAssessments"),
  assessedAt: v.number(),
  screeningLevel: assessmentResultFields.screeningLevel,
  dataQuality: assessmentResultFields.dataQuality,
  methodVersion: v.union(v.string(), v.null()),
  countryVersion: v.union(v.string(), v.null()),
  industryVersion: v.union(v.string(), v.null()),
};

const summary = async (ctx: Parameters<typeof versionLabel>[0], a: Doc<"riskAssessments">) => ({
  id: a._id,
  assessedAt: a.assessedAt,
  screeningLevel: a.screeningLevel,
  dataQuality: a.dataQuality,
  methodVersion: await versionLabel(ctx, "riskMethodVersions", a.methodVersionId),
  countryVersion: await versionLabel(ctx, "riskDatasetVersions", a.countryDatasetVersionId),
  industryVersion: await versionLabel(ctx, "riskDatasetVersions", a.industryDatasetVersionId),
});

/**
 * Siste vurdering for en leverandør i en periode, med status: `current`, eller `stale` med årsaker
 * (endret grunnlag, metode, data eller motor). Er den utdatert, gjelder fortsatt resultatet slik det ble regnet,
 * og en ny beregning gir en ny rad ved siden av.
 */
export const latest = tenantQuery({
  args: { supplierId: v.string(), reportingPeriodId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      ...summaryFields,
      ...assessmentResultFields,
      engineVersion: v.string(),
      status: v.union(v.literal("current"), v.literal("stale")),
      staleReasons: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const supplier = await getOwned(ctx, "suppliers", args.supplierId);
    const period = await getOwned(ctx, "reportingPeriods", args.reportingPeriodId);
    const latest = await ctx.db
      .query("riskAssessments")
      .withIndex("by_organizationId_and_period_and_supplier_and_assessedAt", (q) =>
        q.eq("organizationId", ctx.tenant.organizationId).eq("reportingPeriodId", period._id).eq("supplierId", supplier._id),
      )
      .order("desc")
      .first();
    if (!latest) return null;
    const { input } = await assessmentInput(ctx, supplier, period._id);
    const reasons = staleReasons(latest, await basisOf(input, await activeDocs(ctx), Date.now()));
    return {
      ...(await summary(ctx, latest)),
      screeningLevel: latest.screeningLevel,
      dataQuality: latest.dataQuality,
      missingFields: latest.missingFields,
      triggeredRules: latest.triggeredRules,
      controlSignals: latest.controlSignals,
      staleSources: latest.staleSources,
      engineVersion: latest.engineVersion,
      status: reasons.length ? ("stale" as const) : ("current" as const),
      staleReasons: reasons,
    };
  },
});

/** Alle vurderinger for en leverandør i en periode, nyeste først (høyst 20). Historikken bevares. */
export const history = tenantQuery({
  args: { supplierId: v.string(), reportingPeriodId: v.string() },
  returns: v.array(v.object(summaryFields)),
  handler: async (ctx, args) => {
    const supplier = await getOwned(ctx, "suppliers", args.supplierId);
    const period = await getOwned(ctx, "reportingPeriods", args.reportingPeriodId);
    const rows = await ctx.db
      .query("riskAssessments")
      .withIndex("by_organizationId_and_period_and_supplier_and_assessedAt", (q) =>
        q.eq("organizationId", ctx.tenant.organizationId).eq("reportingPeriodId", period._id).eq("supplierId", supplier._id),
      )
      .order("desc")
      .take(20);
    return await Promise.all(rows.map((r) => summary(ctx, r)));
  },
});
