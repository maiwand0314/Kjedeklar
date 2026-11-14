/** Felles hjelpere for operatørskriptene risk-data-*. Kjøres direkte av Node (ingen byggesteg). */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { manifestChecksum } from "../../src/domain/risk/datasets/checksum.ts";
import { validateManifest } from "../../src/domain/risk/datasets/validate.ts";

export function loadJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file}: kunne ikke leses som JSON (${(error as Error).message})`);
  }
}

/** Alle .json-filer under en mappe (eller selve filen). */
export function manifestFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? manifestFiles(join(path, e.name)) : e.name.endsWith(".json") ? [join(path, e.name)] : [],
  );
}

/** Validerer en fil og kontrollerer at checksum stemmer. Gir feilene som tekstlinjer. */
export async function checkFile(file: string) {
  const checked = validateManifest(loadJson(file));
  if (!checked.ok) return { ok: false as const, errors: checked.errors };
  const expected = await manifestChecksum(checked.manifest);
  if (expected !== checked.manifest.checksum) {
    return { ok: false as const, errors: [`checksum stemmer ikke med innholdet (forventet ${expected})`] };
  }
  return { ok: true as const, manifest: checked.manifest, raw: loadJson(file) };
}

/** Leser KEY=verdi fra en env-fil. Verdiene skrives aldri ut. */
export function readEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
