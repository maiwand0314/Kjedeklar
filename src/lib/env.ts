import { z } from "zod";

/** Offentlige variabler valideres ved oppstart. Ingen hemmeligheter her. */
const schema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.url(),
  NEXT_PUBLIC_CONVEX_SITE_URL: z.url(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
});

if (!parsed.success) {
  throw new Error(
    "Ugyldige miljøvariabler: " +
      parsed.error.issues.map((i) => i.path.join(".")).join(", ") +
      ". Kjør `pnpm convex:setup:local` eller se .env.example.",
  );
}

export const publicEnv = {
  convexUrl: parsed.data.NEXT_PUBLIC_CONVEX_URL,
  convexSiteUrl: parsed.data.NEXT_PUBLIC_CONVEX_SITE_URL,
};

const serverSchema = z.object({
  AUTH_PROXY_SECRET: z.string().min(32),
  // Header med klientens IP, satt av en klarert reverse proxy foran Next.js
  // (overskrevet, ikke videresendt fra klienten). Se oppgave 25 for produksjon.
  AUTH_CLIENT_IP_SOURCE_HEADER: z.string().default("x-forwarded-for"),
});

/**
 * Serverhemmeligheter valideres ved første bruk (ikke ved bygg). Brukes bare i
 * route handlers og server actions.
 */
export function serverEnv() {
  const parsed = serverSchema.safeParse({
    AUTH_PROXY_SECRET: process.env.AUTH_PROXY_SECRET,
    AUTH_CLIENT_IP_SOURCE_HEADER: process.env.AUTH_CLIENT_IP_SOURCE_HEADER || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      "Ugyldige servervariabler: " +
        parsed.error.issues.map((i) => i.path.join(".")).join(", ") +
        ". Kjør `pnpm convex:setup:local` eller se .env.example.",
    );
  }
  return parsed.data;
}
