"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { fetchAuthAction, fetchAuthMutation } from "@/lib/auth-server";
import { errorMessage } from "@/lib/convex-errors";
import { toApplicabilityInput } from "@/domain/applicability/form";
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

const yearValues = z.object({
  fiscalYear: z.string().max(10),
  salesRevenue: z.string().max(40),
  balanceSheetTotal: z.string().max(40),
  averageFte: z.string().max(20),
});
const answer = z.enum(["yes", "no", "unknown"]);
const applicabilityValues = z.object({
  previousYear: yearValues,
  currentYear: yearValues,
  previousStatus: answer,
  isParentCompany: answer,
  publicInterestEntity: answer,
  norwegian: answer,
});

/**
 * Lagrer en veiledende pliktvurdering. Verdiene tolkes på nytt her (ikke stol på
 * forhåndsvisningen i nettleseren), og Convex regner ut resultatet.
 */
export async function assessApplicabilityAction(organizationId: string, values: unknown): Promise<FormState> {
  const valid = applicabilityValues.safeParse(values);
  const parsed = valid.success ? toApplicabilityInput(valid.data) : undefined;
  if (!parsed || "errors" in parsed) return { status: "error", message: "Rett feltene som er markert, og prøv igjen." };
  try {
    await fetchAuthMutation(api.organizations.applicability.assess, {
      organizationId,
      inputs: parsed.input,
      confirmed: true,
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath(`/o/${organizationId}/virksomheten`);
  return { status: "ok", message: "Vurderingen er lagret." };
}
