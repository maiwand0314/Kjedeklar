/**
 * Dataformat for versjonerte risikodata og metodeversjoner (oppgave 14).
 * Dette er kontrakten mellom kilde/faglig review og systemet: en manifestfil
 * med metadata og innholdet (landlinjer, bransjemapping eller metodedefinisjon).
 * Ren TypeScript uten Convex/Next.js, så den brukes likt av operatørskriptene,
 * Convex-importen og testene. Importene har filendelse, siden skriptene kjøres
 * direkte av Node.
 *
 * Verdiene her er Kjedeklars screening (prioriteringsstøtte), ikke juridisk
 * fasit og ikke bevis mot en leverandør. Se docs/decisions/risk-method-v0.md.
 */
import { z } from "zod";
import { isCountryCode } from "../../suppliers/countries.ts";

export const DATASET_SCHEMA_VERSION = "risk-dataset-v1";
/** Samme nøkler som INDUSTRY_CODE_SYSTEMS i src/domain/suppliers/supplier.ts. */
export const CODE_SYSTEMS = ["SN2007", "SN2025", "NACE2", "NACE2.1"] as const;
export const SCREENING_LEVELS = ["low", "moderate", "high"] as const;
/** Convex lagrer hele versjonen i én mutasjon; større versjoner må deles. */
export const MAX_ENTRIES = 1000;

const text = (max: number) => z.string().trim().min(1).max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dato må være YYYY-MM-DD")
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), "Ugyldig dato");
const level = z.enum(SCREENING_LEVELS);
const environment = z.enum(["demo", "production"]);
const versionName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/, "Versjonsnavn: bokstaver, tall, punktum, understrek og bindestrek");
const checksum = z.string().regex(/^[0-9a-f]{64}$/, "Checksum må være 64 hex-tegn (SHA-256)");

/** Faglig gjennomgang og godkjenning. Begge kan mangle ved import; produksjonsaktivering krever begge. */
const review = z.object({ reviewer: text(100), reviewedAt: date, reviewDueAt: date }).strict();
const approval = z.object({ approvedBy: text(100), approvedAt: date }).strict();

const datasetBase = {
  schemaVersion: z.literal(DATASET_SCHEMA_VERSION),
  version: versionName,
  environment,
  sourceTitle: text(200),
  sourceUrl: z.url({ protocol: /^https$/ }),
  sourceEdition: text(100),
  retrievedAt: date,
  /** `cleared`: kommersiell gjenbruk er skriftlig avklart. `unclear` og `restricted` kan ikke aktiveres i produksjon. */
  licenseStatus: z.enum(["cleared", "unclear", "restricted"]),
  licenseNote: text(500).optional(),
  review: review.optional(),
  approval: approval.optional(),
  checksum,
};

export const countryEntrySchema = z
  .object({
    iso2: z.string().regex(/^[A-Z]{2}$/),
    /** Kildens egen verdi (f.eks. rangering), som tekst. Tolkes aldri; Kjedeklars nivå står i `screeningLevel`. */
    originalIndicator: text(100),
    screeningLevel: level,
    transformationNote: text(500),
    sourceReference: text(300),
  })
  .strict();

export const countryManifestSchema = z
  .object({ ...datasetBase, kind: z.literal("country"), entries: z.array(countryEntrySchema).min(1).max(MAX_ENTRIES) })
  .strict();

/** Nøyaktig én av `codeExact`, `codePrefix` og `productCategory`. */
export const industryEntrySchema = z
  .object({
    codeExact: z.string().regex(/^\d{2}\.\d{1,3}$/, "Fullstendig kode, f.eks. 46.900").optional(),
    codePrefix: z.string().regex(/^\d{2}(\.\d{1,2})?$/, "Prefiks, f.eks. 46 eller 46.9").optional(),
    productCategory: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9 _-]{0,59}$/).optional(),
    screeningLevel: level,
    sourceReference: text(300),
    rationale: text(500),
  })
  .strict()
  .refine((e) => [e.codeExact, e.codePrefix, e.productCategory].filter((v) => v !== undefined).length === 1, {
    message: "Oppgi nøyaktig én av codeExact, codePrefix og productCategory",
  });

export const industryManifestSchema = z
  .object({
    ...datasetBase,
    kind: z.literal("industry"),
    /** Kodeverket alle kodene i filen følger, med versjon. */
    codeSystem: z.enum(CODE_SYSTEMS),
    entries: z.array(industryEntrySchema).min(1).max(MAX_ENTRIES),
  })
  .strict();

/**
 * Metodekontrakten (selvstendig versjon, ikke samme ting som kildeutgave).
 * Feltene som er `z.literal` er ufravikelige regler i Kjedeklars screening:
 * en metodefil som forsøker noe annet, avvises.
 */
const ruleDefinition = z
  .object({
    ruleId: z.string().regex(/^[A-Z][A-Z0-9_]{2,39}$/),
    /** `risk_factor` kan gi nivå. `control_signal` oppretter bare oppfølging og gir aldri nivå. */
    kind: z.enum(["risk_factor", "control_signal"]),
    factor: z.enum(["country", "industry", "product", "registry_status", "data_gap"]),
    description: text(500),
  })
  .strict();

export const methodDefinitionSchema = z
  .object({
    scope: z.literal("kjedeklar_screening"),
    requiresProfessionalReview: z.literal(true),
    levels: z.tuple([z.literal("low"), z.literal("moderate"), z.literal("high")]),
    aggregation: z.literal("ordinal_max"),
    unknownPolicy: z
      .object({
        knownHighWins: z.literal(true),
        materialGaps: z.array(z.enum(["productionCountry", "industryCode", "productCategory"])).min(1),
        resultWhenMaterialGap: z.literal("unknown"),
      })
      .strict(),
    priorityOrder: z.array(z.enum(["high", "moderate", "low", "unknown"])).length(4),
    amountAffectsLevel: z.literal(false),
    amountSortsWithinLevel: z.literal(true),
    ruleDefinitions: z.array(ruleDefinition).min(1).max(100),
  })
  .strict();

export const methodManifestSchema = z
  .object({
    schemaVersion: z.literal(DATASET_SCHEMA_VERSION),
    kind: z.literal("method"),
    version: versionName,
    environment,
    description: text(500),
    review: review.optional(),
    approval: approval.optional(),
    checksum,
    definition: methodDefinitionSchema,
  })
  .strict();

export const manifestSchema = z.discriminatedUnion("kind", [countryManifestSchema, industryManifestSchema, methodManifestSchema]);

export type CountryManifest = z.infer<typeof countryManifestSchema>;
export type IndustryManifest = z.infer<typeof industryManifestSchema>;
export type MethodManifest = z.infer<typeof methodManifestSchema>;
export type RiskManifest = z.infer<typeof manifestSchema>;
export type DatasetKind = RiskManifest["kind"];
export type ScreeningLevel = (typeof SCREENING_LEVELS)[number];

/**
 * ISO-landkoder i et datasett. Produksjonsdata bruker bare ekte koder fra
 * listen i `suppliers/countries`. Demo-data kan i tillegg bruke de
 * brukertildelte kodene XA–XZ, så syntetiske nivåer aldri settes på et ekte land.
 */
export const isDatasetCountry = (iso2: string, env: "demo" | "production") =>
  isCountryCode(iso2) || (env === "demo" && /^X[A-Z]$/.test(iso2));
