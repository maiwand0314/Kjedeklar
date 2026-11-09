"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/convex/_generated/api";
import { fetchAuthAction, fetchAuthMutation } from "@/lib/auth-server";
import { errorMessage } from "@/lib/convex-errors";
import type { FormState } from "@/modules/invitations/actions";

export async function renameOrganizationAction(
  organizationId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await fetchAuthMutation(api.organizations.mutations.rename, {
      organizationId,
      name: String(formData.get("name") ?? ""),
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  // Navnet vises i appskallet, så hele organisasjonens sider oppdateres.
  revalidatePath(`/o/${organizationId}`, "layout");
  return { status: "ok", message: "Navnet er lagret." };
}

/** Oppslag i Enhetsregisteret (via Convex-action). Lagrer bare en forhåndsvisning. */
export async function lookupRegistryAction(organizationId: string, orgNumber: string) {
  return await fetchAuthAction(api.organizations.registry.lookup, { organizationId, orgNumber });
}

export async function confirmRegistryAction(input: {
  organizationId: string;
  snapshotId: string;
  expectedCurrentSnapshotId: string | null;
  useRegistryName: boolean;
}): Promise<FormState> {
  try {
    await fetchAuthMutation(api.organizations.registry.confirm, input);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath(`/o/${input.organizationId}`, "layout");
  return { status: "ok", message: "Opplysningene er bekreftet og lagret." };
}
