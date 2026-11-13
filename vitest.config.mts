import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: "convex",
          include: ["tests/convex/**/*.test.ts"],
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test", "@convex-dev/better-auth", "@convex-dev/workpool", "@convex-dev/batch-worker"] } },
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // Innloggingsbegrensningen i Better Auth kan gi ventetid mellom innlogginger.
          testTimeout: 60_000,
          hookTimeout: 90_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
