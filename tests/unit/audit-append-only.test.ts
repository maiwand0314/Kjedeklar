import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

/** Alle .ts-filer i convex/ unntatt genererte. */
function sources(dir = "convex"): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "_generated") return [];
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

test("ingen Convex-funksjon oppdaterer, erstatter eller sletter auditEvents", () => {
  const offenders = sources().filter((file) =>
    /\.(patch|replace|delete)\(\s*["']auditEvents["']/.test(readFileSync(file, "utf8")),
  );
  expect(offenders).toEqual([]);
});

test("auditEvents skrives bare via convex/lib/audit.ts", () => {
  const writers = sources().filter((file) =>
    /\.insert\(\s*["']auditEvents["']/.test(readFileSync(file, "utf8")),
  );
  expect(writers).toEqual(["convex/lib/audit.ts"]);
});
