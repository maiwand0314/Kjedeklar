import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const rawConvexFunctions = {
  group: ["**/_generated/server", "**/_generated/server.js"],
  importNames: ["query", "mutation", "action"],
  message:
    "Bruk tenantQuery/tenantMutation/userQuery fra convex/lib/tenant.ts. Rå offentlige Convex-funksjoner omgår tenantvernet (CLAUDE.md, multi-tenant punkt 3).",
};

const genericConvexFunctions = {
  name: "convex/server",
  importNames: ["queryGeneric", "mutationGeneric", "actionGeneric", "httpActionGeneric"],
  message:
    "Generiske Convex-byggere gir rå offentlige funksjoner. Bruk tenant-byggeklossene i convex/lib/tenant.ts.",
};

// Better Auth-komponentens funksjoner (og dermed dens tabeller) nås bare via
// `authComponent` i convex/auth.ts. Appens kode leser autentisert bruker gjennom
// komponentens API, aldri bruker-/sesjonstabellene direkte.
const betterAuthComponent = {
  group: ["**/_generated/api", "**/_generated/api.js"],
  importNames: ["components"],
  message:
    "Better Auth-komponenten brukes bare via authComponent i convex/auth.ts. Ikke les auth-tabellene direkte (docs/decisions/0002-tenant-boundary.md).",
};

// Next.js-koden er en klient av Convex: bare offentlige funksjoner (`api`) og typer.
const nextToConvexInternals = [
  {
    group: ["**/convex/_generated/api", "**/convex/_generated/api.js"],
    importNames: ["internal", "components"],
    message:
      "Next.js kan ikke kalle interne funksjoner eller Better Auth-komponenten. Bruk offentlige tenantfunksjoner via `api`.",
  },
  {
    group: [
      "**/convex/_generated/server",
      "**/convex/_generated/server.js",
      "**/convex/lib/**",
      "**/convex/ops/**",
      "**/convex/auth",
      "**/convex/auth.ts",
      "**/convex/http",
      "**/convex/http.ts",
    ],
    message:
      "Next.js skal ikke importere Convex-serverkode. Bruk offentlige funksjoner via `api` og typer fra `_generated/dataModel`.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["convex/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [genericConvexFunctions],
          patterns: [rawConvexFunctions, betterAuthComponent],
        },
      ],
    },
  },
  {
    // Eneste sted som får pakke inn rå funksjoner. Komponenten er fortsatt sperret.
    files: ["convex/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [betterAuthComponent] }],
    },
  },
  {
    // Eneste sted som får koble til Better Auth-komponenten.
    files: ["convex/auth.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [genericConvexFunctions], patterns: [rawConvexFunctions] },
      ],
    },
  },
  {
    // Eneste sted som får koble til workpool-komponenten for bakgrunnsjobber.
    files: ["convex/jobs/pool.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [genericConvexFunctions], patterns: [rawConvexFunctions] },
      ],
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: nextToConvexInternals }],
    },
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
