import { v } from "convex/values";
import type { ExistingSupplier } from "../../../src/domain/import/match";
import { proposeMatches } from "../../../src/domain/import/match";
import { buildEntries, entryKind, fingerprint, type EntryKind } from "../../../src/domain/import/plan";
import { parseImport } from "../../../src/domain/import/preview";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { tenantAction } from "../../lib/tenantAction";
import { industryCodeSystemValidator } from "../validators";
import { columnMappingValidator, decimalFormatValidator, delimiterValidator } from "./validators";

type SupplierPage = { page: ExistingSupplier[]; isDone: boolean; continueCursor: string };
/** Oppføringer per intern mutasjon. Hver oppføring leser høyst fem leverandører med innkjøpsdata. */
const ENTRIES_PER_CALL = 200;

async function sha256(data: ArrayBuffer | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const prepareResult = v.union(
  v.object({ status: v.literal("rejected"), message: v.string() }),
  v.object({ status: v.literal("ok"), batchId: v.id("importBatches") }),
);

/**
 * Lager et importgrunnlag fra en CSV-fil for en rapportperiode: filen leses og
 * normaliseres på nytt her, rader for samme leverandør slås sammen, og de
 * normaliserte oppføringene lagres som et utkast brukeren går gjennom.
 *
 * Filen selv lagres aldri og logges aldri. Ingen leverandørdata endres før
 * brukeren bekrefter importen.
 */
export const prepare = tenantAction({
  args: {
    file: v.bytes(),
    fileName: v.string(),
    reportingPeriodId: v.string(),
    delimiter: v.optional(delimiterValidator),
    mapping: v.optional(columnMappingValidator),
    decimal: v.optional(decimalFormatValidator),
    industryCodeSystem: v.optional(industryCodeSystemValidator),
  },
  returns: prepareResult,
  handler: async (ctx, { file, fileName, reportingPeriodId, ...options }) => {
    const { organizationId, userId } = ctx.tenant;
    const parsed = parseImport(file, options);
    if ("rejected" in parsed) return { status: "rejected" as const, message: parsed.rejected.message };
    if (parsed.problems.length > 0) return { status: "rejected" as const, message: parsed.problems[0] };

    const existing: ExistingSupplier[] = [];
    let cursor: string | null = null;
    let done = false;
    while (!done) {
      const page: SupplierPage = await ctx.runQuery(internal.suppliers.import.internal.suppliersForMatching, {
        organizationId,
        paginationOpts: { numItems: 500, cursor },
      });
      existing.push(...page.page);
      [cursor, done] = [page.continueCursor, page.isDone];
    }

    const entries = buildEntries(parsed.rows);
    const { delimiter, mapping, decimal, industryCodeSystem } = parsed;
    // Fingeravtrykket tas før matchingen, så det bare avhenger av filen og valgene, ikke av hva som finnes fra før.
    const normalizedHash = await sha256(fingerprint(entries, { delimiter, mapping, decimal, industryCodeSystem }));
    const matches = proposeMatches(entries, existing);
    const kindCounts: Record<EntryKind, number> = { new_clean: 0, new_warning: 0, known: 0, unclear: 0, error: 0 };
    const stored = entries.map((entry, i) => {
      const match = matches[i];
      const kind = entryKind(entry, match);
      kindCounts[kind]++;
      return {
        rowNumber: entry.rowNumber,
        sourceRows: entry.sourceRows,
        sourceRowCount: entry.sourceRowCount,
        values: entry.values,
        issues: entry.issues,
        kind,
        matchKind: match.kind,
        candidateIds: "suppliers" in match ? match.suppliers.map((s) => s.id) : [],
      };
    });

    const created: { batchId: Id<"importBatches">; reused: boolean } = await ctx.runMutation(internal.suppliers.import.store.createBatch, {
      organizationId,
      userId,
      reportingPeriodId,
      fileName: fileName.slice(0, 200),
      fileHash: await sha256(file),
      normalizedHash,
      mapping,
      industryCodeSystem,
      rowCount: parsed.rowCount,
      entryCount: stored.length,
    });
    if (created.reused) return { status: "ok" as const, batchId: created.batchId };

    for (let i = 0; i < stored.length; i += ENTRIES_PER_CALL) {
      await ctx.runMutation(internal.suppliers.import.store.addEntries, {
        organizationId,
        batchId: created.batchId,
        entries: stored.slice(i, i + ENTRIES_PER_CALL),
      });
    }
    await ctx.runMutation(internal.suppliers.import.store.finalizeBatch, { organizationId, userId, batchId: created.batchId, kindCounts });
    return { status: "ok" as const, batchId: created.batchId };
  },
});
