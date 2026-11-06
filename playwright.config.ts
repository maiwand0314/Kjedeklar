import { defineConfig, devices } from "@playwright/test";

// E2E kjører mot den separate lokale test-backenden (docker compose: convex-test).
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "nb-NO",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Produksjonsbygg, ikke `next dev`: utviklerserveren kompilerer ruter ved første
  // besøk og kan laste siden på nytt midt i en navigering (ERR_ABORTED). Et bygg
  // er også nærmere det brukerne får. Offentlige variabler bakes inn ved bygg,
  // derfor egen byggmappe for test-backenden.
  webServer: {
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/logg-inn`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3220",
      NEXT_PUBLIC_CONVEX_SITE_URL: "http://127.0.0.1:3221",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
