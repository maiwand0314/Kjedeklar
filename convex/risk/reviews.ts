/**
 * Risikoliste, forklaring og kundens vurdering av screeningen (oppgave 16). Screeningen er motorens nivå og endres
 * aldri her. En bekreftelse, overstyring eller tilbaketrekking er en ny rad i `assessmentReviews` med begrunnelse,
 * bruker og tidspunkt, skrevet sammen med revisjonsloggen. Se beslutning 0014.
 */
import { v } from "convex/values";
import { OVERRIDE_LEVELS, checkRationale, effectiveReview, groupOrder, prioritySort, type ListLevel, type ReviewState } from "../../src/domain/risk/review.ts";
import type { Doc, Id } from "../_generated/dataModel";
import { authComponent } from "../auth";
import { writeAudit } from "../lib/audit";
import { appError } from "../lib/errors";
import { getOwned, tenantMutation, tenantQuery } from "../lib/tenant";
import { summary, summaryFields } from "./assessments";
import { activeDocs, latestAssessment, latestReview } from "./model";
import { assessmentResultFields, levelWithUnknown, reviewDecisionValidator, screeningLevelValidator } from "./validators";

const listLevelValidator = v.union(levelWithUnknown, v.literal("not_assessed"));
const reviewStateValidator = v.union(v.literal("none"), v.literal("confirmed"), v.literal("overridden"), v.literal("revoked"), v.literal("outdated"));

/**
 * Leverandører listen leser. Hver leverandør koster tre lesinger (leverandør, siste screening, innkjøpsdata); bare
 * leverandører med kundevurdering og radene på siden får full kontroll av om grunnlaget er endret. Convex stopper en
 * spørring ved 16 384 dokumenter, 8 MiB og tidsgrensen. Målt mot lokal backend (tests/integration/risk-review.test.ts):
 * 1 000 leverandører med full kontroll for hver tok 1,1 s, og 2 000 feilet; med lesingen over tok 1 990 leverandører 1,3 s. Over grensen
 * settes `truncated`, og grensesnittet sier det; ingenting vises som om det var hele listen.
 */
export const LIST_SUPPLIER_LIMIT = 2000;
const MAX_PAGE = 100;
const READ_GROUP = 100;
/** Høyeste antall vurderingsrader listen leser for en periode (flere gir `truncated`). */
const REVIEW_SCAN_LIMIT = 5000;

const reviewView = (r: Doc<"assessmentReviews">, actor: string) => ({
  id: r._id,
  assessmentId: r.assessmentId,
  decision: r.decision,
  originalLevel: r.originalLevel,
  chosenLevel: r.chosenLevel ?? null,
  rationale: r.rationale,
  evidenceNote: r.evidenceNote ?? null,
  actor,
  reviewedAt: r.reviewedAt,
});
const reviewViewValidator = v.object({
  id: v.id("assessmentReviews"),
  assessmentId: v.id("riskAssessments"),
  decision: reviewDecisionValidator,
  originalLevel: levelWithUnknown,
  chosenLevel: v.union(screeningLevelValidator, v.null()),
  rationale: v.string(),
  evidenceNote: v.union(v.string(), v.null()),
  actor: v.string(),
  reviewedAt: v.number(),
});

const stateOf = (assessment: Doc<"riskAssessments"> | null, stale: boolean, review: Doc<"assessmentReviews"> | null) =>
  effectiveReview(
    assessment?.screeningLevel ?? null,
    review && { decision: review.decision, chosenLevel: review.chosenLevel, assessmentId: review.assessmentId },
    assessment && { id: assessment._id, status: stale ? "stale" : "current" },
  );

const emptyCounts = () => ({
  screening: { high: 0, unknown: 0, moderate: 0, low: 0, not_assessed: 0 },
  review: { none: 0, confirmed: 0, overridden: 0, revoked: 0, outdated: 0 },
});

/**
 * Risikoprioritert liste for en periode: nivå først (metodens rekkefølge, «ukjent» og «ikke vurdert» foran moderat og
 * lav), deretter beløp fallende innenfor samme nivå, ukjent beløp sist. Listen sorteres etter *screeningen*, så en
 * overstyring til lavt nivå aldri flytter en høy screening ned. Tellingene gjelder alle aktive leverandører i perioden,
 * uavhengig av filter, og skiller screening fra kundens vurdering.
 */
export const list = tenantQuery({
  args: {
    reportingPeriodId: v.string(),
    level: v.optional(listLevelValidator),
    reviewState: v.optional(reviewStateValidator),
    search: v.optional(v.string()),
    offset: v.number(),
    limit: v.number(),
  },
  returns: v.object({
    rows: v.array(
      v.object({
        supplierId: v.id("suppliers"),
        name: v.string(),
        level: listLevelValidator,
        dataQuality: v.union(v.literal("complete"), v.literal("incomplete"), v.literal("insufficient"), v.null()),
        missingCount: v.number(),
        stale: v.boolean(),
        spendOre: v.union(v.int64(), v.null()),
        reviewState: reviewStateValidator,
        effectiveLevel: v.union(levelWithUnknown, v.null()),
      }),
    ),
    total: v.number(),
    counts: v.object({
      screening: v.object({ high: v.number(), unknown: v.number(), moderate: v.number(), low: v.number(), not_assessed: v.number() }),
      review: v.object({ none: v.number(), confirmed: v.number(), overridden: v.number(), revoked: v.number(), outdated: v.number() }),
    }),
    groupOrder: v.array(listLevelValidator),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { organizationId } = ctx.tenant;
    const period = await getOwned(ctx, "reportingPeriods", args.reportingPeriodId);
    const active = await activeDocs(ctx);
    const order = groupOrder(active.method?.definition.priorityOrder);
    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_organizationId_and_status_and_nameKey", (q) => q.eq("organizationId", organizationId).eq("status", "active"))
      .take(LIST_SUPPLIER_LIMIT + 1);
    const search = args.search?.trim().toLowerCase();

    // 1) Billig lesing for alle: siste screening og innkjøpsbeløp. Gruppene går parallelt; sekvensielle oppslag for
    //    tusen leverandører er tregere enn spørringen har tid til.
    const read = suppliers.slice(0, LIST_SUPPLIER_LIMIT);
    const light = async (supplier: Doc<"suppliers">): Promise<Basic> => {
      const [assessment, row] = await Promise.all([
        ctx.db
          .query("riskAssessments")
          .withIndex("by_organizationId_and_period_and_supplier_and_assessedAt", (q) =>
            q.eq("organizationId", organizationId).eq("reportingPeriodId", period._id).eq("supplierId", supplier._id),
          )
          .order("desc")
          .first(),
        ctx.db
          .query("supplierPeriods")
          .withIndex("by_organizationId_and_supplierId_and_reportingPeriodId", (q) =>
            q.eq("organizationId", organizationId).eq("supplierId", supplier._id).eq("reportingPeriodId", period._id),
          )
          .unique(),
      ]);
      return { supplier, assessment, spendOre: row?.spendOre ?? null };
    };
    type Basic = { supplier: Doc<"suppliers">; assessment: Doc<"riskAssessments"> | null; spendOre: bigint | null };
    const basics: Basic[] = [];
    for (let i = 0; i < read.length; i += READ_GROUP) basics.push(...(await Promise.all(read.slice(i, i + READ_GROUP).map(light))));

    // 2) Kundens vurderinger leses samlet (nyeste først; første per leverandør er den gjeldende). Bare leverandører
    //    med en vurdering trenger kontroll av om grunnlaget er endret; resten har ingen kundevurdering.
    const reviewRows = await ctx.db
      .query("assessmentReviews")
      .withIndex("by_organizationId_and_period_and_supplier_and_reviewedAt", (q) => q.eq("organizationId", organizationId).eq("reportingPeriodId", period._id))
      .take(REVIEW_SCAN_LIMIT + 1);
    const currentReview = new Map<string, Doc<"assessmentReviews">>();
    for (const r of reviewRows.slice(0, REVIEW_SCAN_LIMIT)) {
      const seen = currentReview.get(r.supplierId);
      if (!seen || r.reviewedAt > seen.reviewedAt) currentReview.set(r.supplierId, r);
    }

    const fullState = async (b: Basic) => {
      const { reasons } = await latestAssessment(ctx, b.supplier, period._id, active);
      return reasons.length > 0;
    };
    const staleOf = new Map<string, boolean>();
    for (let i = 0; i < basics.length; ) {
      const group = basics.slice(i, i + READ_GROUP).filter((b) => b.assessment && currentReview.has(b.supplier._id));
      i += READ_GROUP;
      const results = await Promise.all(group.map(fullState));
      group.forEach((b, j) => staleOf.set(b.supplier._id, results[j]));
    }

    const counts = emptyCounts();
    const rows = [];
    for (const b of basics) {
      const stale = staleOf.get(b.supplier._id) ?? false;
      const effective = stateOf(b.assessment, stale, currentReview.get(b.supplier._id) ?? null);
      const level: ListLevel = b.assessment?.screeningLevel ?? "not_assessed";
      counts.screening[level]++;
      counts.review[effective.state]++;
      if (args.level && args.level !== level) continue;
      if (args.reviewState && args.reviewState !== effective.state) continue;
      if (search && !b.supplier.nameKey.startsWith(search)) continue;
      rows.push({
        id: b.supplier._id as string,
        nameKey: b.supplier.nameKey,
        supplierId: b.supplier._id,
        name: b.supplier.name,
        level,
        dataQuality: b.assessment?.dataQuality ?? null,
        missingCount: b.assessment?.missingFields.length ?? 0,
        stale,
        spendOre: b.spendOre,
        reviewState: effective.state satisfies ReviewState,
        effectiveLevel: effective.level,
      });
    }
    const offset = Math.max(0, Math.floor(args.offset));
    const limit = Math.min(MAX_PAGE, Math.max(1, Math.floor(args.limit)));
    const pageRows = prioritySort(rows, order).slice(offset, offset + limit);
    // Utdatert screening vises for radene på siden, også for leverandører uten kundevurdering.
    const bySupplier = new Map(basics.map((b) => [b.supplier._id as string, b]));
    for (const r of pageRows) {
      const b = bySupplier.get(r.id)!;
      if (b.assessment && !staleOf.has(r.id)) r.stale = await fullState(b);
    }
    const page = pageRows
      .map((r) => ({ supplierId: r.supplierId, name: r.name, level: r.level, dataQuality: r.dataQuality, missingCount: r.missingCount, stale: r.stale, spendOre: r.spendOre, reviewState: r.reviewState, effectiveLevel: r.effectiveLevel }));
    return { rows: page, total: rows.length, counts, groupOrder: order, truncated: suppliers.length > LIST_SUPPLIER_LIMIT || reviewRows.length > REVIEW_SCAN_LIMIT };
  },
});

/**
 * Forklaring og kundens vurdering for én leverandør i én periode: regler som slo ut (med kilde, utgave og linje),
 * hva som mangler, opprinnelig screening og kundens vurdering ved siden av hverandre, og historikken.
 */
export const detail = tenantQuery({
  args: { supplierId: v.string(), reportingPeriodId: v.string() },
  returns: v.object({
    supplier: v.object({ id: v.id("suppliers"), name: v.string() }),
    spendOre: v.union(v.int64(), v.null()),
    assessment: v.union(
      v.null(),
      v.object({
        ...summaryFields,
        ...assessmentResultFields,
        engineVersion: v.string(),
        status: v.union(v.literal("current"), v.literal("stale")),
        staleReasons: v.array(v.string()),
        ruleDescriptions: v.array(v.object({ ruleId: v.string(), description: v.string() })),
      }),
    ),
    review: v.object({ state: reviewStateValidator, level: v.union(levelWithUnknown, v.null()), current: v.union(reviewViewValidator, v.null()) }),
    reviews: v.array(reviewViewValidator),
  }),
  handler: async (ctx, args) => {
    const { organizationId } = ctx.tenant;
    const supplier = await getOwned(ctx, "suppliers", args.supplierId);
    const period = await getOwned(ctx, "reportingPeriods", args.reportingPeriodId);
    const { assessment, reasons, spendOre } = await latestAssessment(ctx, supplier, period._id);
    const reviews = await ctx.db
      .query("assessmentReviews")
      .withIndex("by_organizationId_and_period_and_supplier_and_reviewedAt", (q) =>
        q.eq("organizationId", organizationId).eq("reportingPeriodId", period._id).eq("supplierId", supplier._id),
      )
      .order("desc")
      .take(20);
    const effective = stateOf(assessment, reasons.length > 0, reviews[0] ?? null);
    const names = new Map<string, string>();
    for (const id of new Set(reviews.map((r) => r.actorId))) {
      names.set(id, (await authComponent.getAnyUserById(ctx, id))?.name ?? "Tidligere bruker");
    }
    const view = (r: Doc<"assessmentReviews">) => reviewView(r, names.get(r.actorId) ?? "Ukjent");
    // Beskrivelsene hører til metodeversjonen som ble brukt, ikke nødvendigvis den aktive nå.
    const method = assessment ? await ctx.db.get("riskMethodVersions", assessment.methodVersionId) : null;
    return {
      supplier: { id: supplier._id, name: supplier.name },
      spendOre,
      assessment: assessment && {
        ...(await summary(ctx, assessment)),
        missingFields: assessment.missingFields,
        triggeredRules: assessment.triggeredRules,
        controlSignals: assessment.controlSignals,
        staleSources: assessment.staleSources,
        engineVersion: assessment.engineVersion,
        status: reasons.length ? ("stale" as const) : ("current" as const),
        staleReasons: reasons,
        ruleDescriptions: (method?.definition.ruleDefinitions ?? []).map(({ ruleId, description }) => ({ ruleId, description })),
      },
      review: { state: effective.state, level: effective.level, current: reviews[0] ? view(reviews[0]) : null },
      reviews: reviews.map(view),
    };
  },
});

/**
 * Bekrefter, overstyrer eller trekker tilbake kundens vurdering av en screening. Reglene:
 * - begrunnelse kreves for alle tre og må være en forklaring (checkRationale);
 * - overstyring velger et nivå som er forskjellig fra screeningen; bekreftelse og tilbaketrekking velger ingen;
 * - vurderingen må gjelde siste screening, og screeningen må være gjeldende (ikke utdatert av endret grunnlag);
 * - `expectedReviewId` er vurderingen brukeren så som gjeldende (eller null). Er den en annen nå, avvises kallet
 *   (CONFLICT), så ingen skriver stille over en annens vurdering.
 * Screeningen er uberørt. Den nye raden og revisjonsloggen skrives i samme mutasjon.
 */
export const record = tenantMutation({
  args: {
    supplierId: v.string(),
    reportingPeriodId: v.string(),
    assessmentId: v.string(),
    expectedReviewId: v.union(v.string(), v.null()),
    decision: reviewDecisionValidator,
    chosenLevel: v.optional(screeningLevelValidator),
    rationale: v.string(),
    evidenceNote: v.optional(v.string()),
  },
  returns: v.object({ id: v.id("assessmentReviews") }),
  handler: async (ctx, args) => {
    const { organizationId, userId } = ctx.tenant;
    const supplier = await getOwned(ctx, "suppliers", args.supplierId);
    const period = await getOwned(ctx, "reportingPeriods", args.reportingPeriodId);
    const target = await getOwned(ctx, "riskAssessments", args.assessmentId);
    // En vurdering fra en annen leverandør eller periode i samme organisasjon er heller ikke «funnet».
    if (target.supplierId !== supplier._id || target.reportingPeriodId !== period._id) throw appError("NOT_FOUND");

    const rationale = checkRationale(args.rationale);
    if (!rationale.ok) throw appError("RATIONALE_INVALID");
    const note = args.evidenceNote?.trim();
    if (note !== undefined && note.length > 2000) throw appError("INVALID_INPUT");
    const choosesLevel = args.decision === "override";
    if (choosesLevel !== (args.chosenLevel !== undefined)) throw appError("INVALID_INPUT");
    if (args.chosenLevel !== undefined && (!OVERRIDE_LEVELS.includes(args.chosenLevel) || args.chosenLevel === target.screeningLevel)) {
      throw appError("INVALID_INPUT");
    }

    const { assessment: latest, reasons } = await latestAssessment(ctx, supplier, period._id);
    // Brukeren så en screening som er byttet ut av en nyere.
    if (latest?._id !== target._id) throw appError("CONFLICT");
    const previous = await latestReview(ctx, organizationId, period._id, supplier._id);
    if ((previous?._id ?? null) !== args.expectedReviewId) throw appError("CONFLICT");
    // Tilbaketrekking av en gjeldende vurdering er alltid trygt; bekreftelse og overstyring krever gjeldende grunnlag.
    if (args.decision === "revoke") {
      if (!previous || previous.decision === "revoke") throw appError("INVALID_INPUT");
    } else if (reasons.length > 0) {
      throw appError("REVIEW_STALE");
    }

    const id: Id<"assessmentReviews"> = await ctx.db.insert("assessmentReviews", {
      organizationId,
      assessmentId: target._id,
      supplierId: supplier._id,
      reportingPeriodId: period._id,
      decision: args.decision,
      originalLevel: target.screeningLevel,
      ...(args.chosenLevel && { chosenLevel: args.chosenLevel }),
      ...(previous && { previousReviewId: previous._id }),
      rationale: rationale.text,
      ...(note && { evidenceNote: note }),
      actorId: userId,
      reviewedAt: Date.now(),
    });
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "user", id: userId },
      eventType: "risk.reviewed",
      entityType: "assessmentReview",
      entityId: id,
      before: previous && { decision: previous.decision, originalLevel: previous.originalLevel, chosenLevel: previous.chosenLevel, assessmentId: previous.assessmentId },
      after: { decision: args.decision, originalLevel: target.screeningLevel, chosenLevel: args.chosenLevel, assessmentId: target._id },
    });
    return { id };
  },
});
