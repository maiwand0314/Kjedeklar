import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Nettleserklient. Snakker med /api/auth på samme opprinnelse (Next.js-proxy). */
export const authClient = createAuthClient({
  plugins: [convexClient()],
});
