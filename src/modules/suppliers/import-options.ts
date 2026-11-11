import { z } from "zod";
import { DECIMAL_FORMATS, DELIMITERS, MAX_COLUMNS } from "@/domain/import/limits";
import { IMPORT_FIELDS } from "@/domain/import/mapping";
import { INDUSTRY_CODE_SYSTEMS } from "@/domain/suppliers/supplier";

const options = z.object({
  delimiter: z.enum(DELIMITERS).optional(),
  mapping: z.partialRecord(z.enum(IMPORT_FIELDS.map((f) => f.key)), z.number().int().min(0).max(MAX_COLUMNS - 1)).optional(),
  decimal: z.enum(DECIMAL_FORMATS).optional(),
  industryCodeSystem: z.enum(INDUSTRY_CODE_SYSTEMS.map(([key]) => key)).optional(),
});

/** Valgene fra skjemaet (JSON i feltet «options»), validert. */
export function parseImportOptions(value: FormDataEntryValue | null) {
  try {
    return options.safeParse(JSON.parse(typeof value === "string" ? value : ""));
  } catch {
    return options.safeParse(undefined);
  }
}
