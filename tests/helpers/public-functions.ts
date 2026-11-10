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
