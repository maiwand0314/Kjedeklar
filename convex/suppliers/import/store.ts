/**
 * Lagrer et importgrunnlag. Kalles bare fra prepare-actionen, med
 * `organizationId` og `userId` fra verifisert tenant. Det som lagres er
 * normaliserte oppføringer, aldri filen. Alle id-er som kommer inn, kontrolleres
 * mot organisasjonen her, i samme transaksjon som lagrer dem.
 */
import { v } from "convex/values";
import { IMPORT_MAPPING_VERSION, IMPORT_TTL_MS } from "../../../src/domain/import/plan";
import type { Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { writeAudit } from "../../lib/audit";
import { notFound } from "../../lib/errors";
import { industryCodeSystemValidator } from "../validators";
import {
  columnMappingValidator,
  entryKindValidator,
  importValuesValidator,
  issueValidator,
  kindCountsValidator,
  matchKindValidator,
} from "./validators";

/** Laster et dokument og krever at det tilhører organisasjonen. Samme avslag for ukjent, fremmed og feil tabell. */
async function owned<T extends "reportingPeriods" | "importBatches" | "suppliers">(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  table: T,
  id: string,
) {
  const normalized = ctx.db.normalizeId(table, id);
  const doc = normalized && (await ctx.db.get(table, normalized));
  if (!doc || doc.organizationId !== organizationId) throw notFound();
  return doc;
}

const EMPTY_RESULT = { created: 0, updated: 0, unchanged: 0, skipped: 0, conflicts: 0 };
const EMPTY_COUNTS = { new_clean: 0, new_warning: 0, known: 0, unclear: 0, error: 0 };

/**
 * Oppretter grunnlaget, eller gir tilbake et som finnes: samme fil, valg og
 * periode som et utkast eller en import som pågår, gir samme batch. Da blir et
 * dobbeltklikk eller et nytt forsøk ikke to importer.
 */
export const createBatch = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
    reportingPeriodId: v.string(),
    fileName: v.string(),
    fileHash: v.string(),
    normalizedHash: v.string(),
    mapping: columnMappingValidator,
    industryCodeSystem: v.optional(industryCodeSystemValidator),
    rowCount: v.number(),
    entryCount: v.number(),
  },
  returns: v.object({ batchId: v.id("importBatches"), reused: v.boolean() }),
  handler: async (ctx, { organizationId, userId, reportingPeriodId, ...file }) => {
    const period = await owned(ctx, organizationId, "reportingPeriods", reportingPeriodId);
    const idempotencyKey = `${period._id}:${file.normalizedHash}`;
    const now = Date.now();
    const same = await ctx.db
      .query("importBatches")
      .withIndex("by_organizationId_and_idempotencyKey", (q) => q.eq("organizationId", organizationId).eq("idempotencyKey", idempotencyKey))
      .order("desc")
      .take(10);
    const current = same.find(
      (b) => b.status === "committing" || (b.status === "draft" && b.expiresAt > now && b.mappingVersion === IMPORT_MAPPING_VERSION),
    );
    if (current) return { batchId: current._id, reused: true };
    const batchId = await ctx.db.insert("importBatches", {
      organizationId,
      reportingPeriodId: period._id,
      status: "preparing",
      idempotencyKey,
      mappingVersion: IMPORT_MAPPING_VERSION,
      ...file,
      kindCounts: EMPTY_COUNTS,
      policy: {},
      rowVersion: 1,
      createdAt: now,
      createdBy: userId,
      expiresAt: now + IMPORT_TTL_MS,
      repeatsBatchId: same.find((b) => b.status === "committed")?._id,
      nextRowNumber: 0,
      processed: 0,
      result: EMPTY_RESULT,
    });
    return { batchId, reused: false };
  },
});

/**
 * Legger oppføringer til et grunnlag som er under oppretting. For hver mulig
 * leverandør lagres versjonen den har nå, så bekreftelsen kan oppdage at
 * leverandøren er endret etter at grunnlaget ble laget.
 */
export const addEntries = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    batchId: v.id("importBatches"),
    entries: v.array(
      v.object({
        rowNumber: v.number(),
        sourceRows: v.array(v.number()),
        sourceRowCount: v.number(),
        values: importValuesValidator,
        issues: v.array(issueValidator),
        kind: entryKindValidator,
        matchKind: matchKindValidator,
        candidateIds: v.array(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { organizationId, batchId, entries }) => {
    const batch = await owned(ctx, organizationId, "importBatches", batchId);
    if (batch.status !== "preparing") throw notFound();
    for (const { candidateIds, ...entry } of entries) {
      const candidates = [];
      for (const id of candidateIds) {
        const supplier = await owned(ctx, organizationId, "suppliers", id);
        const period = await ctx.db
          .query("supplierPeriods")
          .withIndex("by_organizationId_and_supplierId_and_reportingPeriodId", (q) =>
            q.eq("organizationId", organizationId).eq("supplierId", supplier._id).eq("reportingPeriodId", batch.reportingPeriodId),
          )
          .unique();
        candidates.push({ supplierId: supplier._id, rowVersion: supplier.rowVersion, periodRowVersion: period?.rowVersion ?? 0 });
      }
      await ctx.db.insert("importRows", { organizationId, batchId: batch._id, ...entry, candidates });
    }
    return null;
  },
});

/** Alle oppføringene er lagret: grunnlaget blir et utkast brukeren kan gå gjennom. */
export const finalizeBatch = internalMutation({
  args: { organizationId: v.id("organizations"), userId: v.string(), batchId: v.id("importBatches"), kindCounts: kindCountsValidator },
  returns: v.null(),
  handler: async (ctx, { organizationId, userId, batchId, kindCounts }) => {
    const batch = await owned(ctx, organizationId, "importBatches", batchId);
    if (batch.status !== "preparing") throw notFound();
    const changes = { status: "draft" as const, kindCounts };
    await ctx.db.patch("importBatches", batch._id, changes);
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "user", id: userId },
      eventType: "import.created",
      entityType: "importBatch",
      entityId: batch._id,
      after: { ...changes, rowCount: batch.rowCount, entryCount: batch.entryCount },
    });
    return null;
  },
});
