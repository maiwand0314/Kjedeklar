import { expect, test } from "@playwright/test";
import { createTenantFixture, randomTestIp } from "../helpers/local-backend";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": randomTestIp() });
});

test("rapportperiode og virksomhetsprofil: opprett, velg, lagre, hull og lagringsfeil", async ({ page, context }) => {
  // Egen fixture, så perioder og profil ikke påvirker andre tester.
  const fx = createTenantFixture();
  await page.goto("/logg-inn");
  await page.getByLabel("E-post").fill(fx.userA.email);
  await page.getByLabel("Passord").fill(fx.password);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}$`));

  // Uten periode: lenke i toppen, tom tilstand og ingen profil å fylle ut.
  await page.getByRole("link", { name: "Opprett rapportperiode" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}/virksomheten`));
  const periodSection = page.getByRole("region", { name: "Rapportperiode" });
  await expect(periodSection).toContainText("Ingen rapportperiode ennå");
  await expect(page.getByRole("region", { name: "Virksomhetsprofil" })).toHaveCount(0);

  const periodForm = page.locator("form", { has: page.getByRole("button", { name: "Opprett periode" }) });
  const createPeriod = async (start: string, end: string, due: string) => {
    await periodForm.getByLabel("Fra og med").fill(start);
    await periodForm.getByLabel("Til og med").fill(end);
    await periodForm.getByLabel("Publiseringsfrist").fill(due);
    await periodForm.getByRole("button", { name: "Opprett periode" }).click();
  };
  const periodIdInUrl = () => new URL(page.url()).searchParams.get("periode");

  // Ugyldig intervall stoppes ved feltet.
  await createPeriod("2025-07-01", "2025-06-30", "2026-12-31");
  await expect(periodForm.getByText("Sluttdatoen må være etter startdatoen.")).toBeVisible();

  // Avvikende regnskapsår med egen frist.
  await createPeriod("2025-07-01", "2026-06-30", "2026-12-31");
  await expect(page).toHaveURL(/periode=/);
  const firstPeriod = periodIdInUrl();
  const selected = page.getByTestId("selected-period");
  await expect(selected).toHaveText("01.07.2025 – 30.06.2026");
  await expect(periodSection).toContainText("31.12.2026");

  // En nyere periode blir valgt etter oppretting; den første velges igjen i toppen.
  await createPeriod("2026-07-01", "2027-06-30", "2027-12-31");
  await expect(selected).toHaveText("01.07.2026 – 30.06.2027");
  expect(periodIdInUrl()).not.toBe(firstPeriod);
  await page.getByText("(bytt periode)").click();
  await page.getByRole("list", { name: "Bytt rapportperiode" }).getByRole("link", { name: "01.07.2025 – 30.06.2026" }).click();
  await expect(page).toHaveURL(new RegExp(`periode=${firstPeriod}$`));
  await expect(selected).toHaveText("01.07.2025 – 30.06.2026");

  // Valgt periode følger navigasjonen, selv om den ikke er den nyeste.
  const nav = page.getByRole("navigation", { name: "Hovedmeny" });
  await nav.getByRole("link", { name: "Oversikt" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${fx.orgA}\\?periode=${firstPeriod}$`));
  await expect(selected).toHaveText("01.07.2025 – 30.06.2026");
  await nav.getByRole("link", { name: "Virksomheten" }).click();
  await expect(page).toHaveURL(new RegExp(`/virksomheten\\?periode=${firstPeriod}$`));

  // Profilen: alt er hull før noe er lagret.
  const profile = page.getByRole("region", { name: "Virksomhetsprofil" });
  await expect(profile).toContainText("perioden 01.07.2025 – 30.06.2026");
  await expect(profile).toContainText("Profilen er ikke lagret for denne perioden.");
  await expect(profile.getByTestId("profile-gaps")).toContainText("Ikke besvart (8)");

  const form = page.locator("form", { has: page.getByRole("button", { name: "Lagre profilen" }) });
  await form.getByLabel("Hvordan er virksomheten organisert?").fill("Syntetisk aksjeselskap med ti ansatte.");
  await form.getByRole("group", { name: /vedtatt retningslinjer/ }).getByLabel("Nei, ikke etablert").check();
  const responsibility = form.getByRole("group", { name: /ansvaret for arbeidet/ });
  await responsibility.getByLabel("Ja", { exact: true }).check();

  // «Ja» uten beskrivelse lagres ikke.
  await form.getByRole("button", { name: "Lagre profilen" }).click();
  await expect(responsibility.getByText("Skriv en beskrivelse, eller velg et annet svar.")).toBeVisible();
  await responsibility.getByLabel("Beskrivelse: ansvar").fill("Daglig leder, rapporterer til styret.");
  await form.getByRole("button", { name: "Lagre profilen" }).click();
  await expect(form.getByRole("status")).toHaveText("Profilen er lagret som versjon 1.");

  // Lagret: ubesvarte temaer er fortsatt synlige hull, og «ikke etablert» vises som det.
  await expect(profile).toContainText("Versjon 1, lagret");
  await expect(profile).toContainText("Ikke bekreftet.");
  await expect(profile.getByTestId("profile-gaps")).toContainText("Ikke besvart (5)");
  await expect(profile.getByTestId("profile-gaps")).toContainText("Rutiner");
  await expect(profile).toContainText("Oppgitt som ikke etablert: Retningslinjer");
  await expect(profile.getByRole("table", { name: "Versjoner av virksomhetsprofilen" }).getByRole("row")).toHaveCount(2);

  // Lagringsfeil: en annen fane lagrer først. Den utdaterte fanen får beskjed og beholder teksten.
  const stale = await context.newPage();
  await stale.goto(page.url());
  const staleForm = stale.locator("form", { has: stale.getByRole("button", { name: "Lagre profilen" }) });
  const staleText = "Tekst skrevet i en utdatert fane.";
  await staleForm.getByLabel(/Hva driver virksomheten med/).fill(staleText);

  await form.getByLabel(/Jeg bekrefter/).check();
  await form.getByRole("button", { name: "Lagre profilen" }).click();
  await expect(form.getByRole("status")).toHaveText("Profilen er lagret som versjon 2.");
  await expect(profile).toContainText("Bekreftet internt.");

  await staleForm.getByRole("button", { name: "Lagre profilen" }).click();
  await expect(staleForm.getByRole("alert")).toContainText("endret siden du så dem");
  await expect(staleForm.getByLabel(/Hva driver virksomheten med/)).toHaveValue(staleText);
  await stale.close();

  // Periode i adressen er bare en kandidat: ukjent id og id fra en annen tabell gir samme
  // nøytrale «Ikke funnet». (Statuskoden er 200 fordi siden strømmes etter lastetilstanden.)
  for (const candidate of ["ikke-en-id", fx.orgA]) {
    await page.goto(`/o/${fx.orgA}/virksomheten?periode=${candidate}`);
    await expect(page.getByRole("heading", { name: "Ikke funnet" }), candidate).toBeVisible();
    await expect(page.getByRole("region", { name: "Virksomhetsprofil" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Lagre profilen" })).toHaveCount(0);
  }
});
