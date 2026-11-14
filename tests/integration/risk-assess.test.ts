/**
 * Screeningvurdering mot lokal backend med ekte innloggede brukere: pilotens
 * 2 000 leverandører vurderes side for side innenfor Convex sine grenser,
 * en ny kjøring regner ikke på nytt, endringer gir nye rader, og en annen
 * organisasjon ser ingenting. Risikodataene er de syntetiske demo-filene,
 * importert og aktivert med operatørkommandoene. Test-backenden består mellom
 * kjøringer, så demo-versjonene får unike navn per kjøring.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { errorOf, runInternal, setupTwoTenants, TEST_BACKEND, type TwoTenants } from "../helpers/local-backend";
import { seal } from "../helpers/risk-data";

const run = Date.now().toString(36);
const dir = mkdtempSync(join(tmpdir(), "risk-assess-int-"));
const SUPPLIERS = 2000;

function operator(args: string[]) {
  const result = spawnSync("node", ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/risk-data-import.ts", ...args, "--operator", "Integrasjonstest", "--env-file", TEST_BACKEND.envFile], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${args.join(" ")} feilet: ${result.stdout}${result.stderr}`);
}
async function activateDemo(suffix: string) {
  for (const name of ["country", "industry", "method"] as const) {
    const manifest = JSON.parse(readFileSync(`risk-data/demo/${name}-demo-1.json`, "utf8"));
    const file = join(dir, `${name}-${suffix}.json`);
    writeFileSync(file, JSON.stringify(await seal({ ...manifest, version: `int-${name}-${suffix}-${run}`, checksum: undefined })));
    operator(["--file", file]);
    operator(["--activate", "--kind", name, "--version", `int-${name}-${suffix}-${run}`]);
  }
}

describe("screeningvurdering mot lokal backend", () => {
  let env: TwoTenants;
  let periodA: string;
  let periodB: string;
  beforeAll(async () => {
    env = await setupTwoTenants();
    await activateDemo("v1");
    periodA = await env.a.mutation(api.organizations.reportingPeriods.create, { organizationId: env.fx.orgA, startDate: "2025-01-01", endDate: "2025-12-31", publicationDueDate: "2026-06-30" });
    periodB = await env.b.mutation(api.organizations.reportingPeriods.create, { organizationId: env.fx.orgB, startDate: "2025-01-01", endDate: "2025-12-31", publicationDueDate: "2026-06-30" });
  }, 120_000);

  const assessAll = async (client: TwoTenants["a"], organizationId: string, reportingPeriodId: string) => {
    const totals = { assessed: 0, unchanged: 0, pages: 0, slowestMs: 0 };
    let cursor: string | null = null;
    do {
      const started = Date.now();
      const page: { assessed: number; unchanged: number; nextCursor: string | null } = await client.mutation(api.risk.assessments.assessPeriod, { organizationId, reportingPeriodId, cursor });
      totals.slowestMs = Math.max(totals.slowestMs, Date.now() - started);
      totals.assessed += page.assessed;
      totals.unchanged += page.unchanged;
      totals.pages++;
      cursor = page.nextCursor;
    } while (cursor);
    return totals;
  };

  test("2 000 leverandører vurderes side for side; ny kjøring regner ikke på nytt; en annen organisasjon ser ingenting", async () => {
    for (let from = 0; from < SUPPLIERS; from += 500) {
      runInternal("ops/testing:seedSuppliersForRisk", { organizationId: env.fx.orgA, reportingPeriodId: periodA, from, count: 500 });
    }
    const first = await assessAll(env.a, env.fx.orgA, periodA);
    console.log(`Belastning: ${JSON.stringify(first)}`);
    expect(first).toMatchObject({ assessed: SUPPLIERS, unchanged: 0 });
    // Hver side holder seg godt under mutasjonenes sekundgrense (med stor margin for treg CI).
    expect(first.slowestMs).toBeLessThan(5000);

    const again = await assessAll(env.a, env.fx.orgA, periodA);
    expect(again).toMatchObject({ assessed: 0, unchanged: SUPPLIERS });

    // B har ingen leverandører og får ingen vurderinger, og kan ikke bruke A sin periode.
    expect(await assessAll(env.b, env.fx.orgB, periodB)).toMatchObject({ assessed: 0, unchanged: 0 });
    expect((await errorOf(env.b.mutation(api.risk.assessments.assessPeriod, { organizationId: env.fx.orgB, reportingPeriodId: periodA, cursor: null }))).code).toBe("NOT_FOUND");
  }, 300_000);

  test("ny aktiv versjon gjør vurderingene utdaterte, og en ny kjøring gir nye rader ved siden av de gamle", async () => {
    const list = await env.a.query(api.suppliers.queries.list, { organizationId: env.fx.orgA, paginationOpts: { numItems: 1, cursor: null } });
    const supplierId = list.page[0].id;
    expect(await env.a.query(api.risk.assessments.latest, { organizationId: env.fx.orgA, supplierId, reportingPeriodId: periodA })).toMatchObject({ status: "current" });
    await activateDemo("v2");
    const stale = await env.a.query(api.risk.assessments.latest, { organizationId: env.fx.orgA, supplierId, reportingPeriodId: periodA });
    expect(stale).toMatchObject({ status: "stale" });
    expect(stale!.staleReasons).toEqual(expect.arrayContaining(["method_changed", "country_data_changed", "industry_data_changed"]));

    await env.a.mutation(api.risk.assessments.assessPeriod, { organizationId: env.fx.orgA, reportingPeriodId: periodA, cursor: null });
    const history = await env.a.query(api.risk.assessments.history, { organizationId: env.fx.orgA, supplierId, reportingPeriodId: periodA });
    expect(history).toHaveLength(2);
    expect(history[1].methodVersion).toBe(`int-method-v1-${run}`);
    expect(history[0].methodVersion).toBe(`int-method-v2-${run}`);
    const audit = await env.a.query(api.audit.queries.list, { organizationId: env.fx.orgA, entityType: "reportingPeriod", paginationOpts: { numItems: 50, cursor: null } });
    expect(audit.page.some((e) => e.eventType === "risk.assessed")).toBe(true);
  }, 120_000);
});
