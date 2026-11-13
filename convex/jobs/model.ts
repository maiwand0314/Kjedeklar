import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { writeAudit } from "../lib/audit";
import { appError } from "../lib/errors";
import { getOwned, type Tenant } from "../lib/tenant";
import { assertLocalEnv } from "../ops/guard";
import { jobHandler } from "./handlers";
import { jobPool } from "./pool";

/** Tenantmutasjonens kontekst: verifisert tenant og innpakket db. */
type Ctx = Pick<MutationCtx, "db" | "runMutation" | "runQuery" | "scheduler"> & { tenant: Tenant };

/** Det som kan stå i revisjonsloggen om en jobb. */
export const jobSnapshot = (job: { type: string; status: string; attempts: number; maxAttempts: number; errorCode?: string }) => ({
  type: job.type,
  status: job.status,
  attempts: job.attempts,
  maxAttempts: job.maxAttempts,
  errorCode: job.errorCode,
});

/**
 * Oppretter en bakgrunnsjobb i gjeldende organisasjon og legger den i køen.
 * Kalles fra tenantmutasjoner.
 *
 * - Typen må stå i listen over tillatte handlere.
 * - `inputRef` lastes med getOwned i tabellen typen arbeider på.
 * - Samme (organisasjon, type, idempotencyKey) gir den samme jobben tilbake,
 *   uten ny kjøring. Oppslaget og innsettingen skjer i samme transaksjon.
 *   Brukes nøkkelen for et annet dokument, avvises kallet.
 */
export async function enqueueJob(
  ctx: Ctx,
  { type, inputRef, idempotencyKey }: { type: string; inputRef: string; idempotencyKey: string },
): Promise<{ jobId: Id<"jobs">; created: boolean }> {
  const { organizationId, userId } = ctx.tenant;
  const handler = jobHandler(type);
  if (!handler || !/^\S.{0,199}$/.test(idempotencyKey)) throw appError("INVALID_INPUT");
  if (handler.testOnly) {
    try {
      assertLocalEnv(["test"]);
    } catch {
      // Testtypen finnes ikke utenfor lokale testmiljø: samme svar som for en ukjent type.
      throw appError("INVALID_INPUT");
    }
  }
  const input = await getOwned(ctx, handler.table, inputRef);
  const existing = await ctx.db
    .query("jobs")
    .withIndex("by_organizationId_and_type_and_idempotencyKey", (q) =>
      q.eq("organizationId", organizationId).eq("type", type).eq("idempotencyKey", idempotencyKey),
    )
    .unique();
  if (existing) {
    // Samme nøkkel for et annet dokument er ikke et nytt forsøk på samme jobb, men en forveksling.
    if (existing.inputRef !== input._id) throw appError("CONFLICT");
    return { jobId: existing._id, created: false };
  }

  const now = Date.now();
  const job = {
    organizationId,
    type,
    inputRef: input._id as string,
    idempotencyKey,
    status: "queued" as const,
    attempts: 0,
    maxAttempts: handler.retry.maxAttempts,
    runAfter: now,
    createdAt: now,
    createdBy: userId,
  };
  const jobId = await ctx.db.insert("jobs", job);
  // Køen får bare jobb-id-en. Handleren henter tenant og referanse fra den lagrede jobben.
  await jobPool.enqueueAction(ctx, internal.jobs.run.run, { jobId }, {
    retry: handler.retry,
    onComplete: internal.jobs.internal.completed,
    context: { jobId },
  });
  await writeAudit(ctx, {
    organizationId,
    actor: { type: "user", id: userId },
    eventType: "job.created",
    entityType: "job",
    entityId: jobId,
    after: jobSnapshot(job),
  });
  return { jobId, created: true };
}
