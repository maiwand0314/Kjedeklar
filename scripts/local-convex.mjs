#!/usr/bin/env node
/**
 * Lokal Convex-oppsett for dev eller test. Kjører bare mot lokale Docker-backends.
 *
 *   node scripts/local-convex.mjs <dev|test> setup   # admin key + env-variabler
 *   node scripts/local-convex.mjs <dev|test> deploy  # setup + push skjema/funksjoner
 *
 * Skriver .env.convex-<target>.local (kun for Convex CLI; leses aldri av Next.js)
 * og, for dev, .env.local med offentlige Next.js-variabler hvis filen mangler.
 * Ingen hemmeligheter skrives til git (alle .env*-filer er ignorert).
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TARGETS = {
  dev: {
    service: "convex",
    url: "http://127.0.0.1:3210",
    siteUrl: "http://127.0.0.1:3211",
    appUrl: "http://localhost:3000",
    env: "development",
  },
  test: {
    service: "convex-test",
    url: "http://127.0.0.1:3220",
    siteUrl: "http://127.0.0.1:3221",
    appUrl: "http://localhost:3100",
    env: "test",
  },
};

const [targetName, command = "setup"] = process.argv.slice(2);
const target = TARGETS[targetName];
if (!target || !["setup", "deploy"].includes(command)) {
  console.error("Bruk: node scripts/local-convex.mjs <dev|test> <setup|deploy>");
  process.exit(1);
}
const envFile = `.env.convex-${targetName}.local`;

function parseEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

function adminKey() {
  const out = execFileSync(
    "docker",
    ["compose", "exec", "-T", target.service, "./generate_admin_key.sh"],
    { encoding: "utf8" },
  );
  const key = out.trim().split("\n").pop()?.trim();
  if (!key || !key.includes("|")) throw new Error("Fant ikke admin key fra containeren.");
  return key;
}

const convex = (args, opts = {}) =>
  execFileSync("pnpm", ["exec", "convex", ...args, "--env-file", envFile], {
    input: opts.input,
    stdio: [opts.input === undefined ? "ignore" : "pipe", opts.capture ? "pipe" : "inherit", "inherit"],
    encoding: "utf8",
  });

// 1. Admin key for CLI (regenereres hver gang; test-backend får ny nøkkel ved restart).
const previous = parseEnv(envFile);
const seedPassword =
  previous.SEED_USER_PASSWORD || (targetName === "dev" ? randomBytes(12).toString("base64url") : "");
writeFileSync(
  envFile,
  [
    "# Generert av scripts/local-convex.mjs. Kun Convex CLI. Ikke commit.",
    `CONVEX_SELF_HOSTED_URL=${target.url}`,
    `CONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey()}`,
    ...(seedPassword ? [`SEED_USER_PASSWORD=${seedPassword}`] : []),
    "",
  ].join("\n"),
  { mode: 0o600 },
);

// 2. Offentlige Next.js-variabler for dev.
if (targetName === "dev" && !existsSync(".env.local")) {
  writeFileSync(
    ".env.local",
    [
      "# Generert av scripts/local-convex.mjs. Offentlige verdier for lokal utvikling.",
      `NEXT_PUBLIC_CONVEX_URL=${target.url}`,
      `NEXT_PUBLIC_CONVEX_SITE_URL=${target.siteUrl}`,
      `NEXT_PUBLIC_SITE_URL=${target.appUrl}`,
      "",
    ].join("\n"),
  );
}

// 3. Miljøvariabler på deploymenten. Hemmeligheter genereres lokalt og vises ikke.
const existing = convex(["env", "list"], { capture: true });
// `env list` viser enten NAME=verdi eller bare NAME (f.eks. når CLI-en kjøres av en
// AI-agent). Begge betyr at variabelen finnes; da skal hemmeligheten ikke byttes,
// ellers blir eksisterende sesjoner og signeringsnøkler ugyldige.
const has = (name) =>
  existing.split("\n").some((l) => l.trim() === name || l.startsWith(`${name}=`));
const setEnv = (name, value) => convex(["env", "set", name, value], { capture: true });
// Hemmeligheter sendes via stdin, ikke som argument, så de ikke vises i prosesslisten.
const setSecret = (name, value) => convex(["env", "set", name], { capture: true, input: value });
if (!has("BETTER_AUTH_SECRET")) setSecret("BETTER_AUTH_SECRET", randomBytes(32).toString("base64"));
setEnv("SITE_URL", target.appUrl);
setEnv("KJEDEKLAR_ENV", target.env);
if (seedPassword) setSecret("SEED_USER_PASSWORD", seedPassword);
console.log(`Lokal Convex-backend (${targetName}) er konfigurert: ${target.url}`);

if (command === "deploy") {
  convex(["dev", "--once", "--typecheck", "disable", "--tail-logs", "disable"]);
}
