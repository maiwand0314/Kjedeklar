import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const rawConvexFunctions = {
  group: ["**/_generated/server", "**/_generated/server.js"],
  importNames: ["query", "mutation", "action"],
  message:
    "Bruk tenantQuery/tenantMutation/userQuery fra convex/lib/tenant.ts. Rå offentlige Convex-funksjoner omgår tenantvernet (CLAUDE.md, multi-tenant punkt 3).",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["convex/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [rawConvexFunctions] }],
    },
  },
  {
    // Eneste sted som får pakke inn rå funksjoner.
    files: ["convex/lib/tenant.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "convex/_generated/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
