"use server";

import type { FunctionReturnType } from "convex/server";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { DECIMAL_FORMATS, DELIMITERS, FILE_TOO_LARGE_MESSAGE, MAX_COLUMNS, MAX_FILE_BYTES } from "@/domain/import/limits";
import { IMPORT_FIELDS } from "@/domain/import/mapping";
import { INDUSTRY_CODE_SYSTEMS } from "@/domain/suppliers/supplier";
import { fetchAuthAction } from "@/lib/auth-server";
import { errorMessage } from "@/lib/convex-errors";

type Preview = Extract<FunctionReturnType<typeof api.suppliers.import.actions.preview>, { status: "ok" }>;
type Row = Preview["rows"][number];
/** Som raden fra Convex, men med beløpet som tekst i øre, så det kan sendes til nettleseren. */
export type ImportPreviewRow = Omit<Row, "values"> & { values: Omit<Row["values"], "spendOre"> & { spendOre?: string } };
export type ImportPreview = Omit<Preview, "rows"> & { rows: ImportPreviewRow[] };
export type ImportPreviewState = ImportPreview | { status: "rejected"; message: string };

const options = z.object({
  delimiter: z.enum(DELIMITERS).optional(),
  mapping: z.partialRecord(z.enum(IMPORT_FIELDS.map((f) => f.key)), z.number().int().min(0).max(MAX_COLUMNS - 1)).optional(),
  decimal: z.enum(DECIMAL_FORMATS).optional(),
  industryCodeSystem: z.enum(INDUSTRY_CODE_SYSTEMS.map(([key]) => key)).optional(),
});

const rejected = (message: string): ImportPreviewState => ({ status: "rejected", message });

function parseOptions(value: FormDataEntryValue | null) {
  try {
    return options.safeParse(JSON.parse(typeof value === "string" ? value : ""));
  } catch {
    return options.safeParse(undefined);
  }
}

/**
 * Sender en CSV-fil til forhåndsvisning i Convex. Filen leses bare inn i minnet
 * for dette kallet: den lagres ikke og logges ikke, og ingenting i
 * leverandørregisteret endres.
 */
export async function previewSupplierImportAction(organizationId: string, formData: FormData): Promise<ImportPreviewState> {
  const file = formData.get("file");
  const chosen = parseOptions(formData.get("options"));
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
