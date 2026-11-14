import { expect, test } from "@playwright/test";
import { api } from "../../convex/_generated/api";
import { clientFor, createTenantFixture, randomTestIp, runInternal } from "../helpers/local-backend";
import { activateDemoData } from "../helpers/risk-demo";

test.beforeAll(async () => {
  await activateDemoData("e2e");
});
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomTestIp() });
});

test("risikoliste: forklaring → begrunnet overstyring → historikk, og endret grunnlag gjør vurderingen utdatert", async ({ page }) => {
  test.slow();
  const fx = createTenantFixture();
  const client = await clientFor(fx.userA.email, fx.password);
  // Egen periode for denne testen. Demo-kodene XA–XC er ikke ISO-land, så de settes med en testfunksjon.
  const periodId = await client.mutation(api.organizations.reportingPeriods.create, {
    organizationId: fx.orgA, startDate: "2031-01-01", endDate: "2031-12-31", publicationDueDate: "2032-06-30",
  });
  const supplier = async (name: string, country: string, spendOre: bigint) => {
    const supplierId = await client.mutation(api.suppliers.mutations.create, {
      organizationId: fx.orgA, name, industryCodeSystem: "SN2007", industryCode: "00.100",
    });
    await client.mutation(api.suppliers.mutations.savePeriod, {
      organizationId: fx.orgA, supplierId, reportingPeriodId: periodId, expectedRowVersion: 0, productionCountries: ["NO"], upstreamUnknown: false, spendOre,
    });
    runInternal("ops/testing:setPeriodCountries", { supplierId, reportingPeriodId: periodId, productionCountries: [country] });
    return supplierId;
  };
  const highId = await supplier("E2E Høy Leverandør AS", "XA", 1_000_00n);
  await supplier("E2E Lav Leverandør AS", "XC", 9_000_000_00n); // stort beløp, men lavt nivå
  // Uten innkjøpsdata er produksjonsland ukjent: nivået blir ukjent, og leverandøren får egen oppfølgingsgruppe.
  await client.mutation(api.suppliers.mutations.create, { organizationId: fx.orgA, name: "E2E Ukjent Leverandør AS", industryCodeSystem: "SN2007", industryCode: "00.100" });

  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(fx.userA.email);
  await page.getByLabel("Passord").fill(fx.password);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));

  // Liste: kjør screeningen, så vises høy før lav selv om lav har mye større beløp.
  const listUrl = `/o/${fx.orgA}/risikovurderinger?periode=${periodId}`;
  await page.goto(listUrl);
  await page.getByRole("button", { name: "Kjør screening for alle leverandører" }).click();
  await expect(page.getByRole("status")).toContainText("Screeningen er kjørt");
  const rows = page.getByTestId("risk-row");
  // Leverandørene er med i listen som «ikke vurdert» før kjøringen; vent til siden har hentet resultatet.
  await expect(page.getByTestId("count-screening-high")).toHaveText("1");
  const names = await rows.locator("td:first-child").allTextContents();
  expect(names).toEqual(["E2E Høy Leverandør AS", "E2E Ukjent Leverandør AS", "E2E Lav Leverandør AS"]);
  await expect(page.getByTestId("group-high")).toContainText("Høy screening");
  await expect(page.getByTestId("group-unknown")).toContainText("Ukjent – krever oppfølging");
  await expect(page.getByTestId("count-review-none")).not.toHaveText("0");

  // Forklaring: regelen som slo ut, kilden, og hva som mangler.
  await page.getByRole("link", { name: "E2E Høy Leverandør AS" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E Høy Leverandør AS" })).toBeVisible();
  await expect(page.getByTestId("screening-level")).toHaveText("Høy");
  const rule = page.getByTestId("rule").first();
  await expect(rule).toContainText("Produksjonsland: XA gir høy (COUNTRY_LEVEL)");
  await expect(rule).toContainText("Kilde: country");
  await expect(page.getByTestId("missing")).toContainText("Produktkategori: mangler");

  // Overstyring uten meningsfull begrunnelse stoppes; originalen er uberørt.
  const form = page.locator("form", { has: page.getByRole("button", { name: "Lagre vurderingen" }) });
  await form.getByLabel("Overstyr nivået").check();
  await form.getByLabel("Overstyr til").selectOption("low");
  await form.getByLabel("Begrunnelse", { exact: true }).fill("ok");
  await form.getByRole("button", { name: "Lagre vurderingen" }).click();
  await expect(form).toContainText("Begrunnelsen må være på minst 20 tegn");
  await expect(page.getByTestId("review-state")).toContainText("Ikke gjennomgått");

  // Begrunnet overstyring: nivået endres hos kunden, men screeningen og manglene står.
  await form.getByLabel("Begrunnelse", { exact: true }).fill("Vi har besøkt fabrikken og sett revisjonsrapporten fra i fjor.");
  await form.getByLabel("Henvisning til dokumentasjon (valgfritt)").fill("Revisjonsrapport 2030");
  await form.getByRole("button", { name: "Lagre vurderingen" }).click();
  await expect(page.getByTestId("review-state")).toContainText("Overstyrt");
  await expect(page.getByTestId("review-level")).toHaveText("Lav");
  await expect(page.getByTestId("screening-level")).toHaveText("Høy");
  await expect(page.getByTestId("override-note")).toContainText("Screeningen, datamanglene og kontrollsignalene under gjelder fortsatt");
  await expect(page.getByTestId("missing")).toContainText("Produktkategori: mangler");

  // Historikk med begrunnelse, henvisning og bruker.
  const entry = page.getByTestId("review-entry");
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText("Høy → Lav");
  await expect(entry).toContainText("Vi har besøkt fabrikken");
  await expect(entry).toContainText("Henvisning: Revisjonsrapport 2030");

  // Listen viser screening og kundens vurdering samtidig, og rekkefølgen er uendret.
  await page.goto(listUrl);
  const highRow = rows.filter({ hasText: "E2E Høy Leverandør AS" });
  await expect(highRow).toContainText("Høy");
  await expect(highRow).toContainText("Overstyrt");
  await expect(highRow).toContainText("Nivå: Lav");
  await expect(page.getByTestId("count-review-overridden")).toHaveText("1");
  expect(await rows.locator("td:first-child").allTextContents()).toEqual(["E2E Høy Leverandør AS", "E2E Ukjent Leverandør AS", "E2E Lav Leverandør AS"]);

  // Endret grunnlag: vurderingen blir utdatert, og skjemaet stenges til screeningen er kjørt på nytt.
  runInternal("ops/testing:setPeriodCountries", { supplierId: highId, reportingPeriodId: periodId, productionCountries: ["XB"] });
  await page.goto(`/o/${fx.orgA}/risikovurderinger/${highId}?periode=${periodId}`);
  await expect(page.getByTestId("stale-notice")).toContainText("Screeningen er utdatert");
  await expect(page.getByTestId("review-state")).toContainText("Utdatert");
  await expect(page.getByRole("button", { name: "Lagre vurderingen" })).toBeDisabled();
  await page.getByTestId("stale-notice").getByRole("button", { name: "Kjør screening på nytt" }).click();
  await expect(page.getByTestId("screening-level")).toHaveText("Moderat", { timeout: 30_000 });
  await expect(page.getByTestId("outdated-note")).toContainText("gjelder ikke lenger");
  await form.getByLabel("Bekreft screeningen").check();
  await form.getByLabel("Begrunnelse", { exact: true }).fill("Vi har sett gjennom det nye grunnlaget og bekrefter moderat nivå.");
  await form.getByRole("button", { name: "Lagre vurderingen" }).click();
  await expect(page.getByTestId("review-state")).toContainText("Bekreftet");
  await expect(page.getByTestId("review-entry")).toHaveCount(2);
});
