import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { fetchEnhet } from "../integrations/brreg/client";
import { writeAudit } from "../lib/audit";
import { appError, notFound } from "../lib/errors";
import { getOwned, tenantMutation, tenantQuery } from "../lib/tenant";
import { tenantAction } from "../lib/tenantAction";
import { normalizeOrgNumber } from "../../src/domain/brreg/org-number";
import { profileGaps } from "../../src/domain/brreg/enhet";
import { registryProfileValidator } from "./registryValidators";

/** Et oppslag må bekreftes innen denne tiden, ellers må det gjøres på nytt. */
export const PREVIEW_MAX_AGE_MS = 30 * 60 * 1000;

const lookupResult = v.union(
  v.object({
    kind: v.literal("found"),
    snapshotId: v.id("registrySnapshots"),
    profile: registryProfileValidator,
    fetchedAt: v.number(),
    gaps: v.array(v.string()),
  }),
  v.object({ kind: v.literal("invalid_org_number") }),
  v.object({ kind: v.literal("not_found") }),
  v.object({ kind: v.literal("removed") }),
  v.object({ kind: v.literal("invalid") }),
  v.object({
    kind: v.literal("unavailable"),
    reason: v.union(v.literal("timeout"), v.literal("rate_limited"), v.literal("server_error"), v.literal("network")),
  }),
  v.object({ kind: v.literal("contract_changed") }),
);

/**
 * Slår opp org.nr. i Enhetsregisteret og lagrer en forhåndsvisning. Endrer ikke
 * organisasjonen; det skjer først i `confirm`. Registerfeil returneres som
 * resultat (ikke unntak), så siden kan vise en forståelig melding.
 */
export const lookup = tenantAction({
  args: { orgNumber: v.string() },
  returns: lookupResult,
  handler: async (ctx, args): Promise<Infer<typeof lookupResult>> => {
    const orgNumber = normalizeOrgNumber(args.orgNumber);
    if (!orgNumber) return { kind: "invalid_org_number" as const };
    const result = await fetchEnhet(orgNumber);
    if (result.kind !== "found") return result;
    const snapshotId: Id<"registrySnapshots"> = await ctx.runMutation(internal.organizations.registryInternal.storePreview, {
      organizationId: ctx.tenant.organizationId,
      fetchedBy: ctx.tenant.userId,
      fetchedAt: result.fetchedAt,
      profile: result.profile,
      payloadHash: result.payloadHash,
      mappingVersion: result.mappingVersion,
    });
    return {
      kind: "found" as const,
      snapshotId,
      profile: result.profile,
      fetchedAt: result.fetchedAt,
      gaps: profileGaps(result.profile),
    };
  },
});

/**
 * Bekrefter en forhåndsvisning. Lagring av opplysningene, snapshot-status og
 * revisjonslogg skjer i denne ene mutasjonen. `expectedCurrentSnapshotId` er
 * det brukeren så som gjeldende; har noen bekreftet noe annet i mellomtiden,
 * avvises bekreftelsen i stedet for å overskrive stille. Visningsnavnet endres
 * bare med `useRegistryName`.
 */
export const confirm = tenantMutation({
  args: {
    snapshotId: v.string(),
    expectedCurrentSnapshotId: v.union(v.string(), v.null()),
    useRegistryName: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const snapshot = await getOwned(ctx, "registrySnapshots", args.snapshotId);
    const organization = await ctx.db.get("organizations", ctx.tenant.organizationId);
    if (!organization) throw notFound();
    if ((organization.registrySnapshotId ?? null) !== args.expectedCurrentSnapshotId) {
      throw appError("CONFLICT");
    }
    const now = Date.now();
    if (snapshot.status !== "preview" || now - snapshot.fetchedAt > PREVIEW_MAX_AGE_MS) {
      throw appError("PREVIEW_EXPIRED");
    }
    const profile = snapshot.selectedFields;
    const update = {
      orgNumber: profile.orgNumber,
      legalForm: profile.legalForm ?? undefined,
      industryCode: profile.industryCode ?? undefined,
      registryProfile: profile,
      registrySnapshotId: snapshot._id,
      registryConfirmedAt: now,
      registryConfirmedBy: ctx.tenant.userId,
      ...(args.useRegistryName && { name: profile.name }),
    };
    await ctx.db.patch("organizations", organization._id, update);
    await ctx.db.patch("registrySnapshots", snapshot._id, {
      status: "confirmed",
      confirmedAt: now,
      confirmedBy: ctx.tenant.userId,
    });
    await writeAudit(ctx, {
      organizationId: organization._id,
      actor: { type: "user", id: ctx.tenant.userId },
      eventType: "organization.registry_confirmed",
      entityType: "organization",
      entityId: organization._id,
      before: organization,
      after: { ...organization, ...update },
    });
    return null;
  },
});

/** Bekreftede registeropplysninger for valgt organisasjon, med kilde og tider. */
export const current = tenantQuery({
  args: {},
  returns: v.object({
    name: v.string(),
    snapshotId: v.union(v.id("registrySnapshots"), v.null()),
    profile: v.union(registryProfileValidator, v.null()),
    fetchedAt: v.union(v.number(), v.null()),
    confirmedAt: v.union(v.number(), v.null()),
    gaps: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const organization = await ctx.db.get("organizations", ctx.tenant.organizationId);
    if (!organization) throw notFound();
    const snapshot = organization.registrySnapshotId
      ? await ctx.db.get("registrySnapshots", organization.registrySnapshotId)
      : null;
    const profile = organization.registryProfile ?? null;
    return {
      name: organization.name,
      snapshotId: organization.registrySnapshotId ?? null,
      profile,
      fetchedAt: snapshot?.fetchedAt ?? null,
      confirmedAt: organization.registryConfirmedAt ?? null,
      gaps: profile ? profileGaps(profile) : [],
    };
  },
});
