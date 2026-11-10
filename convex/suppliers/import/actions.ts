import { v, type Infer } from "convex/values";
import type { ExistingSupplier } from "../../../src/domain/import/match";
import { matchImport, parseImport } from "../../../src/domain/import/preview";
import { internal } from "../../_generated/api";
import { tenantAction } from "../../lib/tenantAction";
import { industryCodeSystemValidator } from "../validators";
import { columnMappingValidator, decimalFormatValidator, delimiterValidator, previewResultValidator } from "./validators";

type PreviewResult = Infer<typeof previewResultValidator>;
type SupplierPage = { page: ExistingSupplier[]; isDone: boolean; continueCursor: string };

/**
 * Leser en CSV-fil og returnerer en forhåndsvisning: normaliserte verdier,
 * avklaringer per rad og forslag til matching mot egne leverandører.
 *
 * Endrer ingenting. Filen finnes bare i minnet mens actionen kjører: den lagres
 * ikke i tabeller eller fillagring, og innholdet skrives aldri til logg.
 * Grensene (2 MiB og 2 000 rader) håndheves her, uavhengig av klienten.
 */
export const preview = tenantAction({
  args: {
    file: v.bytes(),
    delimiter: v.optional(delimiterValidator),
    mapping: v.optional(columnMappingValidator),
    decimal: v.optional(decimalFormatValidator),
    industryCodeSystem: v.optional(industryCodeSystemValidator),
  },
  returns: previewResultValidator,
  handler: async (ctx, { file, ...options }): Promise<PreviewResult> => {
    const parsed = parseImport(file, options);
    if ("rejected" in parsed) return { status: "rejected", ...parsed.rejected };

    // shortcut: henter alle leverandørene i organisasjonen for å foreslå matching i minnet,
    // bytt til indeksoppslag per rad hvis en kunde får titusenvis av leverandører.
    const existing: ExistingSupplier[] = [];
    let cursor: string | null = null;
    let done = parsed.rows.length === 0;
    while (!done) {
      const page: SupplierPage = await ctx.runQuery(internal.suppliers.import.internal.suppliersForMatching, {
        organizationId: ctx.tenant.organizationId,
        paginationOpts: { numItems: 500, cursor },
      });
      existing.push(...page.page);
      [cursor, done] = [page.continueCursor, page.isDone];
    }
    return { status: "ok", ...parsed, ...matchImport(parsed.rows, existing) };
  },
});
