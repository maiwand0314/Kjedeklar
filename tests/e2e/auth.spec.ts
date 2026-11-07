import { expect, test, type Browser, type Page } from "@playwright/test";
import { randomTestIp, type TenantFixture } from "../helpers/local-backend";
import { linkIn, uniqueEmail, waitForEmail } from "../helpers/mailpit";

const fixture = (): TenantFixture => JSON.parse(process.env.E2E_FIXTURE ?? "{}");
const APP = "http://localhost:3100";

async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": randomTestIp() } });
  const page = await context.newPage();
  page.on("response", async (r) => {
    if (r.url().includes("/api/auth/") && r.status() >= 400) {
      console.log("DIAG", r.request().method(), r.url().replace(/^.*\/api\/auth/, ""), r.status(), (await r.text().catch(() => "")).slice(0, 160));
    }
  });
  page.on("pageerror", (e) => console.log("DIAG pageerror", e.message));
  return page;
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Passord").fill(password);
  await page.getByRole("button", { name: "Logg inn" }).click();
}

test("admin inviterer → mottaker velger passord via e-postlenken → innlogget i organisasjonen", async ({
  browser,
}) => {
  const fx = fixture();
  const admin = await freshPage(browser);
  await logIn(admin, fx.userA.email, fx.password);
  await expect(admin).toHaveURL(new RegExp(`/o/${fx.orgA}$`));

  const email = uniqueEmail("e2e-invitert");
  await admin.getByLabel("E-post til ny administrator").fill(email);
  await admin.getByRole("button", { name: "Send invitasjon" }).click();
  await expect(admin.getByRole("status")).toHaveText("Invitasjonen er sendt.");
  await expect(admin.getByRole("cell", { name: email })).toBeVisible();

  const mail = await waitForEmail(email, "Invitasjon til");
  const link = linkIn(mail.text, APP);
  expect(new URL(link).pathname).toBe("/invitasjon");

  const invitee = await freshPage(browser);
  await invitee.goto(link);
  await expect(invitee.getByRole("heading", { name: /^Invitasjon til Org A / })).toBeVisible();
  expect(invitee.url()).not.toContain("token"); // fjernet fra adresselinjen
  await invitee.getByLabel("Navn").fill("Ny Administrator");
  await invitee.getByLabel(/Velg passord/).fill("et-langt-e2e-passord-1");
  await invitee.getByLabel("Gjenta passord").fill("et-langt-e2e-passord-1");
  await invitee.getByRole("button", { name: "Godta og opprett konto" }).click();
  // Passordhashing (scrypt) og innlogging etterpå tar noen sekunder i testmiljøet.
  await expect(invitee).toHaveURL(new RegExp(`/o/${fx.orgA}$`), { timeout: 30_000 });
  await expect(invitee.getByTestId("organization-name")).toHaveText(/^Org A /);

  // Lenken er brukt: samme lenke i en ny økt gir ugyldig invitasjon.
  const again = await freshPage(browser);
  await again.goto(link);
  await expect(again.getByRole("heading", { name: "Invitasjonen er ugyldig eller utløpt" })).toBeVisible();
});

test("glemt passord → lenke i e-post → nytt passord → innlogging", async ({ browser }) => {
  const fx = fixture();
  const page = await freshPage(browser);
  await page.goto("/logg-inn");
  await page.getByRole("link", { name: "Glemt passord?" }).click();
  // Klientnavigering: vent på den nye siden, ellers kan feltet på innloggingssiden fylles ut.
  await expect(page.getByRole("heading", { name: "Glemt passord" })).toBeVisible();
  await page.getByLabel("E-post").fill(fx.userB.email);
  await page.getByRole("button", { name: "Send lenke" }).click();
  await expect(page.getByRole("status")).toContainText("Hvis adressen hører til en konto");

  const mail = await waitForEmail(fx.userB.email, "Tilbakestill");
  const link = linkIn(mail.text, APP);
  await page.goto(link);
  await expect(page.getByLabel(/Nytt passord/)).toBeVisible();
  expect(page.url()).not.toContain("token"); // fjernet fra adresselinjen
  await page.getByLabel(/Nytt passord/).fill("helt-nytt-e2e-passord-2");
  await page.getByLabel("Gjenta passord").fill("helt-nytt-e2e-passord-2");
  await page.getByRole("button", { name: "Lagre nytt passord" }).click();
  await expect(page.getByRole("status")).toContainText("Passordet er endret", { timeout: 20_000 });

  await logIn(page, fx.userB.email, fx.password);
  await expect(page.locator("form").getByRole("alert")).toHaveText("Feil e-post eller passord.");
  await logIn(page, fx.userB.email, "helt-nytt-e2e-passord-2");
  // B er medlem av to organisasjoner (B og C) og får organisasjonsvelgeren.
  await expect(page.getByRole("heading", { name: "Velg organisasjon" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Org B / })).toBeVisible();

  // Gammel lenke virker ikke igjen.
  await page.goto(link);
  await page.getByLabel(/Nytt passord/).fill("tredje-passord-e2e-3");
  await page.getByLabel("Gjenta passord").fill("tredje-passord-e2e-3");
  await page.getByRole("button", { name: "Lagre nytt passord" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("ugyldig eller utløpt");
});
