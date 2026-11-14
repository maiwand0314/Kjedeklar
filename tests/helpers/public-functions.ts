/**
 * Register over gjennomgåtte offentlige Convex-funksjoner.
 *
 * En offentlig funksjon som ikke står her, får registertesten til å feile. Når
 * du legger til en, velger du grense og eksempelargumenter. Da kjøres de samme
 * negative testene automatisk, både i convex-test og mot lokal backend:
 *
 * - `tenant`: lages med tenantQuery/tenantMutation og tar organisasjonskandidat.
 *   Testes for manglende sesjon, fremmed organisasjon, inaktivt medlemskap,
 *   ugyldig format og id fra en annen tabell. Alle skal gi samme avslag.
 * - `user`: lages med userQuery, uten organisasjonskandidat. Testes for
 *   manglende sesjon og for at bare egne data returneres.
 * - `invitation`: lages med invitationQuery/invitationMutation/invitationAction.
 *   Tokenet i invitasjonslenken er tilgangsbeviset. Dekkes av
 *   tests/convex/invitations.test.ts og tests/integration/auth-lifecycle.test.ts.
 * - `verification`: lages med verificationAction. Better Auths signerte
 *   engangstoken for e-postbekreftelse er tilgangsbeviset.
 */
import type { FunctionReference } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { RegistryProfile } from "../../src/domain/brreg/enhet";
import { ENGINE_VERSION, inputHash, normalizeInput } from "../../src/domain/risk/engine";
import { emptyAnswers, type ProfileAnswers } from "../../src/domain/reporting/profile";

/* eslint-disable @typescript-eslint/no-explicit-any -- registeret holder funksjoner med ulike argumenttyper */
type PublicQuery = FunctionReference<"query", "public", any, any>;
type PublicMutation = FunctionReference<"mutation", "public", any, any>;
type PublicAction = FunctionReference<"action", "public", any, any>;

/** Syntetisk registerprofil for tester (samme form som RegistryProfile). */
/** Syntetisk pliktvurderingsgrunnlag: ordinært norsk foretak over tersklene begge år. */
export const SYNTHETIC_APPLICABILITY_INPUT = {
  previousYear: { fiscalYear: 2024, salesRevenueOre: 80_000_000_00n, balanceSheetTotalOre: 40_000_000_00n, averageFte: 60 },
  currentYear: { fiscalYear: 2025, salesRevenueOre: 80_000_000_00n, balanceSheetTotalOre: 40_000_000_00n, averageFte: 60 },
  previousStatus: "yes",
  isParentCompany: "no",
  publicInterestEntity: "no",
  norwegian: "yes",
} as const;

export const SYNTHETIC_REGISTRY_PROFILE: RegistryProfile = {
  orgNumber: "920000002",
  name: "SYNTETISK TESTVARER AS",
  legalForm: "AS",
  legalFormDescription: "Aksjeselskap",
  address: null,
  addressKind: null,
  industryCode: "46.900",
  industryDescription: null,
  industryCodeSystem: "SN",
  bankrupt: false,
  underLiquidation: false,
  underForcedLiquidation: false,
  deletedOn: null,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Syntetisk rapportperiode: kalenderåret 2025 med frist 30. juni året etter. */
export const SYNTHETIC_PERIOD = { startDate: "2025-01-01", endDate: "2025-12-31", publicationDueDate: "2026-06-30" } as const;

/** Syntetisk virksomhetsprofil: ett tema beskrevet, ett «ikke etablert», resten ubesvart. */
export const SYNTHETIC_PROFILE_ANSWERS: ProfileAnswers = {
  ...emptyAnswers(),
  organizationDescription: { status: "described", text: "Syntetisk aksjeselskap med ti ansatte." },
  policies: { status: "not_established", text: "" },
};

/** Syntetisk leverandør uten org.nr.: bare navnet er kjent. */
export const SYNTHETIC_SUPPLIER = { name: "Syntetisk Leverandør AS" } as const;
/** Samme leverandør slik den lagres (uten organisasjon og opprettelse). */
export const SYNTHETIC_SUPPLIER_DOC = {
  ...SYNTHETIC_SUPPLIER,
  nameKey: "syntetisk leverandør as",
  status: "active",
  rowVersion: 1,
} as const;
/** Syntetiske innkjøpsdata: alt ukjent. */
export const SYNTHETIC_SUPPLIER_PERIOD = { productionCountries: [], upstreamUnknown: true };

/** Syntetisk metodeversjon slik den lagres (global, uten organisasjon). */
export const SYNTHETIC_METHOD_VERSION_DOC = {
  version: "test-method",
  description: "SYNTETISK TESTMETODE",
  status: "active" as const,
  environment: "demo" as const,
  schemaVersion: "risk-dataset-v1",
  checksum: "0".repeat(64),
  importedAt: 0,
  importedBy: "test",
  definition: {
    scope: "kjedeklar_screening" as const,
    requiresProfessionalReview: true as const,
    levels: ["low", "moderate", "high"],
    aggregation: "ordinal_max" as const,
    unknownPolicy: { knownHighWins: true as const, materialGaps: ["productionCountry"], resultWhenMaterialGap: "unknown" as const },
    priorityOrder: ["high", "unknown", "moderate", "low"],
    amountAffectsLevel: false as const,
    amountSortsWithinLevel: true as const,
    ruleDefinitions: [{ ruleId: "COUNTRY_LEVEL", kind: "risk_factor", factor: "country", description: "Testregel" }],
  },
};

/** Syntetisk importgrunnlag slik det lagres (uten organisasjon, periode og bruker): ett utkast uten oppføringer som mangler valg. */
export const SYNTHETIC_IMPORT_BATCH = {
  status: "draft",
  idempotencyKey: "syntetisk",
  fileHash: "0".repeat(64),
  normalizedHash: "1".repeat(64),
  mappingVersion: "csv-import-v1",
  fileName: "syntetisk.csv",
  mapping: { name: 0 },
  rowCount: 1,
  entryCount: 1,
  kindCounts: { new_clean: 1, new_warning: 0, known: 0, unclear: 0, error: 0 },
  policy: {},
  rowVersion: 1,
  nextRowNumber: 0,
  processed: 0,
  result: { created: 0, updated: 0, unchanged: 0, skipped: 0, conflicts: 0 },
} as const;
/** Syntetisk oppføring: ny leverandør uten avklaringer. */
export const SYNTHETIC_IMPORT_ROW = {
  rowNumber: 2,
  sourceRows: [2],
  sourceRowCount: 1,
  values: { name: "Syntetisk Importert AS" },
  issues: [],
  kind: "new_clean" as const,
  matchKind: "new" as const,
  candidates: [],
};

type Common = {
  boundary: "tenant" | "user" | "invitation" | "verification";
  /** Argumenter i tillegg til `organizationId` for tenantfunksjoner. */
  sampleArgs: Record<string, unknown>;
  /** Hvorfor funksjonen er offentlig og hva den gir tilgang til. */
  note: string;
  /**
   * Lager gyldige argumenter i egen organisasjon når `sampleArgs` ikke holder
   * (f.eks. en id som må finnes). Brukes av convex-test-registeret.
   */
  prepareOwn?: (run: Run, organizationId: string, userId: string) => Promise<Record<string, unknown>>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- convex-test sin db er generisk
type Run = <T>(fn: (db: any) => Promise<T>) => Promise<T>;

/** Setter inn en egen rapportperiode og gir id-en som `reportingPeriodId`. */
const ownPeriod = async (run: Run, organizationId: string, userId: string) => ({
  reportingPeriodId: await run((db) =>
    db.insert("reportingPeriods", { organizationId, ...SYNTHETIC_PERIOD, status: "open", createdAt: Date.now(), createdBy: userId }),
  ),
});

/** Setter inn en egen leverandør og gir id-en som `supplierId`. */
const ownSupplier = async (run: Run, organizationId: string, userId: string) => ({
  supplierId: await run((db) => db.insert("suppliers", { organizationId, ...SYNTHETIC_SUPPLIER_DOC, createdAt: Date.now(), createdBy: userId })),
});

/** Som ownSupplier, men med norsk org.nr. (for funksjoner som krever det). */
const ownSupplierWithOrgNumber = async (run: Run, organizationId: string, userId: string) => ({
  supplierId: await run((db) =>
    db.insert("suppliers", { organizationId, ...SYNTHETIC_SUPPLIER_DOC, registryOrgNumber: "920000002", createdAt: Date.now(), createdBy: userId }),
  ),
});

/** Leverandør med norsk org.nr. og et hentet registersvar, så det finnes forslag å godta. Id-en gis som `supplierId`. */
const ownEnrichedSupplier = async (run: Run, organizationId: string, userId: string) => {
  const orgNumber = SYNTHETIC_REGISTRY_PROFILE.orgNumber;
  return await run(async (db) => {
    const supplierId = await db.insert("suppliers", { organizationId, ...SYNTHETIC_SUPPLIER_DOC, registryOrgNumber: orgNumber, createdAt: Date.now(), createdBy: userId });
    const jobId = await db.insert("jobs", { organizationId, inputRef: supplierId, ...SYNTHETIC_JOB, type: "brreg.enrich", status: "succeeded", createdBy: userId });
    const snapshotId = await db.insert("registrySnapshots", {
      organizationId,
      supplierId,
      source: "brreg-enhetsregisteret",
      orgNumber,
      fetchedAt: Date.now(),
      fetchedBy: userId,
      selectedFields: SYNTHETIC_REGISTRY_PROFILE,
      sourcePayloadHash: "0".repeat(64),
      mappingVersion: "brreg-enhet-v1",
      status: "fetched",
    });
    await db.patch(supplierId, { registryEnrichment: { sequence: 1, jobId, orgNumber, state: "succeeded", requestedAt: 0, snapshotId, fetchedAt: Date.now() } });
    return { supplierId };
  });
};

/** Setter inn et eget importgrunnlag med én oppføring og gir id-ene som `batchId` og `rowId`. */
const ownBatch = (status: "draft" | "committing") => async (run: Run, organizationId: string, userId: string) => {
  const { reportingPeriodId } = await ownPeriod(run, organizationId, userId);
  return await run(async (db) => {
    const batchId = await db.insert("importBatches", {
      organizationId,
      reportingPeriodId,
      ...SYNTHETIC_IMPORT_BATCH,
      status,
      createdAt: Date.now(),
      createdBy: userId,
      expiresAt: Date.now() + 3_600_000,
    });
    const rowId = await db.insert("importRows", { organizationId, batchId, ...SYNTHETIC_IMPORT_ROW });
    return { batchId, rowId };
  });
};
const ownBatchOnly = (status: "draft" | "committing") => async (run: Run, organizationId: string, userId: string) => ({
  batchId: (await ownBatch(status)(run, organizationId, userId)).batchId,
});

/** Syntetisk jobb slik den lagres (uten organisasjon, referanse og bruker). */
export const SYNTHETIC_JOB = {
  type: "test.probe",
  idempotencyKey: "syntetisk",
  status: "queued" as const,
  attempts: 0,
  maxAttempts: 3,
  runAfter: 0,
  createdAt: 0,
};

/** Setter inn en egen leverandør og gir id-en som `inputRef` for en testjobb. */
const ownJobInput = async (run: Run, organizationId: string, userId: string) => ({
  inputRef: (await ownSupplier(run, organizationId, userId)).supplierId,
});
/** Setter inn en egen jobb og gir id-en som `jobId`. */
const ownJob = async (run: Run, organizationId: string, userId: string) => {
  const { inputRef } = await ownJobInput(run, organizationId, userId);
  return { jobId: await run((db) => db.insert("jobs", { organizationId, inputRef, ...SYNTHETIC_JOB, createdBy: userId })) };
};

export type PublicFunctionReview =
  | (Common & { kind: "query"; ref: PublicQuery })
  | (Common & { kind: "mutation"; ref: PublicMutation })
  | (Common & { kind: "action"; ref: PublicAction });

export const reviewedPublicFunctions: Record<string, PublicFunctionReview> = {
  "organizations/queries:current": {
    kind: "query",
    ref: api.organizations.queries.current,
    boundary: "tenant",
    sampleArgs: {},
    note: "Navn og rolle for valgt organisasjon. Krever aktivt medlemskap.",
  },
  "organizations/queries:listMine": {
    kind: "query",
    ref: api.organizations.queries.listMine,
    boundary: "user",
    sampleArgs: {},
    note: "Organisasjonsvelger: bare egne aktive medlemskap i aktive organisasjoner.",
  },
  "account/queries:me": {
    kind: "query",
    ref: api.account.queries.me,
    boundary: "user",
    sampleArgs: {},
    note: "Innlogget brukers egen e-post og navn (invitasjonssiden sammenligner mottaker).",
  },
  "organizations/mutations:rename": {
    kind: "mutation",
    ref: api.organizations.mutations.rename,
    boundary: "tenant",
    sampleArgs: { name: "Nytt navn AS" },
    note: "Admin endrer navn på valgt organisasjon. Logges i revisjonsloggen.",
  },
  "organizations/registry:lookup": {
    kind: "action",
    ref: api.organizations.registry.lookup,
    boundary: "tenant",
    sampleArgs: { orgNumber: "920000002" },
    note: "Brreg-oppslag via tenantAction; lagrer bare forhåndsvisning. Nettverk er stoppet i convex-test.",
  },
  "organizations/registry:confirm": {
    kind: "mutation",
    ref: api.organizations.registry.confirm,
    boundary: "tenant",
    sampleArgs: { snapshotId: "ukjent", expectedCurrentSnapshotId: null, useRegistryName: false },
    note: "Bekrefter egen forhåndsvisning (getOwned) med optimistisk sjekk og revisjonslogg.",
    prepareOwn: async (run, organizationId, userId) => ({
      snapshotId: await run((db) =>
        db.insert("registrySnapshots", {
          organizationId,
          source: "brreg-enhetsregisteret",
          orgNumber: "920000002",
          fetchedAt: Date.now(),
          fetchedBy: userId,
          selectedFields: SYNTHETIC_REGISTRY_PROFILE,
          sourcePayloadHash: "0".repeat(64),
          mappingVersion: "brreg-enhet-v1",
          status: "preview",
        }),
      ),
    }),
  },
  "organizations/applicability:assess": {
    kind: "mutation",
    ref: api.organizations.applicability.assess,
    boundary: "tenant",
    sampleArgs: { inputs: SYNTHETIC_APPLICABILITY_INPUT, confirmed: true },
    note: "Lagrer ny veiledende pliktvurdering; resultatet regnes ut på serveren. Med revisjonslogg.",
  },
  "organizations/applicability:history": {
    kind: "query",
    ref: api.organizations.applicability.history,
    boundary: "tenant",
    sampleArgs: {},
    note: "De siste pliktvurderingene for valgt organisasjon.",
  },
  "organizations/reportingPeriods:create": {
    kind: "mutation",
    ref: api.organizations.reportingPeriods.create,
    boundary: "tenant",
    sampleArgs: SYNTHETIC_PERIOD,
    note: "Oppretter rapportperiode i valgt organisasjon; datoene valideres på serveren. Med revisjonslogg.",
  },
  "organizations/reportingPeriods:list": {
    kind: "query",
    ref: api.organizations.reportingPeriods.list,
    boundary: "tenant",
    sampleArgs: {},
    note: "Rapportperiodene i valgt organisasjon (periodevelgeren).",
  },
  "organizations/businessProfile:save": {
    kind: "mutation",
    ref: api.organizations.businessProfile.save,
    boundary: "tenant",
    sampleArgs: { reportingPeriodId: "ukjent", answers: SYNTHETIC_PROFILE_ANSWERS, confirmed: false, expectedRevision: 0 },
    note: "Lagrer ny versjon av virksomhetsprofilen for egen periode (getOwned), med versjonssjekk og revisjonslogg.",
    prepareOwn: ownPeriod,
  },
  "organizations/businessProfile:current": {
    kind: "query",
    ref: api.organizations.businessProfile.current,
    boundary: "tenant",
    sampleArgs: { reportingPeriodId: "ukjent" },
    note: "Siste versjon og versjonshistorikk for egen periode (getOwned).",
    prepareOwn: ownPeriod,
  },
  "suppliers/mutations:create": {
    kind: "mutation",
    ref: api.suppliers.mutations.create,
    boundary: "tenant",
    sampleArgs: SYNTHETIC_SUPPLIER,
    note: "Oppretter leverandør i valgt organisasjon. Org.nr. er unikt per organisasjon (indeksoppslag). Med revisjonslogg.",
  },
  "suppliers/mutations:update": {
    kind: "mutation",
    ref: api.suppliers.mutations.update,
    boundary: "tenant",
    sampleArgs: { supplierId: "ukjent", expectedRowVersion: 1, ...SYNTHETIC_SUPPLIER },
    note: "Endrer egen leverandør (getOwned) med versjonssjekk og revisjonslogg.",
    prepareOwn: ownSupplier,
  },
  "suppliers/mutations:setArchived": {
    kind: "mutation",
    ref: api.suppliers.mutations.setArchived,
    boundary: "tenant",
    sampleArgs: { supplierId: "ukjent", expectedRowVersion: 1, archived: true },
    note: "Arkiverer eller gjenoppretter egen leverandør (getOwned). Ingenting slettes. Med revisjonslogg.",
    prepareOwn: ownSupplier,
  },
  "suppliers/mutations:savePeriod": {
    kind: "mutation",
    ref: api.suppliers.mutations.savePeriod,
    boundary: "tenant",
    sampleArgs: { supplierId: "ukjent", reportingPeriodId: "ukjent", expectedRowVersion: 0, ...SYNTHETIC_SUPPLIER_PERIOD },
    note: "Lagrer innkjøpsdata for egen leverandør i egen periode (getOwned på begge), med versjonssjekk og revisjonslogg.",
    prepareOwn: async (run, organizationId, userId) => ({
      ...(await ownSupplier(run, organizationId, userId)),
      ...(await ownPeriod(run, organizationId, userId)),
    }),
  },
  "suppliers/queries:list": {
    kind: "query",
    ref: api.suppliers.queries.list,
    boundary: "tenant",
    sampleArgs: { paginationOpts: { numItems: 5, cursor: null } },
    note: "Leverandører i valgt organisasjon, paginert over indeks som starter med organizationId.",
  },
  "suppliers/queries:get": {
    kind: "query",
    ref: api.suppliers.queries.get,
    boundary: "tenant",
    sampleArgs: { supplierId: "ukjent" },
    note: "Én egen leverandør (getOwned) med innkjøpsdata for egen periode (getOwned).",
    prepareOwn: ownSupplier,
  },
  "risk/queries:activeVersions": {
    kind: "query",
    ref: api.risk.queries.activeVersions,
    boundary: "tenant",
    sampleArgs: {},
    note: "Metadata og datakvalitet for aktive risikodataversjoner (globalt faggrunnlag). Aldri uaktiverte versjoner og aldri innholdet.",
  },
  "risk/queries:getVersion": {
    kind: "query",
    ref: api.risk.queries.getVersion,
    boundary: "tenant",
    sampleArgs: { kind: "country", versionId: "ukjent" },
    note: "Én aktiv eller pensjonert dataversjon (metadata). Uaktivert, ukjent og demo utenfor lokale miljøer gir «ikke funnet».",
    prepareOwn: async (run) => ({
      versionId: await run((db) =>
        db.insert("riskDatasetVersions", {
          kind: "country", version: "test-1", sourceTitle: "SYNTETISK TEST", sourceUrl: "https://example.com/test", sourceEdition: "test",
          retrievedAt: "2026-11-01", licenseStatus: "unclear", entryCount: 0, status: "active", environment: "demo", schemaVersion: "risk-dataset-v1",
          checksum: "0".repeat(64), importedAt: 0, importedBy: "test", activatedAt: 0, activatedBy: "test",
        }),
      ),
    }),
  },
  "risk/assessments:assessPeriod": {
    kind: "mutation",
    ref: api.risk.assessments.assessPeriod,
    boundary: "tenant",
    sampleArgs: { reportingPeriodId: "ukjent", cursor: null },
    note: "Beregner screening for egne aktive leverandører i egen periode (getOwned) og lagrer nye vurderinger. Kaster uten aktiv metodeversjon. Med revisjonslogg.",
    prepareOwn: async (run, organizationId, userId) => {
      await run((db) => db.insert("riskMethodVersions", SYNTHETIC_METHOD_VERSION_DOC));
      return await ownPeriod(run, organizationId, userId);
    },
  },
  "risk/assessments:latest": {
    kind: "query",
    ref: api.risk.assessments.latest,
    boundary: "tenant",
    sampleArgs: { supplierId: "ukjent", reportingPeriodId: "ukjent" },
    note: "Siste vurdering med status for egen leverandør i egen periode (getOwned på begge).",
    prepareOwn: async (run, organizationId, userId) => ({
      ...(await ownSupplier(run, organizationId, userId)),
      ...(await ownPeriod(run, organizationId, userId)),
    }),
  },
  "risk/assessments:history": {
    kind: "query",
    ref: api.risk.assessments.history,
    boundary: "tenant",
    sampleArgs: { supplierId: "ukjent", reportingPeriodId: "ukjent" },
    note: "Vurderingshistorikk for egen leverandør i egen periode (getOwned på begge).",
    prepareOwn: async (run, organizationId, userId) => ({
      ...(await ownSupplier(run, organizationId, userId)),
      ...(await ownPeriod(run, organizationId, userId)),
    }),
  },
  "risk/reviews:list": {
    kind: "query",
    ref: api.risk.reviews.list,
    boundary: "tenant",
    sampleArgs: { reportingPeriodId: "ukjent", offset: 0, limit: 10 },
    note: "Risikoprioritert liste og tellinger for egen periode (getOwned). Leser bare egne leverandører og vurderinger.",
    prepareOwn: async (run, organizationId, userId) => await ownPeriod(run, organizationId, userId),
  },
  "risk/reviews:detail": {
    kind: "query",
    ref: api.risk.reviews.detail,
    boundary: "tenant",
    sampleArgs: { supplierId: "ukjent", reportingPeriodId: "ukjent" },
    note: "Forklaring og kundens vurdering for egen leverandør i egen periode (getOwned på begge).",
    prepareOwn: async (run, organizationId, userId) => ({
      ...(await ownSupplier(run, organizationId, userId)),
      ...(await ownPeriod(run, organizationId, userId)),
    }),
  },
  "risk/reviews:record": {
    kind: "mutation",
    ref: api.risk.reviews.record,
    boundary: "tenant",
    sampleArgs: {
      supplierId: "ukjent", reportingPeriodId: "ukjent", assessmentId: "ukjent", expectedReviewId: null, decision: "confirm",
      rationale: "Syntetisk begrunnelse som er lang nok.",
    },
    note: "Bekrefter, overstyrer eller trekker tilbake en screening: getOwned på leverandør, periode og vurdering, begrunnelse, versjonssjekk og revisjonslogg.",
    // En egen, gjeldende vurdering: hashen og kildene stemmer med grunnlaget akkurat nå, så eget kall lykkes.
    prepareOwn: async (run, organizationId, userId) => {
      const supplier = await ownSupplier(run, organizationId, userId);
      const period = await ownPeriod(run, organizationId, userId);
      const methodVersionId = await run((db) => db.insert("riskMethodVersions", SYNTHETIC_METHOD_VERSION_DOC));
      const input = normalizeInput({ productionCountries: [], upstreamUnknown: true });
      const assessmentId = await run(async (db) =>
        db.insert("riskAssessments", {
          organizationId, supplierId: supplier.supplierId, reportingPeriodId: period.reportingPeriodId, methodVersionId,
          engineVersion: ENGINE_VERSION, inputSnapshot: input, inputHash: await inputHash(input),
          screeningLevel: "unknown", dataQuality: "insufficient", missingFields: [], triggeredRules: [], controlSignals: [],
          staleSources: [{ source: "method", version: SYNTHETIC_METHOD_VERSION_DOC.version, freshness: "unreviewed" }],
          assessedAt: Date.now(), assessedBy: userId,
        }),
      );
      return { ...supplier, ...period, assessmentId };
    },
  },
  "suppliers/enrichment:request": {
    kind: "mutation",
    ref: api.suppliers.enrichment.request,
    boundary: "tenant",
    sampleArgs: { supplierId: "ukjent" },
    note: "Ber om Brreg-oppslag for egen leverandør (getOwned) via enqueueJob. Bare egen leverandør med norsk org.nr.",
    prepareOwn: ownSupplierWithOrgNumber,
  },
  "suppliers/enrichment:requestMissing": {
    kind: "mutation",
    ref: api.suppliers.enrichment.requestMissing,
    boundary: "tenant",
    sampleArgs: {},
    note: "Ber om oppslag for egne aktive leverandører med org.nr., høyst 50 om gangen.",
  },
  "suppliers/enrichment:applySuggestion": {
    kind: "mutation",
    ref: api.suppliers.enrichment.applySuggestion,
    boundary: "tenant",
    sampleArgs: { supplierId: "ukjent", expectedRowVersion: 1, field: "registeredCountry", expectedValue: "NO" },
    note: "Godtar et registerforslag for egen leverandør (getOwned) med versjonssjekk og revisjonslogg.",
    prepareOwn: ownEnrichedSupplier,
  },
  "suppliers/enrichment:get": {
    kind: "query",
    ref: api.suppliers.enrichment.get,
    boundary: "tenant",
    sampleArgs: { supplierId: "ukjent" },
    note: "Beriketatus og registerforslag for egen leverandør (getOwned).",
    prepareOwn: ownSupplier,
  },
  "suppliers/import/actions:preview": {
    kind: "action",
    ref: api.suppliers.import.actions.preview,
    boundary: "tenant",
    sampleArgs: { file: new TextEncoder().encode("Navn\nSyntetisk Leverandør AS\n").buffer },
    note: "Leser en CSV-fil i minnet og foreslår matching mot egne leverandører. Endrer og lagrer ingenting.",
  },
  "suppliers/import/prepare:prepare": {
    kind: "action",
    ref: api.suppliers.import.prepare.prepare,
    boundary: "tenant",
    sampleArgs: {
      file: new TextEncoder().encode("Navn\nSyntetisk Leverandør AS\n").buffer,
      fileName: "syntetisk.csv",
      reportingPeriodId: "ukjent",
    },
    note: "Lager et importgrunnlag (normaliserte oppføringer, aldri råfilen) for egen periode. Endrer ingen leverandørdata.",
    prepareOwn: ownPeriod,
  },
  "suppliers/import/batches:list": {
    kind: "query",
    ref: api.suppliers.import.batches.list,
    boundary: "tenant",
    sampleArgs: {},
    note: "De siste importene i valgt organisasjon.",
  },
  "suppliers/import/batches:get": {
    kind: "query",
    ref: api.suppliers.import.batches.get,
    boundary: "tenant",
    sampleArgs: { batchId: "ukjent" },
    note: "Ett eget importgrunnlag (getOwned) med fellesvalg og antall.",
    prepareOwn: ownBatchOnly("draft"),
  },
  "suppliers/import/batches:rows": {
    kind: "query",
    ref: api.suppliers.import.batches.rows,
    boundary: "tenant",
    sampleArgs: { batchId: "ukjent", paginationOpts: { numItems: 5, cursor: null } },
    note: "Oppføringene i et eget importgrunnlag (getOwned), paginert.",
    prepareOwn: ownBatchOnly("draft"),
  },
  "suppliers/import/batches:setPolicy": {
    kind: "mutation",
    ref: api.suppliers.import.batches.setPolicy,
    boundary: "tenant",
    sampleArgs: { batchId: "ukjent", expectedRowVersion: 1, policy: { known: "skip" } },
    note: "Fellesvalg i et eget utkast (getOwned) med versjonssjekk. Endrer ingen leverandørdata.",
    prepareOwn: ownBatchOnly("draft"),
  },
  "suppliers/import/batches:decide": {
    kind: "mutation",
    ref: api.suppliers.import.batches.decide,
    boundary: "tenant",
    sampleArgs: { batchId: "ukjent", rowId: "ukjent", expectedRowVersion: 1, decision: "skip" },
    note: "Valg for én oppføring i et eget utkast. Batch, oppføring og valgt leverandør lastes med getOwned.",
    prepareOwn: ownBatch("draft"),
  },
  "suppliers/import/batches:startCommit": {
    kind: "mutation",
    ref: api.suppliers.import.batches.startCommit,
    boundary: "tenant",
    sampleArgs: { batchId: "ukjent", expectedRowVersion: 1 },
    note: "Bekrefter et eget utkast (getOwned) når alle oppføringer har valg. Med revisjonslogg.",
    prepareOwn: ownBatchOnly("draft"),
  },
  "suppliers/import/batches:commitChunk": {
    kind: "mutation",
    ref: api.suppliers.import.batches.commitChunk,
    boundary: "tenant",
    sampleArgs: { batchId: "ukjent" },
    note: "Gjennomfører neste stykke av en egen, bekreftet import (getOwned på batch og leverandører). Med revisjonslogg.",
    prepareOwn: ownBatchOnly("committing"),
  },
  "jobs/mutations:enqueue": {
    kind: "mutation",
    ref: api.jobs.mutations.enqueue,
    boundary: "tenant",
    sampleArgs: { type: "test.probe", inputRef: "ukjent", idempotencyKey: "syntetisk" },
    note: "Oppretter en bakgrunnsjobb av en tillatt type for et eget dokument (getOwned), idempotent. Med revisjonslogg.",
    prepareOwn: ownJobInput,
  },
  "jobs/queries:get": {
    kind: "query",
    ref: api.jobs.queries.get,
    boundary: "tenant",
    sampleArgs: { jobId: "ukjent" },
    note: "Status for én egen jobb (getOwned).",
    prepareOwn: ownJob,
  },
  "jobs/queries:list": {
    kind: "query",
    ref: api.jobs.queries.list,
    boundary: "tenant",
    sampleArgs: {},
    note: "De siste jobbene i valgt organisasjon.",
  },
  "organizations/registry:current": {
    kind: "query",
    ref: api.organizations.registry.current,
    boundary: "tenant",
    sampleArgs: {},
    note: "Bekreftede registeropplysninger for valgt organisasjon, med kilde og tider.",
  },
  "audit/queries:list": {
    kind: "query",
    ref: api.audit.queries.list,
    boundary: "tenant",
    sampleArgs: { paginationOpts: { numItems: 5, cursor: null } },
    note: "Revisjonslogg for valgt organisasjon (lesing, ingen endring).",
  },
  "invitations/queries:listForOrganization": {
    kind: "query",
    ref: api.invitations.queries.listForOrganization,
    boundary: "tenant",
    sampleArgs: {},
    note: "Invitasjoner i valgt organisasjon. Krever aktivt admin-medlemskap.",
  },
  "invitations/mutations:create": {
    kind: "mutation",
    ref: api.invitations.mutations.create,
    boundary: "tenant",
    sampleArgs: { email: "ny@register.example" },
    note: "Admin inviterer ny administrator til valgt organisasjon. Kan ikke velge rolle eller annen tenant.",
  },
  "invitations/mutations:revoke": {
    kind: "mutation",
    ref: api.invitations.mutations.revoke,
    boundary: "tenant",
    sampleArgs: { invitationId: "ukjent" },
    note: "Admin tilbakekaller ventende invitasjon i valgt organisasjon (getOwned).",
    prepareOwn: async (run, organizationId, userId) => ({
      invitationId: await run((db) =>
        db.insert("invitations", {
          organizationId,
          email: "tilbakekall@register.example",
          status: "pending",
          expiresAt: Date.now() + 60_000,
          invitedBy: userId,
        }),
      ),
    }),
  },
  "invitations/queries:lookup": {
    kind: "query",
    ref: api.invitations.queries.lookup,
    boundary: "invitation",
    sampleArgs: {},
    note: "Forhåndsvisning for den som har lenken: organisasjon, mottaker og om konto finnes.",
  },
  "invitations/mutations:acceptAsCurrentUser": {
    kind: "mutation",
    ref: api.invitations.mutations.acceptAsCurrentUser,
    boundary: "invitation",
    sampleArgs: {},
    note: "Innlogget bruker med samme verifiserte e-post som invitasjonen blir admin. Engangs.",
  },
  "invitations/actions:acceptWithNewAccount": {
    kind: "action",
    ref: api.invitations.actions.acceptWithNewAccount,
    boundary: "invitation",
    sampleArgs: { name: "Ny", password: "et-langt-passord" },
    note: "Ny konto for invitasjonens e-post (aldri brukervalgt) + medlemskap. Engangs.",
  },
  "account/actions:verifyEmail": {
    kind: "action",
    ref: api.account.actions.verifyEmail,
    boundary: "verification",
    sampleArgs: {},
    note: "Bekrefter e-post med Better Auths token fra lenken, uten token i URL. Returnerer bare ok.",
  },
};

/** Forventede HTTP-ruter. Alle andre ruter må vurderes og legges til her. */
export const reviewedHttpRoutes = [
  "GET /.well-known/openid-configuration",
  "GET /api/auth/*",
  "POST /api/auth/*",
] as const;
