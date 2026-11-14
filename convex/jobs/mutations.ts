import { v } from "convex/values";
import { appError } from "../lib/errors";
import { tenantMutation } from "../lib/tenant";
import { jobHandler } from "./handlers";
import { enqueueJob } from "./model";

/**
 * Oppretter en testjobb i valgt organisasjon. Bare testtyper kan opprettes
 * herfra; jobber for produksjon opprettes av egne tenantmutasjoner (som
 * `suppliers/enrichment:request`) via `enqueueJob`, så kontrollene der ikke
 * kan omgås. To kall med samme type og `idempotencyKey` gir samme jobb.
 */
export const enqueue = tenantMutation({
  args: { type: v.string(), inputRef: v.string(), idempotencyKey: v.string() },
  returns: v.object({ jobId: v.id("jobs"), created: v.boolean() }),
  handler: async (ctx, args) => {
    if (!jobHandler(args.type)?.testOnly) throw appError("INVALID_INPUT");
    return await enqueueJob(ctx, args);
  },
});
