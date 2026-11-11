"use server";

import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { FILE_TOO_LARGE_MESSAGE, MAX_FILE_BYTES } from "@/domain/import/limits";
import { fetchAuthAction } from "@/lib/auth-server";
import { errorMessage } from "@/lib/convex-errors";
import { parseImportOptions } from "./import-options";

type Preview = Extract<FunctionReturnType<typeof api.suppliers.import.actions.preview>, { status: "ok" }>;
type Row = Preview["rows"][number];
/** Som raden fra Convex, men med beløpet som tekst i øre, så det kan sendes til nettleseren. */
export type ImportPreviewRow = Omit<Row, "values"> & { values: Omit<Row["values"], "spendOre"> & { spendOre?: string } };
export type ImportPreview = Omit<Preview, "rows"> & { rows: ImportPreviewRow[] };
export type ImportPreviewState = ImportPreview | { status: "rejected"; message: string };

const rejected = (message: string): ImportPreviewState => ({ status: "rejected", message });

/**
 * Sender en CSV-fil til forhåndsvisning i Convex. Filen leses bare inn i minnet
 * for dette kallet: den lagres ikke og logges ikke, og ingenting i
 * leverandørregisteret endres.
 */
export async function previewSupplierImportAction(organizationId: string, formData: FormData): Promise<ImportPreviewState> {
  const file = formData.get("file");
  const chosen = parseImportOptions(formData.get("options"));
  if (!(file instanceof File) || !chosen.success) return rejected("Velg en CSV-fil og prøv igjen.");
  // Avvis på størrelsen før filen leses. Convex kontrollerer grensen på nytt.
  if (file.size > MAX_FILE_BYTES) return rejected(FILE_TOO_LARGE_MESSAGE);
  let result;
  try {
    result = await fetchAuthAction(api.suppliers.import.actions.preview, {
      organizationId,
      file: await file.arrayBuffer(),
      ...chosen.data,
    });
  } catch (error) {
    return rejected(errorMessage(error));
  }
  if (result.status === "rejected") return rejected(result.message);
  return {
    ...result,
    rows: result.rows.map((row) => ({ ...row, values: { ...row.values, spendOre: row.values.spendOre?.toString() } })),
  };
}
