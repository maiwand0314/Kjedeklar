"use client";

import { useActionState } from "react";
import { createInvitationAction, type FormState } from "../actions";

export function InviteForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createInvitationAction.bind(null, organizationId),
    { status: "idle" },
  );
  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="invite-email" className="font-medium">
          E-post til ny administrator
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          className="rounded border border-zinc-400 px-3 py-2"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Sender …" : "Send invitasjon"}
      </button>
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className="sm:basis-full">
          {state.message}
        </p>
      )}
    </form>
  );
}
