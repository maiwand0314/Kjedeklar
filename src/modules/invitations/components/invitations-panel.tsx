import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { revokeInvitationAction } from "../actions";
import { InviteForm } from "./invite-form";

const STATUS: Record<string, string> = {
  pending: "Venter",
  accepted: "Godtatt",
  revoked: "Tilbakekalt",
  expired: "Utløpt",
};

const dateFormat = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

export async function InvitationsPanel({ organizationId }: { organizationId: string }) {
  const invitations = await fetchAuthQuery(api.invitations.queries.listForOrganization, {
    organizationId,
  });
  return (
    <section className="mt-10" aria-labelledby="invitations-heading">
      <h2 id="invitations-heading" className="text-xl font-semibold">
        Administratorer og invitasjoner
      </h2>
      <p className="mt-1 text-sm text-zinc-700">
        Invitasjonen sendes på e-post, kan brukes én gang og utløper etter 7 dager.
      </p>
      <div className="mt-4">
        <InviteForm organizationId={organizationId} />
      </div>
      {invitations.length > 0 && (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="py-2">E-post</th>
              <th className="py-2">Status</th>
              <th className="py-2">Utløper</th>
              <th className="py-2">
                <span className="sr-only">Handling</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => (
              <tr key={invitation.id} className="border-b border-zinc-200">
                <td className="py-2">{invitation.email}</td>
                <td className="py-2">{STATUS[invitation.status]}</td>
                <td className="py-2">{dateFormat.format(new Date(invitation.expiresAt))}</td>
                <td className="py-2 text-right">
                  {invitation.status === "pending" && (
                    <form action={revokeInvitationAction.bind(null, organizationId, invitation.id)}>
                      <button type="submit" className="underline">
                        Tilbakekall
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
