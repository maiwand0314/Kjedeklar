"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { createInvitationAction, type FormState } from "../actions";

export function InviteForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createInvitationAction.bind(null, organizationId),
    { status: "idle" },
  );
  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field
        id="invite-email"
        label="E-post til ny administrator"
        name="email"
        type="email"
        autoComplete="off"
        required
        className="flex-1"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Sender …" : "Send invitasjon"}
      </Button>
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className="sm:basis-full">
          {state.message}
        </p>
      )}
    </form>
  );
}
