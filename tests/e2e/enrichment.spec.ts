import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { enhetBody } from "../helpers/fake-brreg";
import { createTenantFixture, randomTestIp } from "../helpers/local-backend";

// Test-backenden slår opp mot en falsk Brreg-tjeneste på vertsmaskinen (BRREG_ENHET_URL, port 38100).
const ORG = "920000096";
let server: Server;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url?.endsWith(ORG)) return void res.writeHead(200).end(enhetBody(ORG));
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(38100, "0.0.0.0", resolve));
});
test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomTestIp() });
});

test("Brreg-beriking: status per leverandør, forslag som må godtas, og utenlandsk leverandør er ikke relevant", async ({ page }) => {
  test.slow();
  const fx = createTenantFixture();
  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(fx.userA.email);
  await page.getByLabel("Passord").fill(fx.password);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));
  const create = async (name: string, orgNumber?: string) => {
    await page.goto(`/o/${fx.orgA}/leverandorer/ny`);
    const form = page.locator("form", { has: page.getByRole("button", { name: "Opprett leverandør" }) });
    await form.getByLabel("Navn", { exact: true }).fill(name);
    if (orgNumber) await form.getByLabel("Norsk organisasjonsnummer").fill(orgNumber);
    await form.getByRole("button", { name: "Opprett leverandør" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  };
  await create("Utenlandsk Leverandør Ltd");
  await expect(page.getByTestId("registry-state")).toContainText("Ikke relevant");
  await expect(page.getByRole("button", { name: "Hent fra Enhetsregisteret" })).toHaveCount(0);

  await create("Norsk Testvarer AS", ORG);
  await expect(page.getByTestId("registry-state")).toContainText("Ikke hentet");
  await page.getByRole("button", { name: "Hent fra Enhetsregisteret" }).click();
  // Siden oppdaterer seg selv mens oppslaget pågår.
  await expect(page.getByTestId("registry-state")).toContainText("Hentet", { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Enhetsregisteret" })).toContainText("SYNTETISK TESTVARER AS");

  // Registerverdier er forslag: profilen er uendret til brukeren godtar.
  const suggestions = page.getByTestId("registry-suggestions");
  await expect(suggestions).toContainText("Navn: Norsk Testvarer AS → SYNTETISK TESTVARER AS");
  await expect(page.getByLabel("Registreringsland")).toHaveValue("");
  await suggestions.getByTestId("suggestion-registeredCountry").getByRole("button", { name: "Bruk registerverdien" }).click();
  await expect(page.getByTestId("suggestion-registeredCountry")).toHaveCount(0);
  await expect(page.getByLabel("Registreringsland")).toHaveValue("NO");

  // Næringskoden krever at brukeren velger kodeverk: Brreg oppgir ikke SN-versjonen.
  const code = page.getByTestId("suggestion-industryCode");
  await expect(code.getByRole("button", { name: "Bruk registerverdien" })).toBeDisabled();
  await code.getByLabel("Kodeverk").selectOption("SN2007");
  await code.getByRole("button", { name: "Bruk registerverdien" }).click();
  await expect(page.getByText(/Næringskoden er tatt fra Enhetsregisteret, hentet/)).toBeVisible();
  await expect(page.getByLabel("Bransjekode", { exact: true })).toHaveValue("46.900");

  // Listen viser status per leverandør.
  await page.goto(`/o/${fx.orgA}/leverandorer`);
  const row = (name: string) => page.getByRole("row", { name: new RegExp(name) });
  await expect(row("Norsk Testvarer AS")).toContainText("Hentet");
  await expect(row("Utenlandsk Leverandør Ltd")).toContainText("Ikke relevant");
});
