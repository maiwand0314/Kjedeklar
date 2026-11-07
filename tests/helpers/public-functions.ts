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

/* eslint-disable @typescript-eslint/no-explicit-any -- registeret holder funksjoner med ulike argumenttyper */
type PublicQuery = FunctionReference<"query", "public", any, any>;
type PublicMutation = FunctionReference<"mutation", "public", any, any>;
type PublicAction = FunctionReference<"action", "public", any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

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
  prepareOwn?: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- convex-test sin db er generisk
    run: <T>(fn: (db: any) => Promise<T>) => Promise<T>,
    organizationId: string,
    userId: string,
  ) => Promise<Record<string, unknown>>;
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
