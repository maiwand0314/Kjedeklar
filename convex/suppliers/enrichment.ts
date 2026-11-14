/**
 * Brreg-beriking av leverandører, sett fra brukeren: be om oppslag, se status
 * og godta registerforslag. Selve oppslaget er jobbtypen «brreg.enrich»
 * (enrichmentJob.ts) og opprettes bare herfra, via `enqueueJob`. Se beslutning 0011.
 */
import { v, type Infer } from "convex/values";
import { registryStateOf, registrySuggestions, type RegistrySuggestion } from "../../src/domain/suppliers/registry";
import { profileGaps } from "../../src/domain/brreg/enhet";
import { nameKey } from "../../src/domain/suppliers/supplier";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { enqueueJob } from "../jobs/model";
import { writeAudit } from "../lib/audit";
import { appError } from "../lib/errors";
import { getOwned, tenantMutation, tenantQuery, type Tenant } from "../lib/tenant";
import { registryProfileValidator } from "../organizations/registryValidators";
import { checkedProfile } from "./model";
import { registryStateValidator } from "./validators";

type Ctx = Pick<MutationCtx, "db" | "runMutation" | "runQuery" | "scheduler"> & { tenant: Tenant };

/** En henting som har stått i kø lenger enn dette regnes som tapt, og kan bes om på nytt. */
const QUEUED_STALE_MS = 30 * 60 * 1000;
/** Høyst så mange leverandører per «hent for alle», så mutasjonen holder seg godt innenfor Convex sine grenser. */
const BULK_LIMIT = 50;
/** Leverandører som leses per «hent for alle». Samme tall som importgrensen. */
const BULK_SCAN = 2000;

const stateAudit = (e: Doc<"suppliers">["registryEnrichment"]) => ({ registryState: e?.state, registrySnapshotId: e?.snapshotId });

/**
 * Oppretter en henting for leverandøren, eller gir den som alt pågår. Jobben
 * opprettes med `enqueueJob`; nøkkelen er leverandør og løpenummer, så to
 * samtidige forespørsler gir én jobb, mens en senere forespørsel gir en ny.
 */
async function requestOne(ctx: Ctx, supplier: Doc<"suppliers">) {
  const { organizationId, userId } = ctx.tenant;
  const orgNumber = supplier.registryOrgNumber;
  if (!orgNumber) throw appError("INVALID_INPUT");
  const now = Date.now();
  const current = supplier.registryEnrichment;
  if (current?.state === "queued" && current.orgNumber === orgNumber && now - current.requestedAt < QUEUED_STALE_MS) {
    return { jobId: current.jobId, created: false };
  }
  const sequence = (current?.sequence ?? 0) + 1;
  const { jobId } = await enqueueJob(ctx, { type: "brreg.enrich", inputRef: supplier._id, idempotencyKey: `${supplier._id}:${sequence}` });
  const next = {
    // Siste vellykkede henting beholdes mens en ny pågår.
    ...(current?.snapshotId && { snapshotId: current.snapshotId, fetchedAt: current.fetchedAt }),
    sequence,
    jobId,
    orgNumber,
    state: "queued" as const,
    requestedAt: now,
  };
  await ctx.db.patch("suppliers", supplier._id, { registryEnrichment: next });
  await writeAudit(ctx, {
    organizationId,
    actor: { type: "user", id: userId },
    eventType: "supplier.registry_requested",
    entityType: "supplier",
    entityId: supplier._id,
    before: stateAudit(current),
    after: stateAudit(next),
  });
  return { jobId, created: true };
}

/** Henter fra Enhetsregisteret for én leverandør med norsk org.nr. Leverandører uten org.nr. er ikke relevante og avvises. */
export const request = tenantMutation({
  args: { supplierId: v.string() },
  returns: v.object({ jobId: v.id("jobs"), created: v.boolean() }),
  handler: async (ctx, { supplierId }) => await requestOne(ctx, await getOwned(ctx, "suppliers", supplierId)),
});

/**
 * Henter for aktive leverandører med norsk org.nr. som ikke er hentet for det
 * nummeret ennå, høyst 50 om gangen. `moreAvailable` er sant når flere venter.
 * Leverandører som alt har fått et svar eller en feil, tas ikke med igjen;
 * de hentes på nytt hver for seg.
 */
export const requestMissing = tenantMutation({
  args: {},
  returns: v.object({ requested: v.number(), moreAvailable: v.boolean() }),
  handler: async (ctx) => {
    const suppliers = await ctx.db
      .query("suppliers")
      .withIndex("by_organizationId_and_status_and_nameKey", (q) => q.eq("organizationId", ctx.tenant.organizationId).eq("status", "active"))
      .take(BULK_SCAN);
    const missing = suppliers.filter((s) => registryStateOf(s) === "not_fetched");
    for (const supplier of missing.slice(0, BULK_LIMIT)) await requestOne(ctx, supplier);
    return { requested: Math.min(missing.length, BULK_LIMIT), moreAvailable: missing.length > BULK_LIMIT };
  },
});

const suggestionValidator = v.object({
  field: v.union(v.literal("name"), v.literal("registeredCountry"), v.literal("industryCode")),
  current: v.union(v.string(), v.null()),
  proposed: v.string(),
});

/** Status og registerforslag for én leverandør. Forslagene beregnes fra siste hentede snapshot mot profilen slik den er nå. */
export const get = tenantQuery({
  args: { supplierId: v.string() },
  returns: v.object({
    state: registryStateValidator,
    requestedAt: v.union(v.number(), v.null()),
    errorCode: v.union(v.string(), v.null()),
    fetchedAt: v.union(v.number(), v.null()),
    profile: v.union(registryProfileValidator, v.null()),
    gaps: v.array(v.string()),
    suggestions: v.array(suggestionValidator),
    industryCodeSource: v.union(v.object({ fetchedAt: v.number() }), v.null()),
  }),
  handler: async (ctx, { supplierId }) => {
    const supplier = await getOwned(ctx, "suppliers", supplierId);
    const state = registryStateOf(supplier);
    const enrichment = state === "not_applicable" || state === "not_fetched" ? undefined : supplier.registryEnrichment;
    // Siste vellykkede henting for dette org.nr. (kan stå igjen etter en senere feil).
    const snapshot =
      supplier.registryEnrichment?.orgNumber === supplier.registryOrgNumber && supplier.registryEnrichment?.snapshotId
        ? await getOwned(ctx, "registrySnapshots", supplier.registryEnrichment.snapshotId)
        : null;
    const profile = snapshot?.selectedFields ?? null;
    return {
      state,
      requestedAt: enrichment?.requestedAt ?? null,
      errorCode: enrichment?.errorCode ?? null,
      fetchedAt: snapshot?.fetchedAt ?? null,
      profile,
      gaps: profile ? profileGaps(profile) : [],
      suggestions: profile ? registrySuggestions(supplier, profile) : [],
      industryCodeSource: supplier.industryCodeSource ? { fetchedAt: supplier.industryCodeSource.fetchedAt } : null,
    };
  },
});

/**
 * Godtar ett registerforslag. Profilen endres bare her, etter en handling fra
 * brukeren, med versjonssjekk og revisjonslogg. `expectedValue` er forslaget
 * brukeren så; har registeret eller profilen endret seg, avvises godkjenningen.
 * Registeret oppgir ikke SN-versjon, så kodeverket for en næringskode velger
 * brukeren selv. Koden lagres med hvilket snapshot og hvilken hentetid den kom fra.
 */
export const applySuggestion = tenantMutation({
  args: {
    supplierId: v.string(),
    expectedRowVersion: v.number(),
    field: suggestionValidator.fields.field,
    expectedValue: v.string(),
    industryCodeSystem: v.optional(v.union(v.literal("SN2007"), v.literal("SN2025"))),
  },
  returns: v.object({ rowVersion: v.number() }),
  handler: async (ctx, args) => {
    const { organizationId, userId } = ctx.tenant;
    const supplier = await getOwned(ctx, "suppliers", args.supplierId);
    if (supplier.rowVersion !== args.expectedRowVersion) throw appError("CONFLICT");
    const e = supplier.registryEnrichment;
    if (!e || e.orgNumber !== supplier.registryOrgNumber || !e.snapshotId) throw appError("CONFLICT");
    const snapshot = await getOwned(ctx, "registrySnapshots", e.snapshotId);
    const suggestion: RegistrySuggestion | undefined = registrySuggestions(supplier, snapshot.selectedFields).find((s) => s.field === args.field);
    if (!suggestion || suggestion.proposed !== args.expectedValue) throw appError("CONFLICT");

    const raw = {
      name: supplier.name,
      registryOrgNumber: supplier.registryOrgNumber,
      externalKey: supplier.externalKey,
      registeredCountry: supplier.registeredCountry,
      industryCodeSystem: supplier.industryCodeSystem,
      industryCode: supplier.industryCode,
    };
    if (args.field === "name") raw.name = suggestion.proposed;
    if (args.field === "registeredCountry") raw.registeredCountry = suggestion.proposed;
    if (args.field === "industryCode") {
      if (!args.industryCodeSystem) throw appError("INVALID_INPUT");
      raw.industryCode = suggestion.proposed;
      raw.industryCodeSystem = args.industryCodeSystem;
    }
    const profile = await checkedProfile(ctx, raw, supplier._id);
    const changes = {
      name: profile.name,
      nameKey: nameKey(profile.name),
      registeredCountry: profile.registeredCountry,
      industryCodeSystem: profile.industryCodeSystem,
      industryCode: profile.industryCode,
      ...(args.field === "industryCode" && { industryCodeSource: { snapshotId: snapshot._id, fetchedAt: snapshot.fetchedAt } }),
      rowVersion: supplier.rowVersion + 1,
    };
    await ctx.db.patch("suppliers", supplier._id, changes);
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "user", id: userId },
      eventType: "supplier.updated",
      entityType: "supplier",
      entityId: supplier._id,
      reason: `Registerforslag godtatt: ${args.field}`,
      before: supplier,
      after: { ...supplier, ...changes },
    });
    return { rowVersion: changes.rowVersion };
  },
});

export type SuggestionView = Infer<typeof suggestionValidator>;
