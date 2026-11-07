import { Table } from "@/components/ui/table";
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
    <section aria-labelledby="invitations-heading">
      <h2 id="invitations-heading" className="text-xl font-semibold">
        Administratorer og invitasjoner
      </h2>
      <p className="mt-1 text-sm text-muted">
        Invitasjonen sendes på e-post, kan brukes én gang og utløper etter 7 dager.
      </p>
      <div className="mt-4">
        <InviteForm organizationId={organizationId} />
      </div>
      {invitations.length > 0 && (
        <div className="mt-6">
          <Table caption="Invitasjoner">
            <thead>
              <tr>
                <th>E-post</th>
                <th>Status</th>
                <th>Utløper</th>
                <th>
                  <span className="sr-only">Handling</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td>{invitation.email}</td>
                  <td>{STATUS[invitation.status]}</td>
                  <td>{dateFormat.format(new Date(invitation.expiresAt))}</td>
                  <td className="text-right">
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
          </Table>
        </div>
      )}
    </section>
  );
}
