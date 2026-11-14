/**
 * Importerer en validert versjon til en Convex-backend som `imported` (ikke
 * aktiv), eller aktiverer en importert versjon. Bare for operatør: bruker
 * admin key fra en env-fil lokalt, aldri fra appen og aldri via Next.js.
 *
 *   pnpm risk-data:import   -- --file <manifest> --operator "Navn" [--env-file .env.convex-dev.local]
 *   pnpm risk-data:activate -- --kind <country|industry|method> --version <versjon> --operator "Navn" [--env-file ...]
 *
 * Importen validerer filen lokalt først, og Convex validerer på nytt. Env-filen
 * må peke på en selvhostet backend (CONVEX_SELF_HOSTED_URL og
 * CONVEX_SELF_HOSTED_ADMIN_KEY). Mot Convex Cloud er dette ikke prøvd.
 */
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { checkFile, option, readEnvFile } from "./lib/risk-data.ts";

const args = process.argv.slice(2);
const mode = args.includes("--activate") ? "activate" : "import";
const operator = option(args, "--operator");
if (!operator) {
  console.error('Mangler --operator "Navn" (hvem som utfører endringen, lagres på versjonen).');
  process.exit(1);
}
const envFile = option(args, "--env-file") ?? ".env.convex-dev.local";
const env = readEnvFile(envFile);
const url = env.CONVEX_SELF_HOSTED_URL;
const adminKey = env.CONVEX_SELF_HOSTED_ADMIN_KEY;
if (!url || !adminKey) {
  console.error(`${envFile} mangler CONVEX_SELF_HOSTED_URL eller CONVEX_SELF_HOSTED_ADMIN_KEY.`);
  process.exit(1);
}

const client = new ConvexHttpClient(url);
// Samme kall som `convex run` bruker for interne funksjoner.
(client as unknown as { setAdminAuth(key: string): void }).setAdminAuth(adminKey);

try {
  if (mode === "import") {
    const file = option(args, "--file");
    if (!file) throw new Error("Mangler --file <manifest>.");
    const result = await checkFile(file);
    if (!result.ok) {
      console.error(`FEIL  ${file}\n${result.errors.map((e) => `        ${e}`).join("\n")}`);
      process.exit(1);
    }
    const ref = makeFunctionReference<"mutation">("risk/internal:importVersion");
    console.log(await client.mutation(ref, { operator, payload: result.raw }));
  } else {
    const kind = option(args, "--kind");
    const version = option(args, "--version");
    if (!kind || !version) throw new Error("Mangler --kind og --version.");
    const ref = makeFunctionReference<"mutation">("risk/internal:activateVersion");
    console.log(await client.mutation(ref, { operator, kind, version }));
  }
} catch (error) {
  const data = (error as { data?: { code?: string; details?: string[] } }).data;
  console.error(data?.code ? `AVVIST ${data.code}: ${(data.details ?? []).join("; ")}` : `Feilet: ${(error as Error).message}`);
  process.exit(1);
}
