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
        // Unntak fra ratebegrensningen. Uten klient-IP havner alle forespørsler
        // i én delt teller per sti. Den lot hvem som helst blokkere innlogget
        // bruk for alle, og ga feilaktige 429/500 under samtidige kall.
        // Innlogging (/sign-in) er fortsatt begrenset.
        // - JWKS: Convex-backenden henter offentlige nøkler herfra for å
        //   verifisere hvert token. Offentlig, leser bare, ingen brukerdata.
        "/convex/jwks": false,
        // - Token: Next.js henter Convex-token for hver sidevisning. Krever en
        //   gyldig sesjonscookie (tilfeldig, ikke gjettbar), så begrensningen
        //   beskytter ikke mot gjetting, men åpnet for tjenestenekt.
        "/convex/token": false,
      },
    },
    plugins: [convex({ authConfig })],
  });
};
