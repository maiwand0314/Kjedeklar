"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { fetchAuthAction, fetchAuthMutation } from "@/lib/auth-server";
import { errorMessage } from "@/lib/convex-errors";
import { toApplicabilityInput } from "@/domain/applicability/form";
import { validatePeriod } from "@/domain/reporting/period";
import { PROFILE_TOPICS } from "@/domain/reporting/profile";
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

const INVALID_FORM: FormState = { status: "error", message: "Rett feltene som er markert, og prøv igjen." };

const periodValues = z.object({
  startDate: z.string().max(10),
  endDate: z.string().max(10),
  publicationDueDate: z.string().max(10),
});

/** Oppretter en rapportperiode og returnerer id-en, så skjemaet kan velge den. */
export async function createReportingPeriodAction(
  organizationId: string,
  values: unknown,
): Promise<FormState & { periodId?: string }> {
  const valid = periodValues.safeParse(values);
  if (!valid.success || Object.keys(validatePeriod(valid.data)).length > 0) return INVALID_FORM;
  let periodId: string;
  try {
    periodId = await fetchAuthMutation(api.organizations.reportingPeriods.create, { organizationId, ...valid.data });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  // Periodevelgeren ligger i appskallet.
  revalidatePath(`/o/${organizationId}`, "layout");
  return { status: "ok", periodId };
}

const profileValues = z.object({
  reportingPeriodId: z.string().max(64),
  answers: z.record(
    z.enum(PROFILE_TOPICS.map((t) => t.key)),
    z.object({ status: z.enum(["described", "not_established", "unknown"]), text: z.string().max(20_000) }),
  ),
  confirmed: z.boolean(),
  expectedRevision: z.number().int().min(0),
});

/** Lagrer en ny versjon av virksomhetsprofilen. Convex kontrollerer perioden, svarene og versjonen. */
export async function saveBusinessProfileAction(
  organizationId: string,
  values: unknown,
): Promise<FormState & { revision?: number }> {
  const valid = profileValues.safeParse(values);
  if (!valid.success) return INVALID_FORM;
  let revision: number;
  try {
    ({ revision } = await fetchAuthMutation(api.organizations.businessProfile.save, { organizationId, ...valid.data }));
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath(`/o/${organizationId}/virksomheten`);
  return { status: "ok", message: `Profilen er lagret som versjon ${revision}.`, revision };
}
