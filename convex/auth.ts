import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

/**
 * Better Auth kjører i Convex. Åpen registrering er slått av: brukere opprettes
 * bare av interne funksjoner (seed nå, kontrollert invitasjon i oppgave 03).
 * BETTER_AUTH_SECRET og SITE_URL settes som miljøvariabler på deploymenten.
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL;
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: siteUrl ? [siteUrl] : [],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      minPasswordLength: 12,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        // Convex-backenden henter offentlige nøkler herfra for å verifisere hvert
        // token. Forespørslene har ingen klient-IP og havner i én delt teller.
        // Med ratebegrensning ville samtidige verifiseringer gi skrivekonflikter
        // (HTTP 500), og hvem som helst kunne brukt opp telleren og blokkert
        // innlogget bruk for alle. Endepunktet er offentlig, leser bare og har
        // ingen brukerdata.
        "/convex/jwks": false,
      },
    },
    plugins: [convex({ authConfig })],
  });
};
