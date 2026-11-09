import { expect, test } from "@playwright/test";
import { createTenantFixture, randomTestIp } from "../helpers/local-backend";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomTestIp() });
});

test("pliktvurdering: forhåndsvisning, bekreftelse kreves, lagret vurdering med grunnlag", async ({ page }) => {
  // Egen fixture, så lagrede vurderinger ikke påvirker andre tester.
  const fx = createTenantFixture();
  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(fx.userA.email);
  await page.getByLabel("Passord").fill(fx.password);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));
  await page.goto(`/o/${fx.orgA}/virksomheten`);

  const form = page.locator("form", { has: page.getByRole("button", { name: "Lagre vurderingen" }) });
  for (const year of ["Forrige regnskapsår", "Siste avsluttede regnskapsår"]) {
    const group = form.getByRole("group", { name: year });
    await group.getByLabel("Regnskapsår").fill(year.startsWith("Forrige") ? "2024" : "2025");
    await group.getByLabel("Salgsinntekt (kr)").fill("80 000 000");
    await group.getByLabel("Balansesum (kr)").fill("40 000 000");
    await group.getByLabel("Gjennomsnittlige årsverk").fill("60");
  }
  await form.getByRole("group", { name: /morselskap/ }).getByLabel("Nei").check();
  await form.getByRole("group", { name: /allmenn interesse/ }).getByLabel("Nei").check();

  const preview = form.getByRole("region", { name: "Forhåndsvisning" });
  await expect(preview).toContainText("Sannsynlig omfattet");
  await expect(preview).toContainText("veiledende");

  // Ugyldig tall gir feilmelding ved feltet og ingen forhåndsvisning.
  const current = form.getByRole("group", { name: "Siste avsluttede regnskapsår" });
  await current.getByLabel("Salgsinntekt (kr)").fill("mange");
  await expect(current.getByText("Skriv et beløp i kroner")).toBeVisible();
  await expect(preview).toContainText("Rett feltene");
  await current.getByLabel("Salgsinntekt (kr)").fill("80 000 000");

  const save = form.getByRole("button", { name: "Lagre vurderingen" });
  await expect(save).toBeDisabled();
  await form.getByLabel(/Jeg bekrefter/).check();
  await save.click();
  await expect(form.getByRole("status")).toHaveText("Vurderingen er lagret.");

  const section = page.getByRole("region", { name: "Er virksomheten omfattet av åpenhetsloven?" });
  await expect(section.getByRole("table", { name: "Grunnlaget for vurderingen" })).toContainText("80 000 000 kr");
  await expect(section).toContainText("Regelversjon apenhetsloven-3a-2024-11-01-v1");
});
