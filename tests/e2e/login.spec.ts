import { expect, test, type Page } from "@playwright/test";
import { randomTestIp, type TenantFixture } from "../helpers/local-backend";

const fixture = (): TenantFixture => JSON.parse(process.env.E2E_FIXTURE ?? "{}");

// Egen klient-IP per test (Next.js setter x-forwarded-for bare hvis den mangler),
// så innloggingsbegrensningen per IP ikke deles mellom testene.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomTestIp() });
});

/** Logger inn bruker A via forsiden, slik en bruker ville gjort. */
async function logInAsA(page: Page, fx: TenantFixture) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/logg-inn$/);
  await page.getByLabel("E-post").fill(fx.userA.email);
  await page.getByLabel("Passord").fill(fx.password);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));
}

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

test("fremmed organisasjon i URL eller cookie gir identisk 404", async ({ page, context }) => {
  // Én innlogging i denne testen: Better Auth tillater 3 innlogginger per 10 s.
  const fx = fixture();
  await logInAsA(page, fx);

  // URL: fremmed, inaktivt medlemskap, ugyldig format og id fra en annen tabell.
  const bodies: string[] = [];
  for (const candidate of [fx.orgB, fx.orgC, "ikke-en-id", fx.userA.userId]) {
    const response = await page.goto(`/o/${candidate}`);
    expect(response?.status(), candidate).toBe(404);
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(page.getByRole("heading", { name: "Ikke funnet" })).toBeVisible();
    await expect(page.getByText(/Org B|Org C/)).toHaveCount(0);
    bodies.push(await page.locator("main").innerText());
  }
  for (const body of bodies) expect(body).toBe(bodies[0]);

  // Cookie: typiske navn for «valgt organisasjon». Appen leser ingen av dem;
  // organisasjonen er bare en kandidat som Convex kontrollerer.
  await context.addCookies(
    ["organizationId", "activeOrganizationId", "kjedeklar-org", "better-auth.active_organization"].map(
      (name) => ({ name, value: fx.orgB, url: "http://localhost:3100" }),
    ),
  );
  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));
  await expect(page.getByTestId("organization-name")).toHaveText(/^Org A /);
  const response = await page.goto(`/o/${fx.orgB}`);
  expect(response?.status()).toBe(404);
  expect(await page.locator("main").innerText()).toBe(bodies[0]);
});

test("innlogging → beskyttet side → fremmed org avvises → utlogging", async ({ page }) => {
  const fx = fixture();
  await logInAsA(page, fx);
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
