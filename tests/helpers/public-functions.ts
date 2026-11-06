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
 */
import type { FunctionReference } from "convex/server";
import { api } from "../../convex/_generated/api";

/* eslint-disable @typescript-eslint/no-explicit-any -- registeret holder funksjoner med ulike argumenttyper */
type PublicQuery = FunctionReference<"query", "public", any, any>;
type PublicMutation = FunctionReference<"mutation", "public", any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

type Common = {
  boundary: "tenant" | "user";
  /** Argumenter i tillegg til `organizationId` for tenantfunksjoner. */
  sampleArgs: Record<string, unknown>;
  /** Hvorfor funksjonen er offentlig og hva den gir tilgang til. */
  note: string;
};

export type PublicFunctionReview =
  | (Common & { kind: "query"; ref: PublicQuery })
  | (Common & { kind: "mutation"; ref: PublicMutation });

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
};

/** Forventede HTTP-ruter. Alle andre ruter må vurderes og legges til her. */
export const reviewedHttpRoutes = [
  "GET /.well-known/openid-configuration",
  "GET /api/auth/*",
  "POST /api/auth/*",
] as const;
