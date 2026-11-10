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
/** Normaliserte verdier for én rad eller oppføring. Felt som mangler, er ukjente. */
export const importValuesValidator = v.object({
  name: text,
  registryOrgNumber: text,
  externalKey: text,
  registeredCountry: text,
  spendOre: v.optional(v.int64()),
  industryCode: text,
  purchaseCategory: text,
  purchaseDescription: text,
});
export const issueValidator = v.object({
  level: v.union(v.literal("error"), v.literal("warning")),
  code: v.string(),
  field: v.optional(importField),
  message: v.string(),
});

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
  values: importValuesValidator,
  issues: v.array(issueValidator),
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

// ---------------------------------------------------------------------------
// Importgrunnlag (oppgave 11)

export const entryKindValidator = v.union(
  v.literal("new_clean"),
  v.literal("new_warning"),
  v.literal("known"),
  v.literal("unclear"),
  v.literal("error"),
);
export const matchKindValidator = v.union(
  v.literal("new"),
  v.literal("none"),
  v.literal("org_number"),
  v.literal("external_key"),
  v.literal("name"),
  v.literal("conflict"),
);
export const decisionValidator = v.union(v.literal("create"), v.literal("update"), v.literal("skip"));
export const outcomeValidator = v.union(
  v.literal("created"),
  v.literal("updated"),
  v.literal("unchanged"),
  v.literal("skipped"),
  v.literal("conflict"),
);

/** Fellesvalg per type. Samme form som ImportPolicy i src/domain/import/plan.ts. */
export const policyValidator = v.object({
  known: v.optional(v.union(v.literal("update"), v.literal("skip"))),
  new_warning: v.optional(v.union(v.literal("create"), v.literal("skip"))),
  error: v.optional(v.literal("skip")),
  unclear: v.optional(v.literal("skip")),
});
export const kindCountsValidator = v.object({
  new_clean: v.number(),
  new_warning: v.number(),
  known: v.number(),
  unclear: v.number(),
  error: v.number(),
});
export const resultValidator = v.object({
  created: v.number(),
  updated: v.number(),
  unchanged: v.number(),
  skipped: v.number(),
  conflicts: v.number(),
});
export const batchStatusValidator = v.union(v.literal("preparing"), v.literal("draft"), v.literal("committing"), v.literal("committed"));

export const importBatchFields = {
  reportingPeriodId: v.id("reportingPeriods"),
  status: batchStatusValidator,
  // Periode og hash av det normaliserte innholdet: samme fil, valg og periode gir samme nøkkel.
  idempotencyKey: v.string(),
  fileHash: v.string(),
  normalizedHash: v.string(),
  mappingVersion: v.string(),
  fileName: v.string(),
  mapping: columnMappingValidator,
  industryCodeSystem: v.optional(industryCodeSystemValidator),
  rowCount: v.number(),
  entryCount: v.number(),
  kindCounts: kindCountsValidator,
  policy: policyValidator,
  // Øker ved hvert valg, så bekreftelsen gjelder valgene brukeren faktisk så.
  rowVersion: v.number(),
  createdAt: v.number(),
  createdBy: v.string(),
  expiresAt: v.number(),
  // Samme innhold er importert før for perioden, i denne batchen.
  repeatsBatchId: v.optional(v.id("importBatches")),
  confirmedAt: v.optional(v.number()),
  confirmedBy: v.optional(v.string()),
  // Første radnummer som ikke er behandlet. Gjør at to samtidige kall ikke behandler samme oppføring.
  nextRowNumber: v.number(),
  processed: v.number(),
  result: resultValidator,
  committedAt: v.optional(v.number()),
};

export const importRowFields = {
  batchId: v.id("importBatches"),
  rowNumber: v.number(),
  sourceRows: v.array(v.number()),
  sourceRowCount: v.number(),
  values: importValuesValidator,
  issues: v.array(issueValidator),
  kind: entryKindValidator,
  matchKind: matchKindValidator,
  // Leverandørene oppføringen kan gjelde, med versjonene de hadde da grunnlaget ble laget.
  candidates: v.array(v.object({ supplierId: v.id("suppliers"), rowVersion: v.number(), periodRowVersion: v.number() })),
  decision: v.optional(decisionValidator),
  targetSupplierId: v.optional(v.id("suppliers")),
  // Settes når oppføringen er behandlet. Resten er endringsreferansen for revisjon.
  outcome: v.optional(outcomeValidator),
  supplierId: v.optional(v.id("suppliers")),
  previousSpendOre: v.optional(v.int64()),
};
