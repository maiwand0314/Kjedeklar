import { v } from "convex/values";
import { tenantMutation } from "../lib/tenant";
import { enqueueJob } from "./model";

/**
 * Oppretter en bakgrunnsjobb i valgt organisasjon. Typen må være en tillatt
 * jobbtype, og `inputRef` må være et dokument i organisasjonen. To kall med
 * samme type og `idempotencyKey` gir samme jobb, og den kjøres én gang.
 */
export const enqueue = tenantMutation({
  args: { type: v.string(), inputRef: v.string(), idempotencyKey: v.string() },
  returns: v.object({ jobId: v.id("jobs"), created: v.boolean() }),
  handler: async (ctx, args) => await enqueueJob(ctx, args),
});
