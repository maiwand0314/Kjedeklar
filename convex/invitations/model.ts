import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import { writeAudit } from "../lib/audit";

/** Invitasjoner er gyldige i 7 dager. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export function invitationStatus(invitation: Doc<"invitations">, now: number): InvitationStatus {
  if (invitation.status === "pending" && invitation.expiresAt <= now) return "expired";
  return invitation.status;
}

/**
 * Gjør invitasjonen brukt og gir brukeren aktivt admin-medlemskap, med
 * revisjonslogg, i samme mutasjon. Kalleren har allerede validert invitasjonen og mottakeren.
 * Mutasjoner er serialiserbare: to samtidige forsøk gir én vinner, den andre
 * kjøres på nytt og ser invitasjonen som brukt.
 */
export async function consumeInvitation(
  db: GenericDatabaseWriter<DataModel>,
  invitation: Doc<"invitations">,
  userId: string,
  now: number,
): Promise<Id<"organizations">> {
  const existing = await db
    .query("memberships")
    .withIndex("by_organizationId_and_userId", (q) =>
      q.eq("organizationId", invitation.organizationId).eq("userId", userId),
    )
    .unique();
  const organizationId = invitation.organizationId;
  const actor = { type: "user", id: userId } as const;
  if (!existing) {
    const membership = { organizationId, userId, role: "admin" as const, status: "active" as const };
    const membershipId = await db.insert("memberships", membership);
    await writeAudit({ db }, {
      organizationId, actor, eventType: "membership.created", entityType: "membership",
      entityId: membershipId, after: membership,
    });
  } else if (existing.status !== "active") {
    await db.patch("memberships", existing._id, { status: "active" });
    await writeAudit({ db }, {
      organizationId, actor, eventType: "membership.status_changed", entityType: "membership",
      entityId: existing._id, before: existing, after: { ...existing, status: "active" },
    });
  }
  await db.patch("invitations", invitation._id, {
    status: "accepted",
    acceptedAt: now,
    acceptedBy: userId,
    tokenHash: undefined,
  });
  await writeAudit({ db }, {
    organizationId, actor, eventType: "invitation.accepted", entityType: "invitation",
    entityId: invitation._id, before: invitation, after: { ...invitation, status: "accepted" },
  });
  return organizationId;
}
