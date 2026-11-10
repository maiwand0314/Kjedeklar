/**
 * Statisk kontroll av at CSV-forhåndsvisningen ikke kan lagre eller logge
 * filen: koden på veien fra opplasting til svar inneholder ingen skriving til
 * database eller fillagring, ingen planlegging og ingen logging.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const DIRECTORIES = ["src/domain/import", "convex/suppliers/import", "src/modules/suppliers/components/import"];
const FILES = ["src/modules/suppliers/import-actions.ts", "src/app/(app)/o/[organizationId]/leverandorer/import/page.tsx"];
const FORBIDDEN: Array<[RegExp, string]> = [
  [/console\s*\./, "logging"],
  [/\bstorage\b/i, "fillagring"],
  [/\bdb\s*\.\s*(insert|patch|replace|delete)\b/, "skriving til databasen"],
  [/runMutation|internalMutation|tenantMutation|scheduler|runAfter|runAction/, "mutasjon eller planlagt jobb"],
  [/localStorage|sessionStorage|indexedDB|document\.cookie/, "lagring i nettleseren"],
  [/\bfetch\s*\(/, "nettverkskall utenom Convex-klienten"],
];

const sources = [...DIRECTORIES.flatMap((dir) => readdirSync(dir).map((file) => join(dir, file))), ...FILES];

test("alle filene i forhåndsvisningen er med i kontrollen", () => {
  expect(sources.length).toBeGreaterThanOrEqual(15);
  expect(sources).toContain("convex/suppliers/import/actions.ts");
  expect(sources).toContain("src/domain/import/csv.ts");
});

test.each(sources)("%s lagrer og logger ingenting", (path) => {
  const code = readFileSync(path, "utf8")
    // Kommentarer forklarer at filen ikke lagres; de er ikke kode.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  for (const [pattern, what] of FORBIDDEN) expect(code, `${path}: ${what}`).not.toMatch(pattern);
});
