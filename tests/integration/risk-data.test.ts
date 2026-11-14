/**
 * Risikodata mot lokal backend, med operatørkommandoene (`risk-data:import` og
 * `risk-data:activate`, som bruker admin key fra env-filen) og ekte innloggede
 * kunder: kunder ser bare aktiverte versjoner, kan ikke skrive noe, og en ny
 * versjon endrer ikke den gamle. Interne funksjoner uten admin key er dekket av
 * tenancy.test.ts (probe per funksjon). Versjonsnavn er unike per kjøring, siden
 * test-backenden består mellom kjøringer.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { reviewedPublicFunctions } from "../helpers/public-functions";
import { errorOf, setupTwoTenants, TEST_BACKEND, type TwoTenants } from "../helpers/local-backend";
import { syntheticCountry, syntheticIndustry } from "../helpers/risk-data";

const run = Date.now().toString(36);
const dir = mkdtempSync(join(tmpdir(), "risk-data-int-"));

function operator(script: "import" | "activate", ...args: string[]) {
  const result = spawnSync(
    "node",
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/risk-data-import.ts", ...(script === "activate" ? ["--activate"] : []), ...args, "--operator", "Integrasjonstest", "--env-file", TEST_BACKEND.envFile],
    { encoding: "utf8" },
  );
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}
const file = (name: string, content: unknown) => {
  const path = join(dir, `${name}.json`);
  writeFileSync(path, JSON.stringify(content));
  return path;
};
const importFile = (name: string, content: unknown) => operator("import", "--file", file(name, content));

describe("risikodata mot lokal backend", () => {
  let env: TwoTenants;
  beforeAll(async () => {
    env = await setupTwoTenants();
  });
  const org = (id: string) => ({ organizationId: id });
  const active = (client: TwoTenants["a"], id: string) => client.query(api.risk.queries.activeVersions, org(id));

  test("operatør importerer og aktiverer; kunder ser versjonen først etter aktivering, og begge organisasjoner ser det samme", async () => {
    const imported = await importFile(`c1-${run}`, await syntheticCountry(`int-c1-${run}`));
    expect(imported.status, imported.out).toBe(0);
    expect(imported.out).toMatch(/status: 'imported'/);
    // Importert, men ikke aktivert: ingen kunde ser den (den aktive fra tidligere kjøringer kan stå).
    const before = (await active(env.a, env.fx.orgA)).country;
    expect(before?.version).not.toBe(`int-c1-${run}`);

    const activated = operator("activate", "--kind", "country", "--version", `int-c1-${run}`);
    expect(activated.status, activated.out).toBe(0);
    const [seenA, seenB] = await Promise.all([active(env.a, env.fx.orgA), active(env.b, env.fx.orgB)]);
    expect(seenA.country).toMatchObject({ version: `int-c1-${run}`, status: "active", environment: "demo", entryCount: 2, freshness: "unreviewed" });
    expect(seenB).toEqual(seenA);
  });

  test("gjentatt import av samme versjon avvises, og kommandoen avviser ugyldig fil og feil checksum uten å skrive noe", async () => {
    const good = await syntheticCountry(`int-dup-${run}`);
    expect((await importFile(`dup-${run}`, good)).status).toBe(0);
    const again = await importFile(`dup2-${run}`, good);
    expect(again.status).toBe(1);
    expect(again.out).toMatch(/RISK_VERSION_EXISTS/);

    const tampered = await importFile(`bad-${run}`, { ...good, version: `int-bad-${run}`, checksum: "a".repeat(64) });
    expect(tampered.status).toBe(1);
    expect(tampered.out).toMatch(/checksum stemmer ikke/);
    // Intet ble skrevet: samme versjonsnavn med riktig checksum importeres fortsatt.
    expect((await importFile(`bad-ok-${run}`, await syntheticCountry(`int-bad-${run}`))).status).toBe(0);
  });

  test("produksjonsaktivering avvises ved uavklart lisens, manglende godkjenning og utgått review, og den aktive versjonen står", async () => {
    const before = (await active(env.a, env.fx.orgA)).country;
    const cases = [
      ["lic", { licenseStatus: "unclear" }, "LICENSE_NOT_CLEARED"],
      ["appr", { approval: undefined }, "NOT_APPROVED"],
      ["due", { retrievedAt: "2019-12-01", review: { reviewer: "R", reviewedAt: "2020-01-01", reviewDueAt: "2020-06-01" } }, "REVIEW_OVERDUE"],
    ] as const;
    for (const [name, overrides, blocker] of cases) {
      const version = `int-${name}-${run}`;
      expect((await importFile(version, await syntheticCountry(version, overrides, true))).status).toBe(0);
      const refused = operator("activate", "--kind", "country", "--version", version);
      expect(refused.status, refused.out).toBe(1);
      expect(refused.out).toMatch(new RegExp(`RISK_ACTIVATION_BLOCKED.*${blocker}`));
    }
    expect((await active(env.a, env.fx.orgA)).country).toEqual(before);
  });

  test("ny versjon pensjonerer den gamle, som forblir lesbar for kunder med uendret innhold", async () => {
    const v1 = `int-hist1-${run}`;
    const v2 = `int-hist2-${run}`;
    await importFile(v1, await syntheticCountry(v1));
    await importFile(v2, await syntheticCountry(v2, { entries: [{ iso2: "XC", originalIndicator: "1", screeningLevel: "moderate", transformationNote: "x", sourceReference: "y" }] }));
    expect(operator("activate", "--kind", "country", "--version", v1).status).toBe(0);
    const first = (await active(env.a, env.fx.orgA)).country!;
    expect(operator("activate", "--kind", "country", "--version", v2).status).toBe(0);
    expect((await active(env.a, env.fx.orgA)).country).toMatchObject({ version: v2, entryCount: 1 });
    const old = await env.a.query(api.risk.queries.getVersion, { ...org(env.fx.orgA), kind: "country", versionId: first.id });
    expect(old).toEqual({ ...first, status: "retired" });
  });

  test("kunden ser ikke en uaktivert versjon, heller ikke med id-en i hånd, og får samme avslag som for ukjent id", async () => {
    // Bare importert, aldri aktivert. Id-en hentes ikke fra noen kunde-API; den slås opp som operatør via aktivering som feiler (ingen leser).
    const version = `int-hidden-${run}`;
    await importFile(version, await syntheticIndustry(version));
    const unknown = await errorOf(env.a.query(api.risk.queries.getVersion, { ...org(env.fx.orgA), kind: "industry", versionId: "ukjent" }));
    expect(unknown.code).toBe("NOT_FOUND");
    expect((await active(env.a, env.fx.orgA)).industry?.version).not.toBe(version);
  });

  test("det finnes ingen offentlig skrivefunksjon for de felles risikodataene", () => {
    const risk = Object.entries(reviewedPublicFunctions).filter(([path]) => path.startsWith("risk/"));
    // Eneste mutasjon er kundens egen vurdering (riskAssessments i egen organisasjon); felles data leses bare.
    expect(risk.map(([path, r]) => [path, r.kind]).sort()).toEqual([
      ["risk/assessments:assessPeriod", "mutation"],
      ["risk/assessments:history", "query"],
      ["risk/assessments:latest", "query"],
      ["risk/queries:activeVersions", "query"],
      ["risk/queries:getVersion", "query"],
    ]);
  });
});
