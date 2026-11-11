/**
 * Gjennomgang, bekreftelse og gjennomføring av et importgrunnlag. Grunnlaget
 * lages av prepare-actionen; her velger brukeren hva som skal skje med hver
 * oppføring, bekrefter, og importen gjennomføres stykkevis. Hvert stykke er én
 * transaksjon, så en avbrutt import står igjen som «ikke fullført» og kan
 * fortsettes, aldri som en skjult halv import.
 */
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { allowedDecisions, effectiveDecision, IMPORT_MAPPING_VERSION } from "../../../src/domain/import/plan";
import { nameKey, normalizeSupplierPeriod } from "../../../src/domain/suppliers/supplier";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { periodSummaryValidator } from "../../organizations/profileValidators";
import { writeAudit } from "../../lib/audit";
import { appError, notFound } from "../../lib/errors";
import { getOwned, tenantMutation, tenantQuery, type Tenant } from "../../lib/tenant";
import { checkedProfile, periodRow } from "../model";
import {
  decisionValidator,
  entryKindValidator,
  importValuesValidator,
  issueValidator,
  kindCountsValidator,
  matchKindValidator,
  outcomeValidator,
  policyValidator,
  resultValidator,
} from "./validators";

type ReadCtx = { db: QueryCtx["db"]; tenant: Tenant };
type Ctx = { db: MutationCtx["db"]; tenant: Tenant };
type Batch = Doc<"importBatches">;
type Entry = Doc<"importRows">;

/** Oppføringer per transaksjon. Hver oppføring bruker under ti oppslag av Convex sin grense på 4 096 per transaksjon. */
const ENTRIES_PER_COMMIT = 100;
/** Typene der brukeren må velge selv; nye leverandører uten avklaringer opprettes uten eget valg. */
const DECIDED_KINDS = ["new_warning", "known", "unclear", "error"] as const;

const publicStatus = v.union(v.literal("draft"), v.literal("committing"), v.literal("committed"));
const isExpired = (batch: Batch, now: number) =>
  batch.status === "draft" && (batch.expiresAt <= now || batch.mappingVersion !== IMPORT_MAPPING_VERSION);

/**
 * En annen import til samme periode pågår, eller er fullført etter at grunnlaget ble laget. Da bygger
 * forslagene på leverandørene slik de var før, og en rad med bare navn ville blitt opprettet to ganger.
 */
export async function isSuperseded(db: QueryCtx["db"], batch: Pick<Batch, "organizationId" | "reportingPeriodId" | "createdAt">) {
  const inPeriod = (status: "committing" | "committed") =>
    db
      .query("importBatches")
      .withIndex("by_organizationId_and_reportingPeriodId_and_status_and_committedAt", (q) => {
        const scoped = q.eq("organizationId", batch.organizationId).eq("reportingPeriodId", batch.reportingPeriodId).eq("status", status);
        return status === "committed" ? scoped.gt("committedAt", batch.createdAt) : scoped;
      })
      .first();
  return (await inPeriod("committing")) !== null || (await inPeriod("committed")) !== null;
}

/** Et grunnlag under oppretting finnes ikke for brukeren ennå. */
async function ownedBatch(ctx: ReadCtx, batchId: string) {
  const batch = await getOwned(ctx, "importBatches", batchId);
  if (batch.status === "preparing") throw notFound();
  return batch as Batch & { status: "draft" | "committing" | "committed" };
}

/** Utkastet valgene gjelder: ikke bekreftet, ikke utløpt, og i versjonen brukeren så. */
async function draft(ctx: Ctx, batchId: string, expectedRowVersion: number) {
  const batch = await ownedBatch(ctx, batchId);
  if (batch.status !== "draft") throw appError("CONFLICT");
  if (isExpired(batch, Date.now())) throw appError("IMPORT_EXPIRED");
  if (batch.rowVersion !== expectedRowVersion) throw appError("CONFLICT");
  return batch;
}

const undecidedOf = (ctx: ReadCtx, batch: Batch, kind: (typeof DECIDED_KINDS)[number]) =>
  ctx.db
    .query("importRows")
    .withIndex("by_organizationId_and_batchId_and_kind_and_decision", (q) =>
      q.eq("organizationId", batch.organizationId).eq("batchId", batch._id).eq("kind", kind).eq("decision", undefined),
    );

/** De siste importene i organisasjonen, nyeste først. */
export const list = tenantQuery({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("importBatches"),
      fileName: v.string(),
      status: publicStatus,
      expired: v.boolean(),
      createdAt: v.number(),
      entryCount: v.number(),
      processed: v.number(),
      result: resultValidator,
      period: v.union(periodSummaryValidator, v.null()),
    }),
  ),
  handler: async (ctx) => {
    const now = Date.now();
    const batches = await ctx.db
      .query("importBatches")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", ctx.tenant.organizationId))
      .order("desc")
      .take(30);
    const shown = batches.flatMap((b) => (b.status === "preparing" ? [] : [{ ...b, status: b.status }])).slice(0, 10);
    return await Promise.all(
      shown.map(async (b) => {
        const period = await ctx.db.get("reportingPeriods", b.reportingPeriodId);
        return {
          id: b._id,
          fileName: b.fileName,
          status: b.status,
          expired: isExpired(b, now),
          createdAt: b.createdAt,
          entryCount: b.entryCount,
          processed: b.processed,
          result: b.result,
          period: period && { id: period._id, startDate: period.startDate, endDate: period.endDate, publicationDueDate: period.publicationDueDate },
        };
      }),
    );
  },
});

/** Ett importgrunnlag med fellesvalg, antall per type og hvor mange oppføringer som mangler valg. */
export const get = tenantQuery({
  args: { batchId: v.string() },
  returns: v.object({
    id: v.id("importBatches"),
    status: publicStatus,
    expired: v.boolean(),
    fileName: v.string(),
    period: periodSummaryValidator,
    rowCount: v.number(),
    entryCount: v.number(),
    kindCounts: kindCountsValidator,
    policy: policyValidator,
    rowVersion: v.number(),
    undecided: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
    repeatsCommittedAt: v.optional(v.number()),
    processed: v.number(),
    result: resultValidator,
    committedAt: v.optional(v.number()),
  }),
  handler: async (ctx, { batchId }) => {
    const batch = await ownedBatch(ctx, batchId);
    const period = await getOwned(ctx, "reportingPeriods", batch.reportingPeriodId);
    let undecided = 0;
    if (batch.status === "draft") {
      for (const kind of DECIDED_KINDS) {
        // shortcut: teller ved å lese oppføringene (høyst 2 000), bytt til tellere på batchen hvis grensen økes.
        if (!batch.policy[kind]) undecided += (await undecidedOf(ctx, batch, kind).collect()).length;
      }
    }
    const repeats = batch.repeatsBatchId && (await ctx.db.get("importBatches", batch.repeatsBatchId));
    return {
      id: batch._id,
      status: batch.status,
      expired: isExpired(batch, Date.now()),
      fileName: batch.fileName,
      period: { id: period._id, startDate: period.startDate, endDate: period.endDate, publicationDueDate: period.publicationDueDate },
      rowCount: batch.rowCount,
      entryCount: batch.entryCount,
      kindCounts: batch.kindCounts,
      policy: batch.policy,
      rowVersion: batch.rowVersion,
      undecided,
      createdAt: batch.createdAt,
      expiresAt: batch.expiresAt,
      repeatsCommittedAt: repeats?.committedAt,
      processed: batch.processed,
      result: batch.result,
      committedAt: batch.committedAt,
    };
  },
});

/** Oppføringene i et grunnlag, i filens rekkefølge, eventuelt bare én type. Paginert. */
export const rows = tenantQuery({
  args: { batchId: v.string(), paginationOpts: paginationOptsValidator, kind: v.optional(entryKindValidator) },
  returns: v.object({
    page: v.array(
      v.object({
        id: v.id("importRows"),
        rowNumber: v.number(),
        sourceRows: v.array(v.number()),
        sourceRowCount: v.number(),
        values: importValuesValidator,
        issues: v.array(issueValidator),
        kind: entryKindValidator,
        matchKind: matchKindValidator,
        candidates: v.array(v.object({ id: v.id("suppliers"), name: v.string(), archived: v.boolean() })),
        // Valget som gjelder nå (eget valg eller fellesvalg). Mangler når brukeren ikke har tatt stilling.
        decision: v.optional(decisionValidator),
        ownDecision: v.boolean(),
        targetSupplierId: v.optional(v.id("suppliers")),
        outcome: v.optional(outcomeValidator),
        supplier: v.optional(v.object({ id: v.id("suppliers"), name: v.string() })),
        previousSpendOre: v.optional(v.int64()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { batchId, paginationOpts, kind }) => {
    const batch = await ownedBatch(ctx, batchId);
    const organizationId = ctx.tenant.organizationId;
    const result = await (kind
      ? ctx.db
          .query("importRows")
          .withIndex("by_organizationId_and_batchId_and_kind_and_decision", (q) =>
            q.eq("organizationId", organizationId).eq("batchId", batch._id).eq("kind", kind),
          )
      : ctx.db
          .query("importRows")
          .withIndex("by_organizationId_and_batchId_and_rowNumber", (q) => q.eq("organizationId", organizationId).eq("batchId", batch._id))
    ).paginate(paginationOpts);
    const name = async (id: Entry["candidates"][number]["supplierId"]) => {
      const supplier = await ctx.db.get("suppliers", id);
      return supplier && { id: supplier._id, name: supplier.name, archived: supplier.status === "archived" };
    };
    return {
      page: await Promise.all(
        result.page.map(async (entry) => {
          const candidates = (await Promise.all(entry.candidates.map((c) => name(c.supplierId)))).flatMap((c) => (c ? [c] : []));
          const supplier = entry.supplierId && (await name(entry.supplierId));
          return {
            id: entry._id,
            rowNumber: entry.rowNumber,
            sourceRows: entry.sourceRows,
            sourceRowCount: entry.sourceRowCount,
            values: entry.values,
            issues: entry.issues,
            kind: entry.kind,
            matchKind: entry.matchKind,
            candidates,
            decision: effectiveDecision(entry, batch.policy),
            ownDecision: entry.decision !== undefined,
            targetSupplierId: entry.targetSupplierId,
            outcome: entry.outcome,
            supplier: supplier ? { id: supplier.id, name: supplier.name } : undefined,
            previousSpendOre: entry.previousSpendOre,
          };
        }),
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/** Setter fellesvalg per type. Endrer ingen leverandørdata. */
export const setPolicy = tenantMutation({
  args: { batchId: v.string(), expectedRowVersion: v.number(), policy: policyValidator },
  returns: v.object({ rowVersion: v.number() }),
  handler: async (ctx, { batchId, expectedRowVersion, policy }) => {
    const batch = await draft(ctx, batchId, expectedRowVersion);
    await ctx.db.patch("importBatches", batch._id, { policy, rowVersion: batch.rowVersion + 1 });
    return { rowVersion: batch.rowVersion + 1 };
  },
});

/**
 * Setter eller fjerner valget for én oppføring. «Oppdater» krever en leverandør
 * blant dem grunnlaget foreslo, og den lastes med getOwned. Endrer ingen
 * leverandørdata.
 */
export const decide = tenantMutation({
  args: {
    batchId: v.string(),
    rowId: v.string(),
    expectedRowVersion: v.number(),
    decision: v.union(decisionValidator, v.null()),
    targetSupplierId: v.optional(v.string()),
  },
  returns: v.object({ rowVersion: v.number() }),
  handler: async (ctx, { batchId, rowId, expectedRowVersion, decision, targetSupplierId }) => {
    const batch = await draft(ctx, batchId, expectedRowVersion);
    const entry = await getOwned(ctx, "importRows", rowId);
    if (entry.batchId !== batch._id) throw notFound();
    let target: Entry["targetSupplierId"];
    if (decision) {
      if (!allowedDecisions(entry.kind, entry.matchKind).includes(decision)) throw appError("INVALID_INPUT");
      if (decision === "update") {
        // Sikkert treff har bare én mulig leverandør; ellers må brukeren velge blant forslagene.
        const chosen = targetSupplierId ?? (entry.kind === "known" ? entry.candidates[0]?.supplierId : undefined);
        if (!chosen) throw appError("INVALID_INPUT");
        const supplier = await getOwned(ctx, "suppliers", chosen);
        if (!entry.candidates.some((c) => c.supplierId === supplier._id)) throw appError("INVALID_INPUT");
        target = supplier._id;
      }
    }
    await ctx.db.patch("importRows", entry._id, { decision: decision ?? undefined, targetSupplierId: target });
    await ctx.db.patch("importBatches", batch._id, { rowVersion: batch.rowVersion + 1 });
    return { rowVersion: batch.rowVersion + 1 };
  },
});

/**
 * Bekrefter importen: valgene fryses og grunnlaget kan gjennomføres. Krever at
 * alle oppføringer har et valg, at grunnlaget ikke er utløpt, og at brukeren
 * bekrefter versjonen den så. Et nytt kall etter bekreftelsen endrer ingenting.
 */
export const startCommit = tenantMutation({
  args: { batchId: v.string(), expectedRowVersion: v.number() },
  returns: v.object({ status: v.union(v.literal("committing"), v.literal("committed")) }),
  handler: async (ctx, { batchId, expectedRowVersion }) => {
    const { organizationId, userId } = ctx.tenant;
    const existing = await ownedBatch(ctx, batchId);
    if (existing.status !== "draft") return { status: existing.status };
    const batch = await draft(ctx, batchId, expectedRowVersion);
    if (await isSuperseded(ctx.db, batch)) throw appError("IMPORT_STALE");
    for (const kind of DECIDED_KINDS) {
      if (!batch.policy[kind] && (await undecidedOf(ctx, batch, kind).first())) throw appError("IMPORT_UNDECIDED");
    }
    const changes = { status: "committing" as const, confirmedAt: Date.now(), confirmedBy: userId };
    await ctx.db.patch("importBatches", batch._id, changes);
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "user", id: userId },
      eventType: "import.confirmed",
      entityType: "importBatch",
      entityId: batch._id,
      before: { status: batch.status },
      after: {
        status: changes.status,
        entryCount: batch.entryCount,
        policyKnown: batch.policy.known,
        policyNewWarning: batch.policy.new_warning,
        policyError: batch.policy.error,
        policyUnclear: batch.policy.unclear,
      },
    });
    return { status: changes.status };
  },
});

type Applied = Pick<Entry, "outcome" | "supplierId" | "previousSpendOre">;

/** Gjennomfører én oppføring. Avvik fra grunnlaget gir «conflict» på oppføringen, ikke en stille overskriving. */
async function apply(ctx: Ctx, batch: Batch, entry: Entry): Promise<Applied> {
  const { organizationId, userId } = ctx.tenant;
  const decision = effectiveDecision(entry, batch.policy);
  if (!decision) throw appError("IMPORT_UNDECIDED");
  if (decision === "skip") return { outcome: "skipped" };

  const { name, registryOrgNumber, externalKey, registeredCountry, industryCode, spendOre, purchaseCategory, purchaseDescription } = entry.values;
  const fromFile = {
    ...(spendOre !== undefined && { spendOre }),
    ...(purchaseCategory !== undefined && { purchaseCategory }),
    ...(purchaseDescription !== undefined && { purchaseDescription }),
  };
  const hasPeriodData = Object.keys(fromFile).length > 0;
  const meta = { rowVersion: 1, updatedAt: Date.now(), updatedBy: userId };
  /** Innkjøpsdata slik de blir lagret: verdiene fra filen over det som finnes, eller over «ukjent». */
  const periodData = (current: Doc<"supplierPeriods"> | null) => {
    const merged = normalizeSupplierPeriod({
      spendOre: current?.spendOre,
      purchaseCategory: current?.purchaseCategory,
      purchaseDescription: current?.purchaseDescription,
      productionCountries: current?.productionCountries ?? [],
      upstreamUnknown: current?.upstreamUnknown ?? true,
      ...fromFile,
    });
    if ("errors" in merged) throw appError("INVALID_INPUT");
    return merged.value;
  };

  if (decision === "create") {
    let profile;
    try {
      profile = await checkedProfile(ctx, {
        name,
        registryOrgNumber,
        externalKey,
        registeredCountry,
        ...(industryCode && batch.industryCodeSystem && { industryCodeSystem: batch.industryCodeSystem, industryCode }),
      });
    } catch (error) {
      // Noen har opprettet leverandøren etter at grunnlaget ble laget.
      const code = error instanceof ConvexError ? (error.data as { code?: string }).code : undefined;
      if (code === "SUPPLIER_EXISTS" || code === "SUPPLIER_KEY_EXISTS") return { outcome: "conflict" };
      throw error;
    }
    const supplierId = await ctx.db.insert("suppliers", {
      organizationId,
      ...profile,
      nameKey: nameKey(profile.name),
      status: "active",
      rowVersion: 1,
      createdAt: Date.now(),
      createdBy: userId,
    });
    if (hasPeriodData) {
      await ctx.db.insert("supplierPeriods", { organizationId, supplierId, reportingPeriodId: batch.reportingPeriodId, ...periodData(null), ...meta });
    }
    return { outcome: "created", supplierId };
  }

  const candidate = entry.candidates.find((c) => c.supplierId === (entry.targetSupplierId ?? entry.candidates[0]?.supplierId));
  if (!candidate) throw appError("INVALID_INPUT");
  let supplier;
  try {
    supplier = await getOwned(ctx, "suppliers", candidate.supplierId);
  } catch {
    return { outcome: "conflict" };
  }
  const current = await periodRow(ctx, supplier._id, batch.reportingPeriodId);
  // Leverandøren eller innkjøpsdataene er endret etter at grunnlaget ble laget: krever ny gjennomgang.
  if (supplier.rowVersion !== candidate.rowVersion || (current?.rowVersion ?? 0) !== candidate.periodRowVersion) {
    return { outcome: "conflict", supplierId: supplier._id };
  }
  const changed =
    (fromFile.spendOre !== undefined && fromFile.spendOre !== current?.spendOre) ||
    (fromFile.purchaseCategory !== undefined && fromFile.purchaseCategory !== current?.purchaseCategory) ||
    (fromFile.purchaseDescription !== undefined && fromFile.purchaseDescription !== current?.purchaseDescription);
  if (!changed) return { outcome: "unchanged", supplierId: supplier._id };
  if (current) {
    await ctx.db.patch("supplierPeriods", current._id, { ...periodData(current), ...meta, rowVersion: current.rowVersion + 1 });
  } else {
    await ctx.db.insert("supplierPeriods", {
      organizationId,
      supplierId: supplier._id,
      reportingPeriodId: batch.reportingPeriodId,
      ...periodData(null),
      ...meta,
    });
  }
  return { outcome: "updated", supplierId: supplier._id, previousSpendOre: current?.spendOre };
}

const COUNTERS = { created: "created", updated: "updated", unchanged: "unchanged", skipped: "skipped", conflict: "conflicts" } as const;

/**
 * Gjennomfører neste stykke av en bekreftet import, i én transaksjon. Kalles
 * til `done` er sann. Pekeren på batchen leses og flyttes i samme transaksjon,
 * så to samtidige kall aldri behandler samme oppføring. Feiler stykket, rulles
 * det tilbake, og batchen står som «committing» med det som er gjort.
 */
export const commitChunk = tenantMutation({
  args: { batchId: v.string() },
  returns: v.object({ done: v.boolean(), processed: v.number(), entryCount: v.number(), result: resultValidator }),
  handler: async (ctx, { batchId }) => {
    const { organizationId, userId } = ctx.tenant;
    const batch = await ownedBatch(ctx, batchId);
    const state = (b: Pick<Batch, "processed" | "entryCount" | "result">, done: boolean) => ({
      done,
      processed: b.processed,
      entryCount: b.entryCount,
      result: b.result,
    });
    if (batch.status === "committed") return state(batch, true);
    if (batch.status !== "committing") throw appError("CONFLICT");

    const next = await ctx.db
      .query("importRows")
      .withIndex("by_organizationId_and_batchId_and_rowNumber", (q) =>
        q.eq("organizationId", organizationId).eq("batchId", batch._id).gte("rowNumber", batch.nextRowNumber),
      )
      .take(ENTRIES_PER_COMMIT + 1);
    const entries = next.slice(0, ENTRIES_PER_COMMIT);
    const result = { ...batch.result };
    for (const entry of entries) {
      const applied = await apply(ctx, batch, entry);
      await ctx.db.patch("importRows", entry._id, applied);
      result[COUNTERS[applied.outcome!]]++;
    }
    const done = next.length <= ENTRIES_PER_COMMIT;
    const changes = {
      nextRowNumber: entries.length > 0 ? entries[entries.length - 1].rowNumber + 1 : batch.nextRowNumber,
      processed: batch.processed + entries.length,
      result,
      ...(done && { status: "committed" as const, committedAt: Date.now() }),
    };
    await ctx.db.patch("importBatches", batch._id, changes);
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "user", id: userId },
      eventType: "import.applied",
      entityType: "importBatch",
      entityId: batch._id,
      before: { status: batch.status, processed: batch.processed, ...batch.result },
      after: { status: changes.status ?? batch.status, processed: changes.processed, ...result },
    });
    return state({ ...batch, ...changes }, done);
  },
});
