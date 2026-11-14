/**
 * Interne jobbfunksjoner: start av et forsøk, registrering av feil, skriving
 * av resultat og sluttstatus. De kan ikke kalles fra klienter. Hver av dem
 * laster jobben på nytt og tar organisasjonen fra den lagrede jobben, og
 * `inputRef` kontrolleres med getOwned før arbeid og før resultat.
 *
 * Actions er ikke «nøyaktig én gang»: de kan kjøre flere ganger, og et svar kan
 * komme etter at jobben er ferdig. Derfor endrer ingen av funksjonene en jobb
 * som allerede har sluttstatus, og resultatet skrives høyst én gang.
 */
import { vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { writeAudit } from "../lib/audit";
import { getOwned } from "../lib/tenant";
import { jobHandler } from "./handlers";
import { jobSnapshot } from "./model";

type Job = Doc<"jobs">;
const isFinal = (job: Job) => job.status === "succeeded" || job.status === "failed";

/** Setter sluttstatus og logger den. Gjør ingenting hvis jobben alt er ferdig. */
async function finish(ctx: MutationCtx, job: Job, status: "succeeded" | "failed", errorCode?: string) {
  if (isFinal(job)) return;
  const changes = { status, errorCode, finishedAt: Date.now() };
  await ctx.db.patch("jobs", job._id, changes);
  await writeAudit(ctx, {
    organizationId: job.organizationId,
    actor: { type: "system" },
    eventType: status === "succeeded" ? "job.succeeded" : "job.failed",
    entityType: "job",
    entityId: job._id,
    before: jobSnapshot(job),
    after: jobSnapshot({ ...job, ...changes }),
  });
  if (status === "failed") await jobHandler(job.type)?.onFailed?.(ctx, job, errorCode ?? "UNEXPECTED");
}

/** Handleren og referansen jobben gjelder, eller en feilkode når jobben ikke kan kjøres. */
async function resolve(ctx: MutationCtx, job: Job) {
  const handler = jobHandler(job.type);
  if (!handler) return { errorCode: "UNKNOWN_HANDLER" } as const;
  try {
    // Tenant fra den lagrede jobben: referansen må fortsatt tilhøre jobbens organisasjon.
    await getOwned({ db: ctx.db, tenant: { organizationId: job.organizationId } }, handler.table, job.inputRef);
  } catch {
    return { errorCode: "INPUT_NOT_FOUND" } as const;
  }
  return { handler };
}

/**
 * Starter et forsøk. Gir handleren det den trenger, eller null når jobben ikke
 * skal kjøres: den er ferdig, forsøkene er brukt opp, typen er ukjent, eller
 * referansen finnes ikke lenger i jobbens organisasjon.
 */
export const begin = internalMutation({
  args: { jobId: v.id("jobs") },
  returns: v.union(
    v.null(),
    v.object({ organizationId: v.id("organizations"), type: v.string(), inputRef: v.string(), attempt: v.number() }),
  ),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("jobs", jobId);
    if (!job || isFinal(job)) return null;
    const resolved = await resolve(ctx, job);
    const errorCode = resolved.errorCode ?? (job.attempts >= job.maxAttempts ? (job.errorCode ?? "MAX_ATTEMPTS") : undefined);
    if (errorCode) {
      await finish(ctx, job, "failed", errorCode);
      return null;
    }
    const attempt = job.attempts + 1;
    await ctx.db.patch("jobs", job._id, { status: "running", attempts: attempt });
    return { organizationId: job.organizationId, type: job.type, inputRef: job.inputRef, attempt };
  },
});

/**
 * Registrerer at et forsøk feilet, med feilkode og ventetid til neste forsøk.
 * Sluttstatus settes av `completed` når køen har gitt opp.
 */
export const attemptFailed = internalMutation({
  args: { jobId: v.id("jobs"), attempt: v.number(), errorCode: v.string() },
  returns: v.null(),
  handler: async (ctx, { jobId, attempt, errorCode }) => {
    const job = await ctx.db.get("jobs", jobId);
    // Et gammelt forsøk som melder fra etter at et nyere har startet, overskriver ikke.
    if (!job || isFinal(job) || job.attempts !== attempt) return null;
    const retry = jobHandler(job.type)?.retry;
    const backoff = retry ? retry.initialBackoffMs * retry.base ** (attempt - 1) : 0;
    await ctx.db.patch("jobs", job._id, { status: "queued", errorCode, runAfter: Date.now() + backoff });
    return null;
  },
});

/**
 * Skriver resultatet og setter jobben til fullført, i én transaksjon. Kalles
 * fra handlerens action. Gjør ingenting hvis jobben alt har sluttstatus, så et
 * forsøk som kjører to ganger ikke skriver to ganger.
 */
export const complete = internalMutation({
  args: { jobId: v.id("jobs"), output: v.any() },
  returns: v.null(),
  handler: async (ctx, { jobId, output }) => {
    const job = await ctx.db.get("jobs", jobId);
    if (!job || isFinal(job)) return null;
    const resolved = await resolve(ctx, job);
    if (resolved.errorCode) {
      await finish(ctx, job, "failed", resolved.errorCode);
      return null;
    }
    const parsed = resolved.handler.output.safeParse(output);
    if (!parsed.success) {
      await finish(ctx, job, "failed", "INVALID_OUTPUT");
      return null;
    }
    await resolved.handler.apply?.(ctx, job, parsed.data);
    await finish(ctx, { ...job, errorCode: undefined }, "succeeded");
    return null;
  },
});

/**
 * Kalles av køen når jobben er ferdig: etter et vellykket forsøk, etter siste
 * mislykkede forsøk, eller når den er avbrutt. Setter sluttstatus hvis jobben
 * ikke alt har en.
 */
export const completed = internalMutation({
  args: vOnCompleteArgs(v.object({ jobId: v.id("jobs") })),
  returns: v.null(),
  handler: async (ctx, { context, result }) => {
    const job = await ctx.db.get("jobs", context.jobId);
    if (!job) return null;
    if (result.kind === "failed") await finish(ctx, job, "failed", job.errorCode ?? "ACTION_FAILED");
    else if (result.kind === "canceled") await finish(ctx, job, "failed", "CANCELED");
    // Vellykket kjøring uten at resultatet ble skrevet skal ikke bli stående som «kjører».
    else await finish(ctx, job, "failed", "RESULT_MISSING");
    return null;
  },
});
