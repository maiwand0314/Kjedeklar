"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { fetchAuthMutation } from "@/lib/auth-server";
import { errorCode, errorMessage } from "@/lib/convex-errors";
import { normalizeSupplier, parseSupplierPeriodForm } from "@/domain/suppliers/supplier";
import type { FormState } from "@/modules/invitations/actions";

const INVALID_FORM: FormState = { status: "error", message: "Rett feltene som er markert, og prøv igjen." };

/** Standardmeldingen ber brukeren laste siden på nytt, og da forsvinner det som står i skjemaet. */
const failure = (error: unknown): FormState => ({
  status: "error",
  message:
    errorCode(error) === "CONFLICT"
      ? "Noen har endret leverandøren siden du åpnet siden. Noter endringene dine før du laster siden på nytt."
      : errorMessage(error),
});

const id = z.string().max(64);
const version = z.number().int().min(0);
const profileValues = z.object({
  name: z.string().max(400),
  registryOrgNumber: z.string().max(40),
  externalKey: z.string().max(200),
  registeredCountry: z.string().max(10),
  industryCodeSystem: z.string().max(20),
  industryCode: z.string().max(20),
});
const periodValues = z.object({
  spend: z.string().max(40),
  purchaseCategory: z.string().max(400),
  purchaseDescription: z.string().max(10_000),
  productionCountries: z.array(z.string().max(10)).max(300),
  upstreamUnknown: z.boolean(),
});

/** Oppretter (uten `target`) eller endrer en leverandørprofil. Convex validerer på nytt og kontrollerer org.nr. */
export async function saveSupplierAction(
  organizationId: string,
  target: unknown,
  values: unknown,
): Promise<FormState & { supplierId?: string; rowVersion?: number }> {
  const existing = z.object({ supplierId: id, expectedRowVersion: version }).nullable().safeParse(target);
  const valid = profileValues.safeParse(values);
  const parsed = valid.success ? normalizeSupplier(valid.data) : undefined;
  if (!existing.success || !parsed || "errors" in parsed) return INVALID_FORM;
  try {
    if (!existing.data) {
      const supplierId = await fetchAuthMutation(api.suppliers.mutations.create, { organizationId, ...parsed.value });
      revalidatePath(`/o/${organizationId}/leverandorer`);
      return { status: "ok", supplierId };
    }
    const { rowVersion } = await fetchAuthMutation(api.suppliers.mutations.update, {
      organizationId,
      ...existing.data,
      ...parsed.value,
    });
    revalidatePath(`/o/${organizationId}/leverandorer`);
    return { status: "ok", message: "Leverandøren er lagret.", rowVersion };
  } catch (error) {
    return failure(error);
  }
}

export async function setSupplierArchivedAction(organizationId: string, input: unknown): Promise<FormState> {
  const valid = z.object({ supplierId: id, expectedRowVersion: version, archived: z.boolean() }).safeParse(input);
  if (!valid.success) return INVALID_FORM;
  try {
    await fetchAuthMutation(api.suppliers.mutations.setArchived, { organizationId, ...valid.data });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/o/${organizationId}/leverandorer`);
  return { status: "ok" };
}

/** Lagrer innkjøpsdata for én leverandør i én periode. Beløpet tolkes her, ikke i nettleseren. */
export async function saveSupplierPeriodAction(
  organizationId: string,
  target: unknown,
  values: unknown,
): Promise<FormState & { rowVersion?: number }> {
  const ids = z.object({ supplierId: id, reportingPeriodId: id, expectedRowVersion: version }).safeParse(target);
  const valid = periodValues.safeParse(values);
  const parsed = valid.success ? parseSupplierPeriodForm(valid.data) : undefined;
  if (!ids.success || !parsed || "errors" in parsed) return INVALID_FORM;
  try {
    const { rowVersion } = await fetchAuthMutation(api.suppliers.mutations.savePeriod, {
      organizationId,
      ...ids.data,
      ...parsed.value,
    });
    revalidatePath(`/o/${organizationId}/leverandorer`);
    return { status: "ok", message: "Innkjøpsdataene er lagret.", rowVersion };
  } catch (error) {
    return failure(error);
  }
}
