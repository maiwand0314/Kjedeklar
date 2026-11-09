import { expect, test, type Page } from "@playwright/test";
import { createTenantFixture, randomTestIp, type TenantFixture } from "../helpers/local-backend";

const fixture = (): TenantFixture => JSON.parse(process.env.E2E_FIXTURE ?? "{}");

const SECTIONS = [
  ["", "Oversikt"],
  ["/virksomheten", "Virksomheten"],
  ["/leverandorer", "Leverandører"],
  ["/risikovurderinger", "Risikovurderinger"],
  ["/funn-og-tiltak", "Funn og tiltak"],
  ["/redegjorelse", "Redegjørelse"],
  ["/innstillinger", "Innstillinger"],
] as const;

// Egen klient-IP per test, så innloggingsbegrensningen per IP ikke deles.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomTestIp() });
});

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Passord").fill(password);
  await page.getByRole("button", { name: "Logg inn" }).click();
}

/** Enkel tilgjengelighetssjekk: én h1, navngitt hovedmeny og ingen skjemafelt uten label. */
async function expectBasicA11y(page: Page) {
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Hovedmeny" })).toBeVisible();
  const unlabeled = await page.evaluate(() =>
    [...document.querySelectorAll("input, select, textarea")]
      .filter((el) => (el as HTMLInputElement).type !== "hidden")
      .filter((el) => !(el as HTMLInputElement).labels?.length && !el.getAttribute("aria-label"))
      .map((el) => el.outerHTML),
  );
  expect(unlabeled).toEqual([]);
}

test("tastatur: hopp til innhold, synlig fokus og alle seksjoner via Enter", async ({ page }) => {
  const fx = fixture();
  await logIn(page, fx.userA.email, fx.password);
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Hopp til innholdet" })).toBeFocused();

  // Tab videre til første menylenke og sjekk at fokus er synlig.
  const first = page.getByRole("navigation", { name: "Hovedmeny" }).getByRole("link", { name: "Oversikt" });
  for (let i = 0; i < 10 && !(await first.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(first).toBeFocused();
  expect(await first.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");

  for (const [path, label] of SECTIONS) {
    const link = page.getByRole("navigation", { name: "Hovedmeny" }).getByRole("link", { name: label });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}${path}$`));
    await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
    await expect(link).toHaveAttribute("aria-current", "page");
    await expectBasicA11y(page);
  }
});

test("mobil: menyen åpnes, navigerer og lukkes, uten vannrett rulling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const fx = fixture();
  await logIn(page, fx.userA.email, fx.password);
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));

  const nav = page.getByRole("navigation", { name: "Hovedmeny" });
  await expect(nav).toBeHidden();
  await page.getByText("Meny", { exact: true }).click();
  await expect(nav).toBeVisible();
  // Escape lukker og gir fokus tilbake; klikk utenfor lukker også.
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await expect(page.locator("summary", { hasText: "Meny" })).toBeFocused();
  await page.getByText("Meny", { exact: true }).click();
  await page.locator("main").click({ position: { x: 300, y: 600 } });
  await expect(nav).toBeHidden();
  await page.getByText("Meny", { exact: true }).click();
  await nav.getByRole("link", { name: "Risikovurderinger" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Risikovurderinger" })).toBeVisible();
  await expect(nav).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("organisasjonsbytte viser bare egne medlemskap og laster siden helt på nytt", async ({ page }) => {
  // Egen fixture: passordtesten i auth.spec.ts bytter passord for den delte bruker B.
  const fx = createTenantFixture(); // B er aktiv i org B og org C
  await logIn(page, fx.userB.email, fx.password);
  await expect(page.getByRole("heading", { name: "Velg organisasjon" })).toBeVisible();
  await page.getByRole("link", { name: /^Org B / }).click();
  await expect(page.getByTestId("organization-name")).toHaveText(/^Org B /);

  await page.getByText("(bytt virksomhet)").click();
  const choices = page.getByRole("list", { name: "Bytt virksomhet" }).getByRole("link");
  await expect(choices).toHaveText([/^Org B /, /^Org C /]); // sortert på navn
  expect((await choices.allTextContents()).some((t) => t.startsWith("Org A "))).toBe(false);
  await page.keyboard.press("Escape");
  await expect(choices.first()).toBeHidden();
  await page.getByText("(bytt virksomhet)").click();

  // Markør i vinduet: forsvinner bare ved full sidelasting (all klienttilstand og
  // alle abonnementer for forrige kunde er da borte).
  await page.evaluate(() => ((window as unknown as { previousCustomer: string }).previousCustomer = "B"));
  await page.getByRole("link", { name: /^Org C / }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgC}$`));
  await expect(page.getByTestId("organization-name")).toHaveText(/^Org C /);
  expect(await page.evaluate(() => (window as unknown as { previousCustomer?: string }).previousCustomer)).toBeUndefined();
  // Org B finnes bare som valg i (lukket) bytteliste, ikke i innholdet.
  await expect(page.locator("main")).not.toContainText("Org B");
});

test("lasting vises ved trege svar, og fremmed eller ukjent side gir avslag", async ({ page }) => {
  const fx = fixture();
  // Lastegrensen kommer med lenkens prefetch. Klikkes det før den er hentet, har
  // ruteren ingen lastetilstand å vise, så vent på den før svaret forsinkes.
  const prefetched = page.waitForResponse((r) => {
    const headers = r.request().headers();
    return r.url().includes("/leverandorer?") && headers["next-router-prefetch"] === "1"
      && headers["next-router-segment-prefetch"] !== "/_tree";
  });
  await logIn(page, fx.userA.email, fx.password);
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));
  await (await prefetched).finished();

  // Forsink serversvaret for neste side, så lastetilstanden rekker å vises.
  await page.route("**/leverandorer*", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.getByRole("navigation", { name: "Hovedmeny" }).getByRole("link", { name: "Leverandører" }).click();
  await expect(page.getByRole("status")).toHaveText("Laster …");
  await expect(page.getByRole("heading", { level: 1, name: "Leverandører" })).toBeVisible();
  await page.unrouteAll();

  for (const path of [`/o/${fx.orgB}`, `/o/${fx.orgA}/finnes-ikke`]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: "Ikke funnet" })).toBeVisible();
  }
});

test("lys og mørk modus, og ingen kall til eksterne verter", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (r) => hosts.add(new URL(r.url()).hostname));
  const fx = fixture();
  await logIn(page, fx.userA.email, fx.password);
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));

  const luminance = () =>
    page.evaluate(() => {
      const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+/g)!.map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    });
  await page.emulateMedia({ colorScheme: "light" });
  expect(await luminance()).toBeGreaterThan(0.9);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await luminance()).toBeLessThan(0.1);

  await page.getByRole("navigation", { name: "Hovedmeny" }).getByRole("link", { name: "Innstillinger" }).click();
  await expect(page.getByLabel("E-post til ny administrator")).toBeVisible();
  expect([...hosts].filter((h) => h !== "localhost" && h !== "127.0.0.1")).toEqual([]);
});
