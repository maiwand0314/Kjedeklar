import { NonRetryableError } from "@convex-dev/workpool";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { jobHandler } from "./handlers";
import { JobError, type JobInput } from "./types";

/**
 * Kjører ett forsøk av en jobb. Køen kaller denne med bare jobb-id-en; tenant,
 * type og referanse hentes fra den lagrede jobben. Handleren velges fra listen
 * over tillatte typer. Feiler arbeidet, registreres feilkoden og feilen kastes
 * videre, så køen prøver på nytt etter ventetid til forsøkene er brukt opp.
 */
export const run = internalAction({
  args: { jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const started: (JobInput & { type: string }) | null = await ctx.runMutation(internal.jobs.internal.begin, { jobId });
    if (!started) return null;
    const { type, ...input } = started;
    try {
      const handler = jobHandler(type);
      if (!handler) throw new JobError("UNKNOWN_HANDLER", false);
      const output = await handler.run(ctx, input);
      await ctx.runMutation(internal.jobs.internal.complete, { jobId, output });
    } catch (error) {
      const known = error instanceof JobError ? error : undefined;
      const errorCode = known?.code ?? "UNEXPECTED";
      await ctx.runMutation(internal.jobs.internal.attemptFailed, { jobId, attempt: input.attempt, errorCode });
      // Bare koden kastes videre, så feilmeldinger med innhold ikke havner i køens logg.
      if (known && !known.retryable) throw new NonRetryableError(errorCode);
      throw new Error(errorCode);
    }
    return null;
  },
});
