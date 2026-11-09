import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { registryProfileValidator } from "./registryValidators";

/**
 * Lagrer et Brreg-oppslag som forhåndsvisning. Kalles bare fra lookup-actionen
 * med organizationId fra verifisert tenant. Endrer ingen kundedata; bekreftelse
 * skjer i registry:confirm (med revisjonslogg).
 */
export const storePreview = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    fetchedBy: v.string(),
    fetchedAt: v.number(),
    profile: registryProfileValidator,
    payloadHash: v.string(),
    mappingVersion: v.string(),
  },
  returns: v.id("registrySnapshots"),
  handler: async (ctx, args) =>
    await ctx.db.insert("registrySnapshots", {
      organizationId: args.organizationId,
      source: "brreg-enhetsregisteret",
      orgNumber: args.profile.orgNumber,
      fetchedAt: args.fetchedAt,
      fetchedBy: args.fetchedBy,
      selectedFields: args.profile,
      sourcePayloadHash: args.payloadHash,
      mappingVersion: args.mappingVersion,
      status: "preview",
    }),
});
