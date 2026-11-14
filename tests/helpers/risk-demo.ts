/**
 * Importerer og aktiverer de syntetiske demo-filene (risk-data/demo/) på lokal test-backend med operatørkommandoene,
 * for integrasjons- og e2e-tester. Test-backenden består mellom kjøringer, så versjonene får unike navn per kall.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEST_BACKEND } from "./local-backend";
import { seal } from "./risk-data";

function operator(args: string[]) {
  const result = spawnSync("node", ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/risk-data-import.ts", ...args, "--operator", "Test", "--env-file", TEST_BACKEND.envFile], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${args.join(" ")} feilet: ${result.stdout}${result.stderr}`);
}

export async function activateDemoData(label: string) {
  const dir = mkdtempSync(join(tmpdir(), "risk-demo-"));
  const suffix = `${label}-${Date.now().toString(36)}`;
  for (const name of ["country", "industry", "method"] as const) {
    const manifest = JSON.parse(readFileSync(`risk-data/demo/${name}-demo-1.json`, "utf8"));
    const version = `${name}-${suffix}`;
    const file = join(dir, `${name}.json`);
    writeFileSync(file, JSON.stringify(await seal({ ...manifest, version, checksum: undefined })));
    operator(["--file", file]);
    operator(["--activate", "--kind", name, "--version", version]);
  }
}
