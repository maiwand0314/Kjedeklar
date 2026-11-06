/// <reference types="vite/client" />
/**
 * Oversikt over alle registrerte Convex-funksjoner i appen, hentet fra selve
 * modulene. Brukes av registertestene (convex-test) og integrasjonstestene, så
 * en ny offentlig eller intern funksjon ikke kan legges til uten at den blir
 * vurdert og testet.
 */
export type FunctionKind = "query" | "mutation" | "action";
export type Visibility = "public" | "internal";

export type ConvexFunctionInfo = {
  /** Funksjonsnavn slik klienten adresserer det, f.eks. `organizations/queries:current`. */
  path: string;
  kind: FunctionKind;
  visibility: Visibility;
  /** JSON-eksport av argumentvalidatoren. */
  args: unknown;
  /** JSON-eksport av returvalidatoren, eller `null` hvis den mangler. */
  returns: unknown;
};

type RegisteredFunction = {
  isQuery?: boolean;
  isMutation?: boolean;
  isAction?: boolean;
  isPublic?: boolean;
  isInternal?: boolean;
  exportArgs: () => string;
  exportReturns: () => string;
};

const modules = import.meta.glob<Record<string, unknown>>(
  [
    "../../convex/**/*.ts",
    "!../../convex/_generated/**",
    "!../../convex/**/*.d.ts",
    "!../../convex/convex.config.ts",
  ],
  { eager: true },
);

function isRegistered(value: unknown): value is RegisteredFunction {
  if (typeof value !== "function") return false;
  const f = value as unknown as RegisteredFunction;
  return (
    (f.isQuery === true || f.isMutation === true || f.isAction === true) &&
    typeof f.exportArgs === "function"
  );
}

export function listConvexFunctions(): ConvexFunctionInfo[] {
  const result: ConvexFunctionInfo[] = [];
  for (const [file, exports] of Object.entries(modules)) {
    const modulePath = file
      .replace(/^\.\.\/\.\.\/convex\//, "")
      .replace(/\.ts$/, "");
    for (const [name, value] of Object.entries(exports)) {
      if (!isRegistered(value)) continue;
      result.push({
        path: `${modulePath}:${name}`,
        kind: value.isQuery ? "query" : value.isMutation ? "mutation" : "action",
        visibility: value.isPublic ? "public" : "internal",
        args: JSON.parse(value.exportArgs()),
        returns: JSON.parse(value.exportReturns()),
      });
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

export const publicFunctions = () =>
  listConvexFunctions().filter((f) => f.visibility === "public");

export const internalFunctions = () =>
  listConvexFunctions().filter((f) => f.visibility === "internal");
