import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";

/** Invitasjoner er gyldige i 7 dager. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export function invitationStatus(invitation: Doc<"invitations">, now: number): InvitationStatus {
  if (invitation.status === "pending" && invitation.expiresAt <= now) return "expired";
  return invitation.status;
}

/**
 * Gjør invitasjonen brukt og gir brukeren aktivt admin-medlemskap, i samme
 * mutasjon. Kalleren har allerede validert invitasjonen og mottakeren.
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
  if (!existing) {
    await db.insert("memberships", {
      organizationId: invitation.organizationId,
      userId,
      role: "admin",
      status: "active",
    });
  } else if (existing.status !== "active") {
    await db.patch("memberships", existing._id, { status: "active" });
  }
  await db.patch("invitations", invitation._id, {
    status: "accepted",
    acceptedAt: now,
    acceptedBy: userId,
    tokenHash: undefined,
  });
  return invitation.organizationId;
}
