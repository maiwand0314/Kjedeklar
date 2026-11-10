import { v } from "convex/values";
import { industryCodeSystemValidator } from "../validators";

export const delimiterValidator = v.union(v.literal(";"), v.literal(","));
export const decimalFormatValidator = v.union(v.literal("auto"), v.literal("comma"), v.literal("dot"));

const column = v.optional(v.number());
/** Felt → kolonneindeks i filen. Samme nøkler som IMPORT_FIELDS i src/domain/import/mapping.ts. */
export const columnMappingValidator = v.object({
  name: column,
  registryOrgNumber: column,
  externalKey: column,
  registeredCountry: column,
  spend: column,
  industryCode: column,
  purchaseCategory: column,
  purchaseDescription: column,
});

const text = v.optional(v.string());
const importField = v.union(
  v.literal("name"),
  v.literal("registryOrgNumber"),
  v.literal("externalKey"),
  v.literal("registeredCountry"),
  v.literal("spend"),
  v.literal("industryCode"),
  v.literal("purchaseCategory"),
  v.literal("purchaseDescription"),
);
const matchedSuppliers = v.array(v.object({ id: v.string(), name: v.string(), archived: v.boolean() }));

const previewRow = v.object({
  rowNumber: v.number(),
  // Teksten i filen per valgt felt, avkortet. Ubetrodd tekst; vises bare som tekst.
  source: v.object({
    name: text,
    registryOrgNumber: text,
    externalKey: text,
    registeredCountry: text,
    spend: text,
    industryCode: text,
    purchaseCategory: text,
    purchaseDescription: text,
  }),
  values: v.object({
    name: text,
    registryOrgNumber: text,
    externalKey: text,
    registeredCountry: text,
    spendOre: v.optional(v.int64()),
    industryCode: text,
    purchaseCategory: text,
    purchaseDescription: text,
  }),
  issues: v.array(
    v.object({
      level: v.union(v.literal("error"), v.literal("warning")),
      code: v.string(),
      field: v.optional(importField),
      message: v.string(),
    }),
  ),
  match: v.union(
    v.object({ kind: v.union(v.literal("new"), v.literal("none")) }),
    v.object({
      kind: v.union(v.literal("org_number"), v.literal("external_key"), v.literal("name"), v.literal("conflict")),
      suppliers: matchedSuppliers,
    }),
  ),
  status: v.union(v.literal("ready"), v.literal("clarify"), v.literal("error")),
});

/** Enten er hele filen avvist med begrunnelse, eller så er den lest og kan gjennomgås. */
export const previewResultValidator = v.union(
  v.object({ status: v.literal("rejected"), code: v.string(), message: v.string() }),
  v.object({
    status: v.literal("ok"),
    delimiter: delimiterValidator,
    headers: v.array(v.string()),
    mapping: columnMappingValidator,
    decimal: decimalFormatValidator,
    industryCodeSystem: v.optional(industryCodeSystemValidator),
    problems: v.array(v.string()),
    rowCount: v.number(),
    rows: v.array(previewRow),
    summary: v.object({
      ready: v.number(),
      clarify: v.number(),
      error: v.number(),
      proposedNew: v.number(),
      proposedExisting: v.number(),
      proposedUnclear: v.number(),
    }),
  }),
);
