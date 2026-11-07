"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { FormState } from "@/modules/invitations/actions";
import { renameOrganizationAction } from "../actions";

export function RenameOrganizationForm({ organizationId, name }: { organizationId: string; name: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    renameOrganizationAction.bind(null, organizationId),
    { status: "idle" },
  );
  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field
        id="organization-name-input"
        label="Navn på virksomheten"
        name="name"
        defaultValue={name}
        required
        maxLength={200}
        className="flex-1"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Lagrer …" : "Lagre navn"}
      </Button>
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className="sm:basis-full">
          {state.message}
        </p>
      )}
    </form>
  );
}
