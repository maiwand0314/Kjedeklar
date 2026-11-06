import { expect, test } from "@playwright/test";
import type { TenantFixture } from "../helpers/local-backend";

const fixture = (): TenantFixture => JSON.parse(process.env.E2E_FIXTURE ?? "{}");

test("uinnlogget bruker sendes til innlogging", async ({ page }) => {
  await page.goto(`/o/${fixture().orgA}`);
  await expect(page).toHaveURL(/\/logg-inn$/);
  await expect(page.getByRole("heading", { name: "Logg inn i Kjedeklar" })).toBeVisible();
});

test("feil passord gir norsk feilmelding", async ({ page }) => {
  const fx = fixture();
  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(fx.userA.email);
  await page.getByLabel("Passord").fill(`${fx.password}feil`);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Feil e-post eller passord.");
});

test("innlogging → beskyttet side → fremmed org avvises → utlogging", async ({ page }) => {
  const fx = fixture();
  await page.goto("/");
  await expect(page).toHaveURL(/\/logg-inn$/);

  await page.getByLabel("E-post").fill(fx.userA.email);
  await page.getByLabel("Passord").fill(fx.password);
  await page.getByRole("button", { name: "Logg inn" }).click();

  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));
  await expect(page.getByTestId("organization-name")).toHaveText(/^Org A /);

  await page.goto(`/o/${fx.orgB}`);
  await expect(page.getByRole("heading", { name: "Ikke funnet" })).toBeVisible();
  await expect(page.getByText(/Org B/)).toHaveCount(0);

  await page.goto(`/o/${fx.orgA}`);
  await page.getByRole("button", { name: "Logg ut" }).click();
  await expect(page).toHaveURL(/\/logg-inn$/);

  await page.goto(`/o/${fx.orgA}`);
  await expect(page).toHaveURL(/\/logg-inn$/);
});
