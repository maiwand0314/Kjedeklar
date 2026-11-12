/**
 * Kontrollert jobbtype for tester («test.probe»). Den kan bare opprettes på
 * lokale testmiljø. `inputRef` er en leverandør, og leverandørens egen ID
 * styrer hva som skjer:
 *
 * - `jobtest:fail-N`: de N første forsøkene feiler
 * - `jobtest:fail-always`: alle forsøk feiler
 * - `jobtest:fatal`: feil som ikke skal prøves på nytt
 * - `jobtest:crash`: uventet feil uten kode
 * - `jobtest:bad-output`: resultat i feil form
 * - alt annet: jobben lykkes
 */
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "../_generated/api";
import { internalQuery } from "../_generated/server";
import { JobError, type JobHandler } from "./types";

/** Styringsverdien for en testjobb. Kalles bare fra testhandleren, med organisasjonen fra den lagrede jobben. */
export const probeControl = internalQuery({
  args: { organizationId: v.id("organizations"), supplierId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { organizationId, supplierId }) => {
    const id = ctx.db.normalizeId("suppliers", supplierId);
    const supplier = id && (await ctx.db.get("suppliers", id));
    return supplier?.organizationId === organizationId ? (supplier.externalKey ?? null) : null;
  },
});

export const probeHandler: JobHandler<{ echoed: string }> = {
  table: "suppliers",
  // Korte grenser, så tester kan se alle forsøkene uten å vente lenge.
  retry: { maxAttempts: 3, initialBackoffMs: 100, base: 2 },
  testOnly: true,
  output: z.object({ echoed: z.string() }),
  run: async (ctx, { organizationId, inputRef, attempt }) => {
    const control: string | null = await ctx.runQuery(internal.jobs.testHandler.probeControl, { organizationId, supplierId: inputRef });
    const failures = /^jobtest:fail-(\d+|always)$/.exec(control ?? "")?.[1];
    if (failures === "always" || (failures && attempt <= Number(failures))) throw new JobError("PROBE_FAILED");
    if (control === "jobtest:fatal") throw new JobError("PROBE_FATAL", false);
    if (control === "jobtest:crash") throw new TypeError("Uventet feil i testhandleren");
    if (control === "jobtest:bad-output") return { wrong: true };
    return { echoed: inputRef };
  },
};
