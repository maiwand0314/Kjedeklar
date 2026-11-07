import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { CLIENT_IP_HEADER, sanitizeProxyHeaders } from "../src/domain/auth-proxy";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { ActionCtx, QueryCtx } from "./_generated/server";
import authConfig from "./auth.config";
import { seal } from "./email/seal";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

type AuthEmailKind = "reset" | "verify";

/**
 * Planlegger en e-post fra Better Auth. Lenken (med engangstoken) forsegles, så
 * den ikke ligger i klartekst i argumentene til den planlagte funksjonen.
 * Planlegging i stedet for direkte sending gir lik svartid uansett om kontoen
 * finnes, og SMTP-feil stopper ikke selve forespørselen.
 */
async function scheduleAuthEmail(
  ctx: GenericCtx<DataModel>,
  kind: AuthEmailKind,
  to: string,
  url: string,
) {
  if (!("scheduler" in ctx)) {
    throw new Error("Auth-e-post kan bare sendes fra en mutasjon eller action.");
  }
  await ctx.scheduler.runAfter(0, internal.email.actions.sendAuthEmail, {
    kind,
    to,
    sealedUrl: await seal(url),
  });
}

/** Lenke til en side i appen med engangstoken i fragmentet (sendes aldri til server). */
function tokenLink(path: string, token: string): string {
  const siteUrl = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
  return `${siteUrl}${path}#token=${encodeURIComponent(token)}`;
}

/**
 * Better Auth kjører i Convex. Åpen registrering er av: brukere opprettes bare
 * via invitasjon eller interne funksjoner. BETTER_AUTH_SECRET, SITE_URL og
 * AUTH_PROXY_SECRET settes som miljøvariabler på deploymenten.
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
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      resetPasswordTokenExpiresIn: 60 * 60,
      // Ny passord logger ut alle sesjoner. safeGetAuthUser sjekker sesjonen i
      // hvert Convex-kall, så allerede utstedte Convex-token virker heller ikke.
      revokeSessionsOnPasswordReset: true,
      // Lenken peker til appens side med tokenet i URL-fragmentet (#), som
      // nettleseren aldri sender til noen server. Da havner tokenet ikke i
      // tilgangslogger (Convex, reverse proxy). Siden sender det i POST-body.
      sendResetPassword: async ({ user, token }) => {
        await scheduleAuthEmail(ctx, "reset", user.email, tokenLink("/tilbakestill-passord", token));
      },
    },
    emailVerification: {
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, token }) => {
        await scheduleAuthEmail(ctx, "verify", user.email, tokenLink("/bekreft-epost", token));
      },
    },
    // Reset- og verifiseringstoken lagres hashet i komponentens tabell.
    verification: { storeIdentifier: "hashed" },
    advanced: {
      // Satt av Next.js-proxyen og bare godtatt med riktig proxy-hemmelighet
      // (se createAuthForHttp og src/domain/auth-proxy.ts).
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        // Unntak: JWKS er offentlige nøkler Convex selv henter for å verifisere
        // token; tokenendepunktet krever gyldig sesjonscookie. Se oppgave 02.
        "/convex/jwks": false,
        "/convex/token": false,
        // Per klient-IP (eller felles bøtte for kall uten klarert IP).
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
        "/reset-password": { window: 300, max: 5 },
        "/send-verification-email": { window: 300, max: 3 },
      },
    },
    plugins: [convex({ authConfig, jwt: { expirationSeconds: 5 * 60 } })],
  });
};

/**
 * Brukes av HTTP-rutene. Fjerner klient-IP-headeren før Better Auth ser
 * forespørselen, med mindre den kommer fra Next.js-proxyen med riktig
 * hemmelighet. Uten dette kunne hvem som helst forfalske IP og omgå
 * ratebegrensningen ved å kalle Convex direkte.
 */
export const createAuthForHttp = (ctx: GenericCtx<DataModel>) => {
  const auth = createAuth(ctx);
  const handler = auth.handler;
  auth.handler = (request: Request) =>
    handler(
      new Request(request, {
        headers: sanitizeProxyHeaders(request.headers, process.env.AUTH_PROXY_SECRET),
      }),
    );
  return auth;
};

export type AuthUser = { id: string; email: string; emailVerified: boolean; name: string };

/** Innlogget bruker fra verifisert sesjon, eller undefined. */
export async function currentAuthUser(ctx: QueryCtx | ActionCtx): Promise<AuthUser | undefined> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) return undefined;
  return { id: user._id, email: user.email, emailVerified: user.emailVerified, name: user.name };
}

/** Finnes det en konto for e-postadressen? Leser komponenten via dens API. */
export async function authUserIdByEmail(
  ctx: QueryCtx | ActionCtx,
  email: string,
): Promise<string | undefined> {
  const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: email.trim().toLowerCase() }],
  })) as { _id: string } | null;
  return user?._id;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Oppretter en e-post/passord-bruker via Better Auths interne adapter. Bare for
 * interne funksjoner og invitasjonsaksept; åpen registrering er av.
 * `emailVerified` settes bare når e-postadressen er bevist (f.eks. via
 * invitasjonslenken som ble sendt dit).
 */
export async function createPasswordUser(
  ctx: ActionCtx,
  input: { email: string; name: string; password: string; emailVerified: boolean },
): Promise<string> {
  if (input.password.length < PASSWORD_MIN_LENGTH || input.password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Passordet må ha ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} tegn.`);
  }
  const context = await createAuth(ctx).$context;
  const user = await context.internalAdapter.createUser(
    { email: normalizeEmail(input.email), name: input.name, emailVerified: input.emailVerified },
    { method: "admin" },
  );
  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await context.password.hash(input.password),
  });
  return user.id;
}

/** Sletter en bruker (rydding når invitasjonsaksept feiler etter opprettelse). */
export async function deleteAuthUser(ctx: ActionCtx, userId: string) {
  const context = await createAuth(ctx).$context;
  await context.internalAdapter.deleteUser(userId);
}
