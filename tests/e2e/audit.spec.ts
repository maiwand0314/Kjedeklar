import { expect, test } from "@playwright/test";
import { createTenantFixture, randomTestIp } from "../helpers/local-backend";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomTestIp() });
});

test("navneendring i Innstillinger vises i revisjonsloggen med før/etter", async ({ page }) => {
  // Egen fixture: andre tester forventer at Org A har sitt opprinnelige navn.
  const fx = createTenantFixture();
  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(fx.userA.email);
  await page.getByLabel("Passord").fill(fx.password);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));

  await page.goto(`/o/${fx.orgA}/innstillinger`);
  const oldName = await page.getByLabel("Navn på virksomheten").inputValue();
  const newName = `Revidert ${Date.now()}`;
  await page.getByLabel("Navn på virksomheten").fill(newName);
  await page.getByRole("button", { name: "Lagre navn" }).click();
  await expect(page.getByRole("status")).toHaveText("Navnet er lagret.");
  await expect(page.getByTestId("organization-name")).toHaveText(newName);

  await page.reload();
  const log = page.getByRole("region", { name: "Revisjonslogg" });
  const row = log.getByRole("row", { name: /Navnet ble endret/ });
  await expect(row).toContainText(`Navn: ${oldName} → ${newName}`);
  await expect(row).toContainText("Test A");

  // Filter: bare invitasjoner viser ikke navneendringen.
  await log.getByRole("link", { name: "Invitasjoner" }).click();
  await expect(log.getByRole("row", { name: /Navnet ble endret/ })).toHaveCount(0);
});
