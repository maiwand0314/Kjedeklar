import type { NextConfig } from "next";

// Cache Components er bevisst ikke slått på: sider med kundedata skal rendres
// dynamisk per forespørsel og aldri caches globalt (CLAUDE.md, punkt 7).
const nextConfig: NextConfig = {
  // Egen byggmappe for e2e, så den kan kjøre ved siden av `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  experimental: {
    // CSV-import sender filer på inntil 2 MiB gjennom en server-action (standard er 1 MB).
    // Litt rom for multipart-rammen. Convex håndhever den egentlige grensen.
    serverActions: { bodySizeLimit: "3mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
