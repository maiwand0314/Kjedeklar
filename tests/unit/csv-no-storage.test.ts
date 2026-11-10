/**
 * Statisk kontroll av at CSV-forhåndsvisningen ikke kan lagre eller logge
 * filen: koden på veien fra opplasting til svar inneholder ingen skriving til
 * database eller fillagring, ingen planlegging og ingen logging.
 *
 * Importgrunnlaget (oppgave 11) lagrer normaliserte oppføringer. For den koden
 * kontrolleres det at filen bare tas imot ett sted, og at verken bytes eller
 * teksten fra filens celler sendes videre til lagring.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const DIRECTORIES = ["src/domain/import"];
const FILES = [
  "convex/suppliers/import/actions.ts",
  "convex/suppliers/import/internal.ts",
  "convex/suppliers/import/validators.ts",
  "src/modules/suppliers/import-actions.ts",
  "src/modules/suppliers/import-options.ts",
  "src/modules/suppliers/components/import/import-preview.tsx",
  "src/modules/suppliers/components/import/preview-table.tsx",
];
/** Koden som lagrer importgrunnlaget. */
const STORING = ["convex/suppliers/import/prepare.ts", "convex/suppliers/import/store.ts", "convex/suppliers/import/batches.ts"];
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
  expect(sources.length).toBeGreaterThanOrEqual(14);
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

test("importgrunnlaget tar bare imot filen i prepare-actionen og sender den aldri til lagring", () => {
  const code = Object.fromEntries(STORING.map((path) => [path, readFileSync(path, "utf8")]));
  // Bare actionen har et argument med bytes; mutasjonene som lagrer, har ingen.
  expect(Object.entries(code).filter(([, text]) => text.includes("v.bytes()")).map(([path]) => path)).toEqual(["convex/suppliers/import/prepare.ts"]);
  for (const [path, text] of Object.entries(code)) {
    expect(text, `${path}: fillagring`).not.toMatch(/\bstorage\b/i);
    expect(text, `${path}: logging`).not.toMatch(/console\s*\./);
    // «source» er teksten fra cellene i filen. Den finnes i forhåndsvisningen, men lagres ikke.
    expect(text, `${path}: tekst fra filen`).not.toMatch(/\bsource\b/);
  }
  // Filen brukes til å lese innholdet og til en hash, og sendes ikke som argument til en mutasjon.
  const calls = [...code["convex/suppliers/import/prepare.ts"].matchAll(/runMutation\([^;]*?\);/gs)].map((m) => m[0]);
  expect(calls.length).toBe(3);
  for (const call of calls) expect(call.replace(/sha256\(file\)/, "")).not.toMatch(/\bfile\b(?!Name|Hash)/);
});
