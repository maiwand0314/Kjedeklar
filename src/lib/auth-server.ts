import "server-only";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { publicEnv } from "./env";

/**
 * Serverhjelpere for Better Auth + Convex. Bruker bare brukerens sesjonscookie
 * og offentlig Convex-URL; Next.js har aldri admin/deploy key.
 */
export const {
  handler,
  getToken,
  isAuthenticated,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl: publicEnv.convexUrl,
  convexSiteUrl: publicEnv.convexSiteUrl,
});
