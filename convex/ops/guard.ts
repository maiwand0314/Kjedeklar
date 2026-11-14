/**
 * Vern for operatør-/utviklingsfunksjoner. Seed og testfixtures skal aldri kunne
 * kjøres mot staging/produksjon: både KJEDEKLAR_ENV og deploymentens egen URL
 * (CONVEX_CLOUD_URL, satt av Convex) må vise et lokalt miljø.
 */
export type LocalEnv = "development" | "test";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isLocalDeploymentUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function assertLocalEnv(allowed: readonly LocalEnv[]): LocalEnv {
  const env = process.env.KJEDEKLAR_ENV;
  if (!env || !(allowed as readonly string[]).includes(env)) {
    throw new Error(
      `Nektet: KJEDEKLAR_ENV=${env ?? "(mangler)"} er ikke ${allowed.join("/")}.`,
    );
  }
  if (!isLocalDeploymentUrl(process.env.CONVEX_CLOUD_URL)) {
    throw new Error("Nektet: deploymenten er ikke en lokal backend.");
  }
  return env as LocalEnv;
}

/** Som assertLocalEnv, men gir svar i stedet for å kaste. */
export function isLocalEnv(allowed: readonly LocalEnv[] = ["development", "test"]): boolean {
  try {
    assertLocalEnv(allowed);
    return true;
  } catch {
    return false;
  }
}
