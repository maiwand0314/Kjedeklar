/**
 * Validerer risikodata uten å røre noen backend.
 *
 *   pnpm risk-data:validate                       # alt under risk-data/
 *   pnpm risk-data:validate -- --file <manifest>  # én fil
 *   pnpm risk-data:validate -- --file <manifest> --print-checksum
 *
 * Kontrollerer form, duplikater, tvetydig mapping, datoer, metodens regler og
 * at `checksum` stemmer. `--print-checksum` skriver forventet checksum, som
 * lages først etter at innholdet og godkjenningen er ferdig.
 */
import { manifestChecksum } from "../src/domain/risk/datasets/checksum.ts";
import { validateManifest } from "../src/domain/risk/datasets/validate.ts";
import { checkFile, loadJson, manifestFiles, option } from "./lib/risk-data.ts";

const args = process.argv.slice(2);
const target = option(args, "--file") ?? "risk-data";

if (args.includes("--print-checksum")) {
  const checked = validateManifest({ ...(loadJson(target) as object), checksum: "0".repeat(64) });
  if (!checked.ok) {
    console.error(checked.errors.join("\n"));
    process.exit(1);
  }
  console.log(await manifestChecksum(checked.manifest));
  process.exit(0);
}

let failed = 0;
for (const file of manifestFiles(target)) {
  const result = await checkFile(file);
  if (result.ok) {
    const m = result.manifest;
    console.log(`OK    ${file}  ${m.kind} ${m.version} (${m.environment})`);
  } else {
    failed++;
    console.error(`FEIL  ${file}\n${result.errors.map((e) => `        ${e}`).join("\n")}`);
  }
}
if (failed) process.exit(1);
