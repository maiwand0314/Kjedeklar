import { expect, test } from "@playwright/test";
import { createTenantFixture, randomTestIp } from "../helpers/local-backend";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomTestIp() });
});

test("leverandør: opprett, innkjøp med ukjent og null, konflikt, duplikat, søk og arkivering", async ({ page, context }) => {
  // Egen fixture, så leverandørene ikke påvirker andre tester.
  const fx = createTenantFixture();
  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(fx.userA.email);
  await page.getByLabel("Passord").fill(fx.password);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));
  const nav = page.getByRole("navigation", { name: "Hovedmeny" });

  // Tom liste, og ny leverandør med feil ved feltene.
  await nav.getByRole("link", { name: "Leverandører" }).click();
  await expect(page.getByText("Ingen leverandører ennå")).toBeVisible();
  await page.getByRole("link", { name: "Ny leverandør" }).click();
  const newForm = page.locator("form", { has: page.getByRole("button", { name: "Opprett leverandør" }) });
  await newForm.getByLabel("Norsk organisasjonsnummer").fill("920000003");
  await newForm.getByRole("button", { name: "Opprett leverandør" }).click();
  await expect(newForm.getByText("Skriv navnet på leverandøren.")).toBeVisible();
  await expect(newForm.getByText("Organisasjonsnummeret er ikke gyldig (9 siffer).")).toBeVisible();

  await newForm.getByLabel("Navn", { exact: true }).fill("Syntetisk Tekstil AS");
  await newForm.getByLabel("Norsk organisasjonsnummer").fill("920 000 002");
  await newForm.getByLabel("Registreringsland").selectOption({ label: "Norge" });
  await newForm.getByRole("button", { name: "Opprett leverandør" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Syntetisk Tekstil AS" })).toBeVisible();
  const supplierUrl = page.url();

  // Uten rapportperiode kan ikke innkjøp registreres; siden sier hva som mangler.
  const purchases = page.getByRole("region", { name: "Innkjøp i rapportperioden" });
  await expect(purchases).toContainText("Ingen rapportperiode ennå");
  await purchases.getByRole("link", { name: "Opprett en rapportperiode" }).click();
  await page.getByRole("button", { name: "Opprett periode" }).click();
  await expect(page).toHaveURL(/periode=/);
  await page.goto(supplierUrl);

  // Norsk registrering gjør ikke produksjonslandet kjent, og ukjent beløp er ikke null.
  const summary = page.getByTestId("period-summary");
  await expect(summary).toContainText("Innkjøp i periodenUkjent");
  await expect(summary).toContainText("RegistreringslandNorge");
  await expect(summary).toContainText("Kjente produksjonslandUkjent");
  await expect(summary).toContainText("Leddene bak leverandørenUkjent");

  const periodForm = page.locator("form", { has: page.getByRole("button", { name: "Lagre innkjøpsdata" }) });
  const spend = periodForm.getByLabel("Innkjøp i perioden (kroner)");
  await spend.fill("12 kr");
  await periodForm.getByRole("button", { name: "Lagre innkjøpsdata" }).click();
  await expect(periodForm.getByText(/Skriv beløpet i kroner/)).toBeVisible();

  await spend.fill("0");
  await periodForm.getByRole("button", { name: "Lagre innkjøpsdata" }).click();
  await expect(periodForm.getByRole("status")).toHaveText("Innkjøpsdataene er lagret.");
  await expect(summary).toContainText("Innkjøp i perioden0 kr");
  await expect(summary).toContainText("Kjente produksjonslandUkjent");

  await spend.fill("1 250,50");
  await periodForm.getByLabel("Kategori").fill("Arbeidstøy");
  await periodForm.getByLabel("Land", { exact: true }).selectOption({ label: "Vietnam" });
  await periodForm.getByRole("button", { name: "Legg til land" }).click();
  await expect(periodForm.getByRole("list", { name: "Valgte produksjonsland" })).toContainText("Vietnam");
  await periodForm.getByRole("button", { name: "Lagre innkjøpsdata" }).click();
  await expect(summary).toContainText(/Innkjøp i perioden1\s250,50 kr/);
  await expect(summary).toContainText("KategoriArbeidstøy");
  await expect(summary).toContainText("Kjente produksjonslandVietnam");
  // Lagret verdi står igjen etter ny lasting.
  await page.reload();
  await expect(spend).toHaveValue("1250,50");

  // Lagringsfeil: en annen fane lagrer profilen først. Den utdaterte fanen får beskjed og beholder teksten.
  const profileForm = page.locator("form", { has: page.getByRole("button", { name: "Lagre profilen" }) });
  const stale = await context.newPage();
  await stale.goto(page.url());
  const staleForm = stale.locator("form", { has: stale.getByRole("button", { name: "Lagre profilen" }) });
  await staleForm.getByLabel("Navn", { exact: true }).fill("Utdatert navn AS");
  await profileForm.getByLabel("Egen leverandør-ID").fill("L-1001");
  await profileForm.getByRole("button", { name: "Lagre profilen" }).click();
  await expect(profileForm.getByRole("status")).toHaveText("Leverandøren er lagret.");
  await staleForm.getByRole("button", { name: "Lagre profilen" }).click();
  await expect(staleForm.getByRole("alert")).toContainText("Noen har endret leverandøren");
  await expect(staleForm.getByLabel("Navn", { exact: true })).toHaveValue("Utdatert navn AS");
  await stale.close();

  // Samme org.nr. avvises; samme navn er lov, men vises som mulig duplikat uten sammenslåing.
  await page.getByRole("link", { name: "Til leverandørlisten" }).click();
  await page.getByRole("link", { name: "Ny leverandør" }).click();
  await newForm.getByLabel("Navn", { exact: true }).fill("syntetisk tekstil as");
  await newForm.getByLabel("Norsk organisasjonsnummer").fill("920000002");
  await newForm.getByRole("button", { name: "Opprett leverandør" }).click();
  await expect(newForm.getByRole("alert")).toContainText("Det finnes allerede en leverandør med dette organisasjonsnummeret");
  await newForm.getByLabel("Norsk organisasjonsnummer").fill("");
  await newForm.getByRole("button", { name: "Opprett leverandør" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "syntetisk tekstil as" })).toBeVisible();
  await expect(page.getByTestId("same-name")).toContainText("Mulig duplikat");
  await expect(page.getByTestId("same-name").getByRole("link", { name: "Syntetisk Tekstil AS" })).toBeVisible();

  // Listen: begge leverandørene, søk på starten av navnet, og ukjent vises som tekst.
  await page.getByRole("link", { name: "Til leverandørlisten" }).click();
  const rows = page.getByRole("table", { name: "Aktive leverandører" }).getByRole("row");
  await expect(rows).toHaveCount(3);
  await expect(rows.filter({ has: page.getByRole("link", { name: "syntetisk tekstil as", exact: true }) })).toContainText("Ukjent");
  await page.getByLabel("Søk på starten av navnet").fill("zzz");
  await page.getByRole("button", { name: "Søk" }).click();
  await expect(page.getByText("Ingen treff")).toBeVisible();
  await page.getByLabel("Søk på starten av navnet").fill("SYNT");
  await page.getByRole("button", { name: "Søk" }).click();
  await expect(rows).toHaveCount(3);

  // Arkivering: ut av aktiv liste, inn i arkivet, med alt bevart, og kan angres.
  await rows.getByRole("link", { name: "Syntetisk Tekstil AS", exact: true }).click();
  await page.getByRole("button", { name: "Arkiver leverandøren" }).click();
  await expect(page.getByText("Arkivert.")).toBeVisible();
  await expect(summary).toContainText(/Innkjøp i perioden1\s250,50 kr/);
  await page.getByRole("link", { name: "Til leverandørlisten" }).click();
  await expect(rows).toHaveCount(2);
  await page.getByRole("navigation", { name: "Vis leverandører" }).getByRole("link", { name: "Arkiverte" }).click();
  const archivedRows = page.getByRole("table", { name: "Arkiverte leverandører" }).getByRole("row");
  await expect(archivedRows).toHaveCount(2);
  await archivedRows.getByRole("link", { name: "Syntetisk Tekstil AS" }).click();
  await page.getByRole("button", { name: "Gjenopprett leverandøren" }).click();
  await expect(page.getByRole("button", { name: "Arkiver leverandøren" })).toBeVisible();

  // Revisjonsloggen viser hendelsene, med beløpet i kroner.
  await nav.getByRole("link", { name: "Innstillinger" }).click();
  await page.getByRole("navigation", { name: "Filtrer revisjonslogg" }).getByRole("link", { name: "Leverandører" }).click();
  const log = page.getByRole("table", { name: "Revisjonslogg" });
  for (const event of ["Leverandør opprettet", "Leverandør endret", "Leverandør arkivert", "Leverandør gjenopprettet"]) {
    await expect(log).toContainText(event);
  }
  await page.getByRole("navigation", { name: "Filtrer revisjonslogg" }).getByRole("link", { name: "Innkjøpsdata" }).click();
  await expect(log).toContainText(/Innkjøp: 0 kr → 1\s250,50 kr/);

  // Leverandør-id i adressen er bare en kandidat: ukjent id og id fra en annen tabell gir «Ikke funnet».
  for (const candidate of ["ikke-en-id", fx.orgA]) {
    await page.goto(`/o/${fx.orgA}/leverandorer/${candidate}`);
    await expect(page.getByRole("heading", { name: "Ikke funnet" }), candidate).toBeVisible();
    await expect(page.getByRole("button", { name: "Lagre profilen" })).toHaveCount(0);
  }
});
