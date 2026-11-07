import { httpRouter } from "convex/server";
import { authComponent, createAuthForHttp } from "./auth";

const http = httpRouter();

// Better Auth-ruter (/api/auth/*). Next.js proxyer hit via src/app/api/auth/[...all].
// createAuthForHttp godtar klient-IP bare fra proxyen (se src/domain/auth-proxy.ts).
authComponent.registerRoutes(http, createAuthForHttp);

export default http;
