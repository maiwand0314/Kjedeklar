import { InvitationsPanel } from "@/modules/invitations/components/invitations-panel";

export const metadata = { title: "Innstillinger" };

export default async function SettingsPage({ params }: PageProps<"/o/[organizationId]/innstillinger">) {
  const { organizationId } = await params;
  return (
    <>
      <h1 className="text-2xl font-semibold">Innstillinger</h1>
      <div className="mt-8">
        <InvitationsPanel organizationId={organizationId} />
      </div>
    </>
  );
}
