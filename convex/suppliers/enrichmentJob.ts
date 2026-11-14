/**
 * Jobbtypen «brreg.enrich»: slår opp en leverandørs norske org.nr. i
 * Enhetsregisteret og lagrer et minimalt snapshot. Handleren endrer aldri
 * leverandørens profil; registerverdiene blir forslag brukeren bekrefter
 * (enrichment.ts). Se beslutning 0011.
 *
 * - Oppslaget gjøres i en action, med én henting per forsøk (`retries: 0`):
 *   køen står for nye forsøk, med lengre ventetid enn adapteren ville brukt.
 * - Forbigående feil (timeout, 429, 5xx, nett) kan prøves på nytt; en kontrakt
 *   som ikke stemmer prøves ikke på nytt. Etter siste forsøk får leverandøren
 *   status «failed» (`onFailed`), og alt annet i importen er urørt.
 * - Resultatet skrives i samme mutasjon som setter jobben til fullført.
 */
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, type MutationCtx } from "../_generated/server";
import { registryProfileSchema } from "../../src/domain/brreg/enhet";
import { fetchEnhet } from "../integrations/brreg/client";
import { JobError, type JobHandler } from "../jobs/types";
import { writeAudit } from "../lib/audit";

/** Organisasjonsnummeret jobben skal slå opp. Organisasjonen kommer fra den lagrede jobben, aldri fra klienten. */
export const orgNumberFor = internalQuery({
  args: { organizationId: v.id("organizations"), supplierId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { organizationId, supplierId }) => {
    const id = ctx.db.normalizeId("suppliers", supplierId);
    const supplier = id && (await ctx.db.get("suppliers", id));
    return supplier && supplier.organizationId === organizationId ? (supplier.registryOrgNumber ?? null) : null;
  },
});

const outputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("found"),
    orgNumber: z.string(),
    profile: registryProfileSchema,
    fetchedAt: z.number(),
    payloadHash: z.string(),
    mappingVersion: z.string(),
  }),
  z.object({ kind: z.enum(["not_found", "removed"]), orgNumber: z.string() }),
]);
type Output = z.infer<typeof outputSchema>;

const RETRYABLE_CODES = { timeout: "BRREG_TIMEOUT", rate_limited: "BRREG_RATE_LIMITED", server_error: "BRREG_UNAVAILABLE", network: "BRREG_UNAVAILABLE" } as const;

/** Én vurdering av om jobbens svar fortsatt gjelder: leverandøren skal peke på akkurat denne jobben. */
const supplierOf = async (ctx: MutationCtx, job: Doc<"jobs">) => {
  const id = ctx.db.normalizeId("suppliers", job.inputRef);
  const supplier = id && (await ctx.db.get("suppliers", id));
  return supplier && supplier.organizationId === job.organizationId && supplier.registryEnrichment?.jobId === job._id ? supplier : null;
};

export const brregEnrichHandler: JobHandler<Output> = {
  table: "suppliers",
  // Tre ventetider på 30 sekunder, 2 og 8 minutter. Mer enn det er ikke til hjelp for en bruker som venter.
  retry: { maxAttempts: 4, initialBackoffMs: 30_000, base: 4 },
  output: outputSchema,
  run: async (ctx, { organizationId, inputRef }) => {
    const orgNumber: string | null = await ctx.runQuery(internal.suppliers.enrichmentJob.orgNumberFor, { organizationId, supplierId: inputRef });
    if (!orgNumber) throw new JobError("NO_ORG_NUMBER", false);
    const result = await fetchEnhet(orgNumber, { retries: 0, timeoutMs: 8000 });
    switch (result.kind) {
      case "found":
        return { kind: "found", orgNumber, profile: result.profile, fetchedAt: result.fetchedAt, payloadHash: result.payloadHash, mappingVersion: result.mappingVersion };
      case "not_found":
      case "invalid": // Brreg avviser nummeret; det finnes ikke noe å hente.
        return { kind: "not_found", orgNumber };
      case "removed":
        return { kind: "removed", orgNumber };
      case "unavailable":
        throw new JobError(RETRYABLE_CODES[result.reason]);
      case "contract_changed":
        throw new JobError("BRREG_CONTRACT_CHANGED", false);
    }
  },
  apply: async (ctx, job, output) => {
    const supplier = await supplierOf(ctx, job);
    // Overstyrt av en nyere forespørsel, eller org.nr. er endret mens jobben gikk: svaret skrives ikke.
    if (!supplier?.registryEnrichment || supplier.registryOrgNumber !== output.orgNumber) return;
    const now = Date.now();
    // En tidligere feilkode hører ikke til dette svaret.
    const previous = { ...supplier.registryEnrichment, errorCode: undefined };
    let next: NonNullable<Doc<"suppliers">["registryEnrichment"]>;
    if (output.kind === "found") {
      const snapshotId: Id<"registrySnapshots"> = await ctx.db.insert("registrySnapshots", {
        organizationId: job.organizationId,
        supplierId: supplier._id,
        source: "brreg-enhetsregisteret",
        orgNumber: output.orgNumber,
        fetchedAt: output.fetchedAt,
        fetchedBy: job.createdBy,
        selectedFields: output.profile,
        sourcePayloadHash: output.payloadHash,
        mappingVersion: output.mappingVersion,
        status: "fetched",
      });
      next = { ...previous, state: "succeeded", finishedAt: now, snapshotId, fetchedAt: output.fetchedAt };
    } else {
      next = { ...previous, state: output.kind, finishedAt: now };
    }
    await ctx.db.patch("suppliers", supplier._id, { registryEnrichment: next });
    await writeAudit(ctx, {
      organizationId: job.organizationId,
      actor: { type: "system" },
      eventType: "supplier.registry_fetched",
      entityType: "supplier",
      entityId: supplier._id,
      before: { registryState: supplier.registryEnrichment.state, registrySnapshotId: supplier.registryEnrichment.snapshotId },
      after: { registryState: next.state, registrySnapshotId: next.snapshotId },
    });
  },
  onFailed: async (ctx, job, errorCode) => {
    const supplier = await supplierOf(ctx, job);
    if (!supplier?.registryEnrichment) return;
    const next = { ...supplier.registryEnrichment, state: "failed" as const, finishedAt: Date.now(), errorCode };
    await ctx.db.patch("suppliers", supplier._id, { registryEnrichment: next });
    await writeAudit(ctx, {
      organizationId: job.organizationId,
      actor: { type: "system" },
      eventType: "supplier.registry_fetched",
      entityType: "supplier",
      entityId: supplier._id,
      reason: errorCode,
      before: { registryState: supplier.registryEnrichment.state, registrySnapshotId: supplier.registryEnrichment.snapshotId },
      after: { registryState: "failed", registrySnapshotId: next.snapshotId },
    });
  },
};
