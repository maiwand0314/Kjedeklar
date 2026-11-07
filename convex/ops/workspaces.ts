import { v } from "convex/values";
import { z } from "zod";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { writeAudit } from "../lib/audit";
import { normalizeEmail } from "../auth";
import { INVITATION_TTL_MS } from "../invitations/model";

/**
 * Operatør oppretter en ny kundes workspace og inviterer første administrator.
 * Kjøres med admin/deploy key, f.eks.:
 *
 *   npx convex run ops/workspaces:provision '{"organizationName":"Eksempel AS","adminEmail":"admin@eksempel.example"}'
 *
 * Mottakerens tilhørighet til virksomheten skal være kontrollert manuelt før
 * kjøring. Org.nr. er ingen eierskapsverifisering. Lager alltid en ny
 * organisasjon; navn er ikke en identitet.
 */
export const provision = internalMutation({
  args: {
    organizationName: v.string(),
    adminEmail: v.string(),
    country: v.optional(v.string()),
  },
  returns: v.object({
    organizationId: v.id("organizations"),
    invitationId: v.id("invitations"),
  }),
  handler: async (ctx, args) => {
    const name = args.organizationName.trim();
    const email = z.email().parse(normalizeEmail(args.adminEmail));
    if (!name) throw new Error("Organisasjonsnavn mangler.");
    const organization = { name, country: args.country ?? "NO", status: "active" as const };
    const organizationId = await ctx.db.insert("organizations", organization);
    const invitation = {
      organizationId,
      email,
      status: "pending" as const,
      expiresAt: Date.now() + INVITATION_TTL_MS,
    };
    const invitationId = await ctx.db.insert("invitations", invitation);
    const system = { type: "system" } as const;
    await writeAudit(ctx, {
      organizationId, actor: system, eventType: "organization.provisioned", entityType: "organization",
      entityId: organizationId, after: organization,
    });
    await writeAudit(ctx, {
      organizationId, actor: system, eventType: "invitation.created", entityType: "invitation",
      entityId: invitationId, after: invitation,
    });
    await ctx.scheduler.runAfter(0, internal.email.actions.sendInvitation, { invitationId });
    return { organizationId, invitationId };
  },
});
