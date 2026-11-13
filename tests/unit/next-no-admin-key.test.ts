/**
 * Next.js er en klient av Convex og skal aldri ha deploy key eller admin key:
 * med en slik nøkkel kan interne funksjoner (også jobbfunksjonene) kalles
 * utenom tenantvernet. Statisk kontroll av koden Next.js bygger og kjører.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const sources = [...files("src"), "next.config.ts", "playwright.config.ts"].filter((path) => /\.(ts|tsx|mjs)$/.test(path));
const KEY = /CONVEX_(SELF_HOSTED_)?ADMIN_KEY|CONVEX_DEPLOY_KEY|setAdminAuth|\.env\.convex-/;

test("ingen kode i Next.js leser deploy key, admin key eller env-filene til Convex CLI", () => {
  expect(sources.length).toBeGreaterThan(50);
  expect(sources.filter((path) => KEY.test(readFileSync(path, "utf8")))).toEqual(
    // Playwright leser bare proxy-hemmeligheten fra test-env-filen, aldri admin key.
    ["playwright.config.ts"],
  );
  const playwright = readFileSync("playwright.config.ts", "utf8");
  expect(playwright).toMatch(/AUTH_PROXY_SECRET=/);
  expect(playwright).not.toMatch(/ADMIN_KEY|DEPLOY_KEY/);
});

test("eksempelfilen for miljøvariabler har ingen Convex-nøkkel for Next.js", () => {
  expect(readFileSync(".env.example", "utf8")).not.toMatch(/^\s*(NEXT_PUBLIC_)?CONVEX_(SELF_HOSTED_)?(ADMIN|DEPLOY)_KEY\s*=/m);
});

test("Next.js importerer bare offentlige Convex-funksjoner (lint-regelen finnes)", () => {
  const eslint = readFileSync("eslint.config.mjs", "utf8");
  expect(eslint).toMatch(/importNames: \["internal", "components"\]/);
  const importsInternal = /import\s*\{[^}]*\binternal\b[^}]*\}\s*from\s*["'][^"']*_generated\/api["']/;
  expect(sources.filter((path) => importsInternal.test(readFileSync(path, "utf8")))).toEqual([]);
});
