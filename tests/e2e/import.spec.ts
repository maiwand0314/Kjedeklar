import { expect, test } from "@playwright/test";
import { createTenantFixture, randomTestIp } from "../helpers/local-backend";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomTestIp() });
});

const SHOTS = process.env.IMPORT_SHOTS;

test("CSV-forhåndsvisning: grenser, kolonnevalg, avklaringer, ubetrodd tekst og ingen lagring", async ({ page }) => {
  // Egen fixture, så leverandørene ikke påvirker andre tester.
  const fx = createTenantFixture();
  // Filinnhold skal aldri kjøre som skript: en dialog fra siden er en feil.
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(fx.userA.email);
  await page.getByLabel("Passord").fill(fx.password);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));

  // Én leverandør finnes fra før, så forslag til matching kan vises.
  await page.goto(`/o/${fx.orgA}/leverandorer/ny`);
  await page.getByLabel("Navn", { exact: true }).fill("Finnes Fra Før AS");
  await page.getByLabel("Norsk organisasjonsnummer").fill("920000002");
  await page.getByRole("button", { name: "Opprett leverandør" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Finnes Fra Før AS" })).toBeVisible();

  await page.getByRole("link", { name: "Til leverandørlisten" }).click();
  await page.getByRole("link", { name: "Forhåndsvis CSV-fil" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Forhåndsvis CSV-fil" })).toBeVisible();

  // Malen kan lastes ned og er en CSV-fil.
  const template = await page.request.get((await page.getByRole("link", { name: /Last ned en mal/ }).getAttribute("href")) ?? "");
  expect(template.status()).toBe(200);
  expect(await template.text()).toContain("Navn;Organisasjonsnummer;Leverandør-ID;Land;Innkjøp (NOK)");

  const input = page.getByLabel("CSV-fil");
  // Next.js har sin egen «alert» for sidebytte utenfor innholdet.
  const alert = page.locator("main").getByRole("alert");
  const summary = page.getByTestId("import-summary");
  const table = page.getByRole("table", { name: "Forhåndsvisning av radene i filen" });
  // Hver rad i filen er en radgruppe: verdiene, og under dem forslag og avklaringer.
  const row = (number: number) => table.locator("tbody").filter({ has: page.getByRole("rowheader", { name: String(number), exact: true }) });

  // For stor fil avvises i nettleseren, uten at noe lastes opp.
  let uploads = 0;
  page.on("request", (request) => {
    if (request.method() === "POST") uploads++;
  });
  await input.setInputFiles({ name: "for-stor.csv", mimeType: "text/csv", buffer: Buffer.alloc(2 * 1024 * 1024 + 1, "a") });
  await expect(alert).toHaveText("Filen er for stor. Største tillatte størrelse er 2 MB.");
  expect(uploads).toBe(0);

  // Feil tegnsett avvises av serveren med en forklaring.
  await input.setInputFiles("tests/fixtures/csv/latin1.csv");
  await expect(alert).toContainText("Filen er ikke lagret som UTF-8");
  await expect(table).toHaveCount(0);

  // Malen: alle rader klare, kildekolonne og normalisert verdi vises, og treff på org.nr. foreslås.
  await input.setInputFiles("public/maler/leverandorer-mal.csv");
  await expect(summary).toContainText("3: 3 klare, 0 må avklares, 0 med feil");
  await expect(summary).toContainText("2 nye leverandører, 1 finnes fra før, 0 må avklares");
  await expect(table.getByRole("columnheader", { name: /Innkjøp i perioden/ })).toContainText("Kolonne: «Innkjøp (NOK)»");
  await expect(row(2)).toContainText(/1\s250\s000,50 kr/);
  await expect(row(2)).toContainText("Norge (NO)");
  await expect(row(2)).toContainText("I filen: «Norge»");
  await expect(row(2)).toContainText("Forslag: Finnes fra før: Finnes Fra Før AS (samme organisasjonsnummer)");
  await expect(row(3)).toContainText("Forslag: Ny leverandør");
  await expect(row(3)).toContainText("Ukjent"); // tomt org.nr.
  await expect(page.getByLabel("Skilletegn i filen")).toHaveValue(";");
  await expect(page.getByLabel("Navn", { exact: true })).toHaveValue("0");

  // En fil nær grensen (2 000 rader, over 1,5 MB) går gjennom opplastingen og vises side for side.
  const padding = "x".repeat(900);
  const large = Buffer.from(`Navn;Beskrivelse\n${Array.from({ length: 2000 }, (_, i) => `Stor ${i} AS;${padding}`).join("\n")}\n`);
  expect(large.byteLength).toBeGreaterThan(1.5 * 1024 * 1024);
  expect(large.byteLength).toBeLessThanOrEqual(2 * 1024 * 1024);
  await input.setInputFiles({ name: "stor.csv", mimeType: "text/csv", buffer: large });
  await expect(summary).toContainText("2000: 2000 klare, 0 må avklares, 0 med feil");
  await expect(table.locator("tbody")).toHaveCount(50);
  await page.getByRole("button", { name: "Neste" }).click();
  await expect(page.getByText("Side 2 av 40")).toBeVisible();
  await expect(row(52)).toContainText("Stor 50 AS");

  // Feilfilen: hver type avklaring er synlig på sin rad.
  await input.setInputFiles("tests/fixtures/csv/feilfil.csv");
  await expect(summary).toContainText("10: 2 klare, 5 må avklares, 3 med feil");
  await expect(row(3)).toContainText("Feil: Navn mangler.");
  await expect(row(3)).toContainText("Mangler");
  await expect(row(4)).toContainText("Feil: Organisasjonsnummeret er ikke et gyldig norsk organisasjonsnummer");
  await expect(row(4)).toContainText("I filen: «123456789»");
  await expect(row(5)).toContainText("Må avklares: Landet kjennes ikke igjen");
  await expect(row(5)).toContainText("I filen: «Kinna»");
  await expect(row(6)).toContainText("Må avklares: Beløpet kan leses på to måter");
  await expect(row(7)).toContainText("Må avklares: Beløpet er negativt");
  await expect(row(7)).toContainText(/−2\s500,50 kr/);
  await expect(row(8)).toContainText("Må avklares: Samme organisasjonsnummer som rad 2.");
  await expect(row(10)).toContainText("Feil: Beløpet er oppgitt i en annen valuta");
  await expect(row(11)).toContainText("Klar");

  // Script-lignende navn vises som tekst og blir ikke til elementer på siden.
  await expect(row(9)).toContainText("<script>alert('xss')</script>");
  expect(await page.locator("main script, main img").count()).toBe(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/feilfil.png`, fullPage: true });

  // Smal skjerm: tabellen ruller for seg selv, siden får ikke vannrett rulling, og avklaringene er synlige.
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const issue = page.getByText("Feil: Navn mangler.");
  await issue.scrollIntoViewIfNeeded();
  await expect(issue).toBeInViewport({ ratio: 1 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/feilfil-mobil.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });

  // Filter: bare rader med feil eller avklaringer.
  await page.getByLabel(/Bare rader med feil eller avklaringer \(8\)/).check();
  await expect(table.locator("tbody")).toHaveCount(8);
  await expect(row(11)).toHaveCount(0);

  // Valgt desimaltegn avklarer det tvetydige beløpet, og filteret står.
  await page.getByLabel("Desimaltegn i beløp").selectOption("comma");
  await expect(summary).toContainText("10: 3 klare, 4 må avklares, 3 med feil");
  await expect(row(6)).toHaveCount(0);
  await page.getByLabel(/Alle rader \(10\)/).check();
  await expect(row(6)).toContainText(/1\s234 kr/);
  await expect(row(6)).toContainText("I filen: «1.234»");

  // Kolonnevalget kan endres: uten kategori forsvinner kolonnen, og uten navn stoppes forhåndsvisningen.
  await expect(table.getByRole("columnheader", { name: /Kategori/ })).toHaveCount(1);
  await page.getByLabel("Kategori").selectOption("");
  await expect(table.getByRole("columnheader", { name: /Kategori/ })).toHaveCount(0);
  await page.getByLabel("Navn", { exact: true }).selectOption("");
  await expect(alert).toHaveText("Velg hvilken kolonne som inneholder navnet på leverandøren.");
  await expect(table).toHaveCount(0);
  await page.getByLabel("Navn", { exact: true }).selectOption({ label: "Kolonne 1: Navn" });
  await expect(summary).toContainText("10: 3 klare");

  // HTML, script og formler i hele filen: tekst, ingen dialog.
  await input.setInputFiles("tests/fixtures/csv/ubetrodd-tekst.csv");
  await expect(row(3)).toContainText('=HYPERLINK("http://ondsinnet.example";"Klikk")');
  await expect(row(3)).toContainText("Må avklares: Navnet starter med «=»");
  await expect(row(2)).toContainText("<img src=x onerror=alert(1)>");
  expect(await page.locator("main script, main img, main a[href*='ondsinnet']").count()).toBe(0);
  expect(dialogs).toEqual([]);

  // Ingenting er lagret: leverandørlisten har fortsatt bare den ene leverandøren.
  await page.getByRole("link", { name: "Til leverandørlisten" }).click();
  await expect(page.getByRole("table", { name: "Aktive leverandører" }).getByRole("row")).toHaveCount(2);
  await page.getByRole("navigation", { name: "Hovedmeny" }).getByRole("link", { name: "Innstillinger" }).click();
  const filter = page.getByRole("navigation", { name: "Filtrer revisjonslogg" });
  await filter.getByRole("link", { name: "Leverandører" }).click();
  const log = page.getByRole("table", { name: "Revisjonslogg" });
  await expect(log).toContainText("Leverandør opprettet");
  await expect(log.getByRole("row")).toHaveCount(2); // overskrift + den ene opprettelsen
  await filter.getByRole("link", { name: "Innkjøpsdata" }).click();
  await expect(page.getByText("Ingen hendelser.")).toBeVisible();
});
