import { expect, test } from "@playwright/test";
import { createTenantFixture, randomTestIp } from "../helpers/local-backend";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomTestIp() });
});

const CSV = [
  "Navn;Organisasjonsnummer;Leverandør-ID;Land;Innkjøp (NOK);Kategori",
  "Navn I Filen AS;920000002;;Norge;2 500,50;Arbeidstøy", // rad 2: finnes fra før
  "Helt Ny AS;;N-1;Norge;400;Kontor", // rad 3: ny
  "Summert AS;920000010;;;100;", // rad 4 og 5: slås sammen
  "Summert AS;920000010;;;250,25;",
  "Ukjent Land AS;;;Kinna;75;", // rad 6: ny med avklaring
  ";;;;900;", // rad 7: feil
].join("\n");
const SHOTS = process.env.IMPORT_SHOTS;
const file = { name: "leverandorer-2025.csv", mimeType: "text/csv", buffer: Buffer.from(`${CSV}\n`) };

test("CSV-import: forhåndsvis, velg håndtering, bekreft, og kontroller beløp og liste", async ({ page }) => {
  // Lang flyt med to importer; gi den tredobbel tid.
  test.slow();
  const fx = createTenantFixture();
  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(fx.userA.email);
  await page.getByLabel("Passord").fill(fx.password);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));
  const nav = page.getByRole("navigation", { name: "Hovedmeny" });

  // En rapportperiode, og én leverandør som finnes fra før med 1 000 kr i innkjøp.
  await page.getByRole("link", { name: "Opprett rapportperiode" }).click();
  await page.getByRole("button", { name: "Opprett periode" }).click();
  await expect(page).toHaveURL(/periode=/);
  await nav.getByRole("link", { name: "Leverandører" }).click();
  await page.getByRole("link", { name: "Ny leverandør" }).click();
  await page.getByLabel("Navn", { exact: true }).fill("Finnes Fra Før AS");
  await page.getByLabel("Norsk organisasjonsnummer").fill("920000002");
  await page.getByRole("button", { name: "Opprett leverandør" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Finnes Fra Før AS" })).toBeVisible();
  await page.getByLabel("Innkjøp i perioden (kroner)").fill("1000");
  await page.getByRole("button", { name: "Lagre innkjøpsdata" }).click();
  await expect(page.getByText("Innkjøpsdataene er lagret.")).toBeVisible();

  // Forhåndsvisning, så klargjøring for perioden.
  await page.getByRole("link", { name: "Til leverandørlisten" }).click();
  await page.getByRole("link", { name: "Importer fra CSV" }).click();
  await page.getByLabel("CSV-fil").setInputFiles(file);
  await expect(page.getByTestId("import-summary")).toContainText("6: 2 klare, 3 må avklares, 1 med feil");
  await page.getByRole("button", { name: "Klargjør import" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Import av «leverandorer-2025.csv»" })).toBeVisible();

  const batch = page.getByTestId("import-batch");
  await expect(batch).toContainText("6 rader i filen, 5 leverandører");
  await expect(batch).toContainText("Utkast. Ingenting er importert ennå.");
  const table = page.getByRole("table", { name: "Oppføringer i importgrunnlaget" });
  const entry = (row: number) => table.locator("tbody").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${row}\\b`) }) });
  const confirm = page.getByRole("button", { name: "Bekreft og importer" });
  const undecided = page.getByTestId("import-undecided");

  // Radene for samme leverandør er slått sammen, og beløpet er summen.
  await expect(entry(4)).toContainText("2 rader");
  await expect(entry(4)).toContainText(/350,25 kr/);
  await expect(entry(4)).toContainText("Må avklares: Slått sammen fra 2 rader i filen (rad 4 og 5)");
  await expect(entry(2)).toContainText("Type: Finnes fra før: Finnes Fra Før AS");
  await expect(entry(7)).toContainText("Feil: Navn mangler.");

  // Lange meldinger brytes innenfor tabellens synlige område og kuttes ikke.
  const message = entry(4).getByText(/Slått sammen fra 2 rader/);
  await message.scrollIntoViewIfNeeded();
  await expect(message).toBeInViewport({ ratio: 1 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/import-utkast.png`, fullPage: true });

  // Smal skjerm: siden får ikke vannrett rulling, og valgene er synlige.
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel("Valg for rad 4").scrollIntoViewIfNeeded();
  await expect(page.getByLabel("Valg for rad 4")).toBeInViewport({ ratio: 1 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/import-utkast-mobil.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });

  // Ingenting kan bekreftes før alle oppføringer har et valg.
  await expect(undecided).toContainText("4 oppføringer mangler valg.");
  await expect(confirm).toBeDisabled();

  // Fellesvalg for kjente leverandører og feilrader; eget valg for de to med avklaringer.
  await page.getByRole("group", { name: /Leverandører som finnes fra før \(1\)/ }).getByLabel("Oppdater innkjøpsdata for alle").check();
  await expect(undecided).toContainText("3 oppføringer mangler valg.");
  await page.getByRole("group", { name: /Rader med feil \(1\)/ }).getByLabel("Utelat alle rader med feil").check();
  await expect(undecided).toContainText("2 oppføringer mangler valg.");
  await page.getByLabel("Valg for rad 4").selectOption("create");
  await expect(undecided).toContainText("1 oppføringer mangler valg.");
  await page.getByLabel("Valg for rad 6").selectOption("skip");
  await expect(undecided).toHaveCount(0);
  await expect(page.getByLabel("Valg for rad 2")).toContainText("Følger fellesvalget: oppdater innkjøpsdata");

  // Fortsatt er ingenting endret: listen har bare den ene leverandøren.
  const importUrl = page.url();
  await nav.getByRole("link", { name: "Leverandører" }).click();
  await expect(page.getByRole("table", { name: "Aktive leverandører" }).getByRole("row")).toHaveCount(2);
  await page.goto(importUrl);

  // Dobbeltklikk på bekreftelsen gir én import.
  await confirm.dblclick();
  const result = page.getByTestId("import-result");
  await expect(result).toContainText("Opprettet2 nye leverandører");
  await expect(result).toContainText("Oppdatert1 leverandører fikk nye innkjøpsdata");
  await expect(result).toContainText("Utelatt2 oppføringer");
  await expect(result).toContainText("Ikke importert0 på grunn av endringer");
  await expect(batch).toContainText("Fullført");
  await expect(entry(2)).toContainText(/Resultat: Oppdatert – Finnes Fra Før AS \(tidligere beløp: 1\s000 kr\)/);
  await expect(entry(4)).toContainText("Resultat: Opprettet – Summert AS");
  await expect(entry(6)).toContainText("Resultat: Utelatt");
  await expect(entry(7)).toContainText("Resultat: Utelatt");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/import-resultat.png`, fullPage: true });

  // Listen: tre leverandører. Navnet i filen har ikke overskrevet navnet som fantes.
  await nav.getByRole("link", { name: "Leverandører" }).click();
  const list = page.getByRole("table", { name: "Aktive leverandører" });
  await expect(list.getByRole("row")).toHaveCount(4);
  for (const name of ["Finnes Fra Før AS", "Helt Ny AS", "Summert AS"]) await expect(list.getByRole("link", { name, exact: true })).toBeVisible();
  await expect(list).not.toContainText("Navn I Filen AS");
  await expect(list).not.toContainText("Ukjent Land AS");

  // Beløpene: erstattet for den kjente (ikke 3 500,50), summert for den sammenslåtte.
  const spend = async (name: string) => {
    await page.goto(`/o/${fx.orgA}/leverandorer`);
    await page.getByRole("table", { name: "Aktive leverandører" }).getByRole("link", { name, exact: true }).click();
    return page.getByTestId("period-summary");
  };
  await expect(await spend("Finnes Fra Før AS")).toContainText(/Innkjøp i perioden2\s500,50 kr/);
  await expect(page.getByTestId("period-summary")).toContainText("KategoriArbeidstøy");
  await expect(await spend("Summert AS")).toContainText(/Innkjøp i perioden350,25 kr/);
  await expect(await spend("Helt Ny AS")).toContainText(/Innkjøp i perioden400 kr/);
  await expect(page.getByTestId("period-summary")).toContainText("Kjente produksjonslandUkjent");

  // Samme fil en gang til: det sies fra, alt krever valg, og ingenting dobles.
  await page.goto(`/o/${fx.orgA}/leverandorer/import`);
  await expect(page.getByRole("table", { name: "Tidligere importer" })).toContainText("Fullført");
  await page.getByLabel("CSV-fil").setInputFiles(file);
  // Forhåndsvisningen teller rader (fire treffer), grunnlaget teller leverandører (tre).
  await expect(page.getByTestId("import-summary")).toContainText("4 finnes fra før");
  await page.getByRole("button", { name: "Klargjør import" }).click();
  await expect(page.getByText("Denne filen er importert før")).toBeVisible();
  await expect(undecided).toContainText("5 oppføringer mangler valg.");
  await page.getByRole("group", { name: /Leverandører som finnes fra før \(3\)/ }).getByLabel("Oppdater innkjøpsdata for alle").check();
  await page.getByRole("group", { name: /Nye leverandører med avklaringer \(1\)/ }).getByLabel("Utelat alle").check();
  await page.getByRole("group", { name: /Rader med feil \(1\)/ }).getByLabel("Utelat alle rader med feil").check();
  await expect(undecided).toHaveCount(0);
  await confirm.click();
  await expect(result).toContainText("Opprettet0 nye leverandører");
  await expect(result).toContainText("Uendret3 hadde ingen nye verdier");
  await expect(await spend("Finnes Fra Før AS")).toContainText(/Innkjøp i perioden2\s500,50 kr/);
  await page.goto(`/o/${fx.orgA}/leverandorer`);
  await expect(page.getByRole("table", { name: "Aktive leverandører" }).getByRole("row")).toHaveCount(4);

  // Revisjonsloggen har importene per batch, med antall.
  await nav.getByRole("link", { name: "Innstillinger" }).click();
  await page.getByRole("navigation", { name: "Filtrer revisjonslogg" }).getByRole("link", { name: "Import", exact: true }).click();
  const log = page.getByRole("table", { name: "Revisjonslogg" });
  await expect(log).toContainText("Import bekreftet");
  await expect(log).toContainText(/Import gjennomført.*Opprettet: 0 → 2/);
  await expect(log).not.toContainText("Summert AS");

  // Batch-id i adressen er bare en kandidat: ukjent id og id fra en annen tabell gir «Ikke funnet».
  for (const candidate of ["ikke-en-id", fx.orgA]) {
    await page.goto(`/o/${fx.orgA}/leverandorer/import/${candidate}`);
    await expect(page.getByRole("heading", { name: "Ikke funnet" }), candidate).toBeVisible();
  }
});
