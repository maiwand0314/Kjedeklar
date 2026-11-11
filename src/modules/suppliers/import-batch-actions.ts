"use server";

import { ConvexError } from "convex/values";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { FILE_TOO_LARGE_MESSAGE, MAX_FILE_BYTES } from "@/domain/import/limits";
import { fetchAuthAction, fetchAuthMutation } from "@/lib/auth-server";
import { errorCode, errorMessage } from "@/lib/convex-errors";
import type { FormState } from "@/modules/invitations/actions";
import { parseImportOptions } from "./import-options";

const id = z.string().max(64);
const version = z.number().int().min(0);
const INVALID: FormState = { status: "error", message: "Ugyldig valg. Last siden på nytt og prøv igjen." };

/** Standardmeldingen for konflikt passer ikke her: valgene kan være endret av andre, eller importen kan være bekreftet. */
const failure = (error: unknown): FormState => ({
  status: "error",
  message:
    errorCode(error) === "CONFLICT"
      ? "Valgene er endret av noen andre, eller importen er allerede bekreftet. Last siden på nytt."
      : errorMessage(error),
});

/**
 * Lager et importgrunnlag fra filen for valgt rapportperiode. Convex leser og
 * normaliserer filen på nytt og lagrer bare de normaliserte oppføringene.
 */
export async function prepareSupplierImportAction(
  organizationId: string,
  formData: FormData,
): Promise<{ status: "ok"; batchId: string } | { status: "rejected"; message: string }> {
  const file = formData.get("file");
  const period = id.safeParse(formData.get("periodId"));
  const chosen = parseImportOptions(formData.get("options"));
  if (!(file instanceof File) || !period.success || !chosen.success) return { status: "rejected", message: "Velg en CSV-fil og en rapportperiode, og prøv igjen." };
  if (file.size > MAX_FILE_BYTES) return { status: "rejected", message: FILE_TOO_LARGE_MESSAGE };
  try {
    const result = await fetchAuthAction(api.suppliers.import.prepare.prepare, {
      organizationId,
      file: await file.arrayBuffer(),
      fileName: file.name,
      reportingPeriodId: period.data,
      ...chosen.data,
    });
    if (result.status === "ok") revalidatePath(`/o/${organizationId}/leverandorer/import`);
    return result;
  } catch (error) {
    return { status: "rejected", message: errorMessage(error) };
  }
}

const policy = z.object({
  known: z.enum(["update", "skip"]).optional(),
  new_warning: z.enum(["create", "skip"]).optional(),
  error: z.literal("skip").optional(),
  unclear: z.literal("skip").optional(),
});

export async function setImportPolicyAction(organizationId: string, input: unknown): Promise<FormState> {
  const valid = z.object({ batchId: id, expectedRowVersion: version, policy }).safeParse(input);
  if (!valid.success) return INVALID;
  try {
    await fetchAuthMutation(api.suppliers.import.batches.setPolicy, { organizationId, ...valid.data });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/o/${organizationId}/leverandorer/import`);
  return { status: "ok" };
}

export async function decideImportRowAction(organizationId: string, input: unknown): Promise<FormState> {
  const valid = z
    .object({ batchId: id, rowId: id, expectedRowVersion: version, decision: z.enum(["create", "update", "skip"]).nullable(), targetSupplierId: id.optional() })
    .safeParse(input);
  if (!valid.success) return INVALID;
  try {
    await fetchAuthMutation(api.suppliers.import.batches.decide, { organizationId, ...valid.data });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/o/${organizationId}/leverandorer/import`);
  return { status: "ok" };
}

/** Bekrefter importen. Et nytt klikk etter bekreftelsen endrer ingenting. */
export async function startImportAction(organizationId: string, input: unknown): Promise<FormState> {
  const valid = z.object({ batchId: id, expectedRowVersion: version }).safeParse(input);
  if (!valid.success) return INVALID;
  try {
    await fetchAuthMutation(api.suppliers.import.batches.startCommit, { organizationId, ...valid.data });
  } catch (error) {
    return failure(error);
  }
  return { status: "ok" };
}

export type ImportProgress =
  | { status: "ok"; done: boolean; processed: number; entryCount: number }
  /** Et annet kall gjennomførte samme stykke samtidig. Trygt å prøve igjen. */
  | { status: "retry" }
  | { status: "error"; message: string };

/** Gjennomfører neste stykke av en bekreftet import. Kalles til importen er ferdig. */
export async function continueImportAction(organizationId: string, batchId: unknown): Promise<ImportProgress> {
  const valid = id.safeParse(batchId);
  if (!valid.success) return { status: "error", message: INVALID.message ?? "" };
  try {
    const step = await fetchAuthMutation(api.suppliers.import.batches.commitChunk, { organizationId, batchId: valid.data });
    if (step.done) revalidatePath(`/o/${organizationId}/leverandorer`);
    return { status: "ok", done: step.done, processed: step.processed, entryCount: step.entryCount };
  } catch (error) {
    // Feil med kode kommer fra appen og gjentas ved nytt forsøk. Alt annet er en kollisjon eller et avbrudd.
    if (error instanceof ConvexError) return { status: "error", message: errorMessage(error) };
    return { status: "retry" };
  }
}
