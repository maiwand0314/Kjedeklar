import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Better Auth-ruter (/api/auth/*). Next.js proxyer hit via src/app/api/auth/[...all].
authComponent.registerRoutes(http, createAuth);

export default http;
