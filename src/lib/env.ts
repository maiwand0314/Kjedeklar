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
