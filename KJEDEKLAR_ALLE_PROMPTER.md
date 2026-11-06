# Kjedeklar – alle oppgaveprompter

Se START_HER.md for bruk og docs/OPPGAVER.md for oversikt. Kopier én promptblokk om gangen til Claude Code. Ikke kjør alle oppgaver som én samlet bestilling.


---

# Oppgave 01: Kjørbart prosjektskjelett

**Avhengighet:** Ingen. **Anslått aktiv tid:** 3–5 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 01: Kjørbart prosjektskjelett.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Opprett repoets minste kjørbare vertikale grunnmur: database, innlogging, én beskyttet side, tenantstruktur og CI.

Berørte filer/moduler
package.json, pnpm-lock.yaml, src/app/, src/server/auth/, src/server/db/, src/server/tenancy/, drizzle/, compose.yml, .env.example, .github/workflows/ci.yml, README.md
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Undersøk arbeidsmappen og eksisterende git før du endrer noe. Initialiser git bare hvis mappen ikke er et repo; ikke opprett eksternt repo eller push. Sett opp valgt stack, migrasjonsrolle, avgrenset authrolle og ikke-eiende runtime-rolle. Opprett kun Better Auths nødvendige tabeller, Organization og Membership. Lag to syntetiske organisasjoner og lokale testbrukere med passord fra utviklingsmiljø, aldri hardkodet produksjonsbruker. Email/passord-login fungerer lokalt; ingen åpen registrering. Implementer requireMembership/withTenant og RLS for tenantroten. Én norsk beskyttet side viser valgt organisasjons navn. Ingen leverandør-, risiko-, AI- eller rapportmoduler. Legg kommandoavtalen fra CLAUDE.md i package.json for eksisterende deler og dokumenter separat test-DB. Velg og lås kompatible stabile versjoner.

Akseptkriterier
1. Fra ren klon kan en utvikler følge README for installasjon, DB, migrasjon, seed og oppstart.
2. Uinnlogget bruker kommer ikke inn; innlogget bruker ser bare en organisasjon vedkommende er medlem av. Manglende tenant gir avslag.
3. Appen kobler med runtime/auth-rolle, aldri migrator. Separate env-eksempler inneholder ingen ekte secrets.
4. CI installerer låst avhengighetssett, migrerer tom PostgreSQL og kjører lint, typer, tester og build. Ingen kundedata eller produksjonssecrets.

Tester og verifisering
Integrasjonstest mot PostgreSQL: bruker A kan lese org A og kan ikke lese org B gjennom samme serverinngang. Playwright-smoke: lokal login → beskyttet side → logout. Testene må være reelt kjørbare i CI, ikke bare konfigurasjonsfiler. Kjør alle grunnsjekkene. Dette er en lokal grunnmur, ikke ferdig produksjonsautentisering.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 02: Bevis tenant-isolasjonen

**Avhengighet:** 01. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 02: Bevis tenant-isolasjonen.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Herd grunnmuren og bevis at tenants ikke kan lese, endre eller koble hverandres data.

Berørte filer/moduler
src/server/tenancy/, src/server/db/, drizzle/*rls*.sql, tests/integration/tenancy.test.ts, docs/decisions/tenant-boundary.md
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Gjennomgå samtlige serverinnganger og DB-rettigheter. FORCE RLS, default-deny, USING/WITH CHECK og transaksjonslokal tenantkontekst skal være eksplisitte. Lag gjenbrukbar testhjelper for to kunder og kontroller at testforbindelsen bruker faktisk runtime. Avgrens auth/membership-rollen fra kundedata. Bruk Organization som ekte testobjekt; ikke legg inn en dummy produksjonstabell. Forbered en sjekkliste/testhelper for sammensatte FK-er når nye tabeller bygges. Dokumenter hvorfor valgt org i cookie/URL ikke er autorisasjon.

Akseptkriterier
1. Forsøk på fremmed org i URL, input og cookie gir samme avslag uten å røpe data.
2. Runtime er ikke eier/BYPASSRLS og kan ikke endre policyer eller TRUNCATE.
3. Tenantkontekst overlever ikke transaksjonen ved gjenbrukt poolforbindelse, rollback eller samtidige kall.
4. Authrollen kan ikke SELECT forretningsdata; medlemskap kan ikke tildeles via en vanlig kunde-request.

Tester og verifisering
Negative integrasjonstester for SELECT/INSERT/UPDATE/DELETE der operasjonen finnes; direkte SQL med manglende/fremmed kontekst; poolgjenbruk A→B→uten kontekst og rollback. Test faktisk rolle med DB-spørring og eksplisitt assertion. Sett fremtidige FK-misbrukstilfeller i testhelperen, ikke tomme grønne tester.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 03: Invitasjon, verifisering og kontogjenoppretting

**Avhengighet:** 02. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 03: Invitasjon, verifisering og kontogjenoppretting.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gjør pilotens kontolivssyklus brukbar uten åpen selvregistrering.

Berørte filer/moduler
src/server/auth/, src/server/email/, src/modules/organizations/, scripts/provision-organization.ts, drizzle/, tests/integration/auth*, tests/e2e/auth*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Implementer kontrollert opprettelse av workspace/første admin via operatørkommando og invitasjon. Bare en admin i aktuell tenant kan invitere flere administratorer. Bruk Better Auths støttede mekanismer for emailverifisering, passordreset og sesjoner. Invitasjoner er engangs, utløper, lagres sikkert og krever riktig verifisert e-post. Sett opp Mailpit lokalt og et SMTP-interface; ingen produksjonsleverandør aktiveres her. Legg ratebegrensning på innlogging/reset som virker på tvers av prosessrestart eller bruker en dokumentert felles lagring; unngå account enumeration. Bruk sikre cookies og frameworkets origin/CSRF-mekanismer. Org.nr. er ingen eierskapsverifisering.

Akseptkriterier
1. Invite → verifisering → velg passord → login fungerer i Mailpit.
2. Feil e-post, utløpt eller brukt invitasjon gir ingen Membership.
3. Reset flyt virker, gammel lenke er ubrukelig og relevante sesjoner kan tilbakekalles.
4. Vanlig brukerinput kan ikke sette adminrolle eller velge fremmed tenant; dev-seed/provisionering kan ikke utilsiktet kjøre mot produksjon.

Tester og verifisering
Integrasjon: gjenbruk/utløp/feil mottaker, to samtidige akseptforsøk, ugyldig origin og rategrense. E2E: aksept og passordreset via lokal e-post. Kontroller at logg ikke inneholder token eller passord.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 04: Norsk appskall og navigasjon

**Avhengighet:** 03. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 04: Norsk appskall og navigasjon.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Bygg et rolig profesjonelt, norsk grensesnitt med tydelig valgt virksomhet og senere rapportperiode.

Berørte filer/moduler
src/app/(app)/, src/components/ui/, src/modules/organizations/components/, tests/e2e/navigation*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag responsiv sidebar/header og sider for Oversikt, Virksomheten, Leverandører, Risikovurderinger, Funn og tiltak, Redegjørelse og Innstillinger. Ubygde deler har ærlige tomtilstander, ingen fiktive kundetall. Vis organisasjon og trygg bytting bare mellom egne medlemskap. Etabler typografi, spacing, tabell-/skjemaprimitiver, lys/mørk modus og loading/error/empty-states. Bruk lokal font. Unngå å bygge et generelt designsystem utover dette.

Akseptkriterier
1. Norsk bokmål i all synlig tekst og feilmeldinger.
2. Navigasjonen fungerer på mobil og desktop; tastaturfokus og skjemalabels er synlige.
3. Organisasjonsbytte rydder tidligere viste kundedata; ingen flash med forrige kunde.
4. Ingen eksterne font-/analyticskall og ingen demoinnhold som ser ekte ut.

Tester og verifisering
Playwright: naviger med tastatur, vis mobilbredde, bytt organisasjon og test loading/avslag. Enkel tilgjengelighetssjekk av sentrale skjema/navigation; visuell manuell kontroll i begge tema. Ikke skriv snapshot av hele DOM.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 05: Transaksjonell revisjonslogg

**Avhengighet:** 04. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 05: Transaksjonell revisjonslogg.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Etabler en gjenbrukbar revisjonslogg før forretningsfunksjonene får mutasjoner.

Berørte filer/moduler
src/modules/audit/, src/server/db/schema/audit.ts, drizzle/, src/modules/organizations/service.ts, tests/integration/audit*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag AuditEvent, eksplisitt safe-diff og auditservice som krever eksisterende tenant-transaksjon. Koble den til endring av et reelt organisasjonsfelt og medlemskap/invitasjonshendelser uten token. Legg visning i Innstillinger med filtrering/paginering. Tid kommer fra server/DB. Runtime får INSERT og autorisert SELECT, ikke UPDATE/DELETE/TRUNCATE. Dokumenter separat kontrollert vedlikeholds-/sletteprosess, ikke en kundeknapp for å endre historikk.

Akseptkriterier
1. Endring og audit er atomiske; feil i audit gir ingen endring.
2. Aktør, tenant, objektreferanse, hendelse, tidspunkt og safe diff lagres.
3. Fremmed kunde kan ikke se audit og runtime kan ikke omskrive den.
4. Passord, tokens og fritekst med unødvendige personopplysninger inngår ikke i diff.

Tester og verifisering
Integrasjon: fremprovosert auditfeil ruller tilbake domeneendring; direkte UPDATE/DELETE av audit feiler; to tenants isoleres; tillatt diff inneholder bare avtalte felter. Manuell gjennomgang av en logget endring.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 06: Brreg-oppslag for egen virksomhet

**Avhengighet:** 05. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 06: Brreg-oppslag for egen virksomhet.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Hent nødvendige virksomhetsopplysninger på org.nr. og la kunden bekrefte dem.

Berørte filer/moduler
src/server/integrations/brreg/, src/modules/organizations/, tests/fixtures/brreg/, tests/unit/brreg*, tests/integration/organization*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Implementer server-side adapter til dokumentert Enhetsregister-endepunkt med org.nr.-validering, timeout, begrenset retry og Zod for valgte felt. Hent bare navn, org.nr., organisasjonsform, adresse, bransjekode og relevant status. Lag bekreftelsessteg og minimal RegistrySnapshot med kildetid. Organisasjonsnummer kan ikke brukes til å ta over eller slå sammen workspace. Ikke hent personroller eller forsøk å utlede årsverk/salgsinntekt fra antallAnsatte.

Akseptkriterier
1. Gyldig oppslag vises før kunden lagrer; kilde og hentetid er synlige.
2. 404, ugyldig org.nr., timeout, manglende bransje og API-endring gir forståelige feil/datamangler.
3. Brukerens tidligere bekreftede verdier overskrives ikke stille.
4. Endring og audit lagres atomisk; orgbytte gir ikke tilgang til en annen tenant.

Tester og verifisering
Adaptertester med realistiske syntetiske kontraktfixtures, 404/429/timeout/manglende felt. Integrasjon: bekreftet lagring og audit, uautorisert endring av fremmed org avvises. Live-oppslag er valgfri manuell kontroll, ikke en ustabil CI-avhengighet.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 07: Veiledende vurdering av lovens virkeområde

**Avhengighet:** 06. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 07: Veiledende vurdering av lovens virkeområde.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gi en forklarbar, veiledende pliktvurdering med synlig usikkerhet og versjonerte regler.

Berørte filer/moduler
src/modules/organizations/applicability/, drizzle/, docs/decisions/applicability-rules.md, tests/unit/applicability*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Les gjeldende §§2–3 og dokumenter sannhetstabell før implementasjon. Be om salgsinntekt, balansesum og gjennomsnittlige årsverk for to år, tidligere status, konsern/allmenn interesse og norsk/utenlandsk tilknytning. For ordinære norske tilfeller med avklart historikk: sannsynlig omfattet/ikke omfattet. Konsern, særlige virkeområder, overgangstilfeller med ukjent historikk eller ufullstendig input gir manuell avklaring. Ikke lag en omfattende juridisk ekspertmotor. Vis input, terskler, regelversjon og begrunnelse; la kunden bekrefte grunnlaget.

Akseptkriterier
1. Nøyaktig terskel behandles etter lovens ordlyd; antallAnsatte fra Brreg brukes ikke som årsverk.
2. Toårsregelen inngår i testmatrisen; ukjent historikk gir ikke skråsikkert nei.
3. Alle resultater er veiledende og lagres som ny historikk med kundens bekreftelse.
4. Et sannsynlig ikke-omfattet foretak kan fortsatt bruke verktøyet frivillig; ingen automatisk utestenging.

Tester og verifisering
Tabellstyrte tester for 0/1/2/3 overskredne terskler, lik terskel, ett/to sammenhengende år, ny overgang og ukjent historikk, konsern/allmenn interesse/utenlandsk virksomhet. Testmatrisen må bygge på lest kilde; ved uløst tolkning skal utfallet være manuell avklaring. Integrasjon for tenant og audit.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 08: Rapportperiode og virksomhetsprofil

**Avhengighet:** 07. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 08: Rapportperiode og virksomhetsprofil.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Opprett årets dokumentasjonsgrunnlag for egen virksomhet, rutiner og ansvar.

Berørte filer/moduler
src/modules/organizations/profile/, src/server/db/schema/reporting-period.ts, drizzle/, tests/integration/profile*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag ReportingPeriod med eksplisitte datoer og publiseringsfrist, samt versjonert BusinessProfileRevision. Skjema for organisering, drift/produkter, geografisk virksomhet, ansvar, retningslinjer, rutiner, interessentdialog og eventuell gjenopprettingsprosess. Skill ikke etablert/ukjent fra utfylt. Ikke påstå at kunden har en policy bare fordi feltet finnes. Kalenderår foreslås, avvikende perioder tillates. Ingen automatisk årshjul eller e-postvarsler.

Akseptkriterier
1. Kunden kan opprette og velge periode med start/slutt og eksplisitt frist.
2. Profilendringer lagres som historikk med audit og bekreftet status.
3. Usvarte spørsmål forblir synlige hull.
4. Valgt periode følger navigasjon og kan ikke referere til en annen tenant.

Tester og verifisering
Enhet: datoer, ugyldig intervall, avvikende regnskapsår. Integrasjon: ny profilversjon bevarer gammel, fremmed periode avvises med tenant-FK, audit ved endring. E2E-smoke av skjema og lagringsfeil.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 09: Leverandørregister med manuell registrering

**Avhengighet:** 08. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 09: Leverandørregister med manuell registrering.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag den minste nyttige leverandørlisten og detaljsiden før CSV bygges.

Berørte filer/moduler
src/modules/suppliers/, src/server/db/schema/supplier.ts, drizzle/, tests/integration/suppliers*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Implementer Supplier og SupplierPeriod, manuell opprettelse/redigering/arkivering og paginert søk. Felter: navn, stabil ID/org.nr. hvis kjent, registreringsland, kodeverk+bransjekode, kjøpsbeskrivelse/kategori, kjente produksjonsland og ukjent oppstrøms, årets innkjøpsbeløp i NOK. Ukjent er lovlig der datagrunnlaget mangler. Ikke bygg risiko ennå. Dedup av org.nr. innen tenant; navnelikhet er forslag, ikke automatisk sammenslåing. Optimistisk låsing ved redigering.

Akseptkriterier
1. Leverandørprofil er adskilt fra årets innkjøpsdata.
2. Beløp lagres eksakt i øre og vises norsk; ukjent beløp er forskjellig fra null.
3. Norsk registrering gjør ikke produksjonslandet kjent.
4. Arkivering bevarer historikk; alle endringer får audit.

Tester og verifisering
Integrasjon: samme org.nr. tillatt i ulike tenants, avvist dobbelt innen tenant; fremmed periode-/supplier-FK avvises; concurrency gir konflikt fremfor datatap; audit. Enhetstest av norsk desimalparsing og store beløp.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 10: CSV-opplasting og forhåndsvisning

**Avhengighet:** 09. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 10: CSV-opplasting og forhåndsvisning.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
La brukeren laste opp og forstå en CSV før den påvirker leverandørregisteret.

Berørte filer/moduler
src/modules/suppliers/import/parse.ts, src/modules/suppliers/import/components/, tests/fixtures/csv/, tests/unit/csv*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Bruk et etablert CSV-bibliotek, ikke split(','). Støtt UTF-8/BOM, komma/semikolon, siterte felter og norske beløpsformater. Mapping av kolonner for navn, org.nr./ekstern ID, land og beløp; valgfrie bransje-/kjøpsfelter. 2 MiB/2 000 rader. Vis kildekolonne, normalisert verdi, radfeil, dubletter og foreslått matching. Ingen databaseendring av leverandører i denne oppgaven. Ren parser kjøres og valideres også på server. Legg en syntetisk CSV-mal i repoet.

Akseptkriterier
1. Kolonnemapping og feil kan gjennomgås før import.
2. Ukjent land, ugyldig org.nr., tvetydig beløp og negative beløp blir synlige avklaringer.
3. Filer over grense avvises tidlig; filinnhold renderes som tekst.
4. Råfil lagres ikke offentlig eller i logg.

Tester og verifisering
Fixtures for BOM, separatorer, escaped quotes, linjeskift, tomt felt, liknende navn, eksakt beløp, ugyldig encoding og fil-/radgrense. Test HTML/script-lignende navn og regnearkformler som ubetrodd tekst. Manuell preview med feilfil.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 11: Bekreftet, idempotent CSV-import

**Avhengighet:** 10. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 11: Bekreftet, idempotent CSV-import.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lagre bare bekreftede importrader og hindre dubletter eller delvis skjult import.

Berørte filer/moduler
src/modules/suppliers/import/service.ts, src/server/db/schema/import.ts, drizzle/, tests/integration/import*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Opprett ImportBatch/ImportRow fra servervalidert preview, med tenant, periode, hash, mappingversjon og utløp. Bind commit til dette grunnlaget. La bruker eksplisitt velge skip eller oppdater kjente leverandører; årets beløp erstattes med bekreftet aggregering, ikke summeres ved retry. Uklar navnematch må avklares. Commit alle gyldige/bekreftede rader atomisk i en avgrenset transaksjon for MVP-grensen. Validerte feilrader må rettes eller eksplisitt utelates før commit. Audit per batch med relevante endringsreferanser; dokumenter nødvendig detaljnivå uten full råfil.

Akseptkriterier
1. Dobbelklikk, retry og identisk fil for samme mapping/periode gir ikke flere leverandører eller dobbelt beløp.
2. Stale/utløpt preview eller endret leverandør etter preview gir konflikt og ny bekreftelse.
3. Resultat viser opprettet/oppdatert/utelatt og valgte feilrader.
4. Fremmed batch eller target_supplier kan ikke importeres.

Tester og verifisering
Integrasjon: to samtidige commit, rollback midtveis, gjentatt fil, endret mapping, matchkonflikt, fremmed tenant og auditrollback. E2E: preview → velg håndtering → commit → kontroller totalsum og liste.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 12: Varige bakgrunnsjobber

**Avhengighet:** 11. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 12: Varige bakgrunnsjobber.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag en liten robust PostgreSQL-kø for Brreg-batch, AI og PDF.

Berørte filer/moduler
src/server/jobs/, src/worker.ts, src/server/db/schema/job.ts, drizzle/, tests/integration/jobs*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Implementer Job-tabell og én workerprosess med atomisk claim via SKIP LOCKED, lease, begrensede forsøk, backoff, status og idempotency key. Ikke bygg generelt automasjonssystem. Lag et smalt DB-grensesnitt som kun kan claime nødvendige jobbmetadata på tvers av tenants; runtime får ikke fri SELECT av alle payloads. Arbeid og resultater kjøres med eksplisitt tenantkontekst fra lagret jobb, ikke ubetrodd jobbpayload. Krev handlerallowlist og schemasjekk. Bruk kontrollert testhandler; langkjørende arbeid skjer uten lang DB-transaksjon.

Akseptkriterier
1. To workers behandler ikke samme aktive lease samtidig.
2. Jobb tas opp igjen etter crash/leaseutløp og får terminal feilstats etter maks forsøk.
3. En jobb kan ikke skrive til feil tenant eller velge egen vilkårlig handler.
4. Stoppsignal avslutter kontrollert; status kan leses bare av rett kunde.

Tester og verifisering
Integrasjon: konkurrerende claim, utløpt lease, feil/retry, idempotent resultat, fremmed objektreferanse, workerrestart og terminal feil. Bruk klokkeinjeksjon/korte testgrenser fremfor lange sleeps. Bekreft at web/worker ikke bruker migrator.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 13: Brreg-beriking av leverandører

**Avhengighet:** 12. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 13: Brreg-beriking av leverandører.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Berik norske leverandører kontrollert etter import uten å blokkere webrequesten.

Berørte filer/moduler
src/modules/suppliers/enrichment/, src/server/integrations/brreg/, src/server/jobs/handlers/, tests/integration/enrichment*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag batchjobber for org.nr.-oppslag med begrenset samtidighet og adapteren fra oppgave 06. Lagre minimal RegistrySnapshot, foreslå/oppdater avtalte registerfelter og vis status sist hentet/feilet/ikke relevant. Brukerrettede/overstyrte felt skal ikke overskrives uten bekreftelse. Skill registreringsstatus fra faglig menneskerettighetsrisiko. Eksterne leverandører uten norsk org.nr. må fungere manuelt.

Akseptkriterier
1. Import kan brukes mens beriking kjører; status per leverandør er synlig.
2. 429/timeout gir begrenset retry og delvis feilstatus uten tap av import.
3. Bransjekode har kodeverkversjon og hentetid; manglende kode blir ikke lav risiko.
4. Oppdatering gir audit og markerer relevant vurderingsgrunnlag endret når risikomodulen finnes.

Tester og verifisering
Integrasjon med fake Brreg: blanding av norske/utenlandske/manglende oppslag, restart og duplikatjobber, brukerredigering mens jobben kjører, cross-tenant payload og audit. Kontroller at nytteløs retries ikke fortsetter uendelig.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 14: Versjonerte risikodata og faglig metodekontrakt

**Avhengighet:** 13. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 14: Versjonerte risikodata og faglig metodekontrakt.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Opprett dataformat og godkjenningsflyt før risikomotoren implementeres.

Berørte filer/moduler
risk-data/, src/modules/risk/datasets/, src/server/db/schema/risk-dataset.ts, drizzle/, scripts/risk-data-*.ts, docs/decisions/risk-method-v0.md
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Definer manifests og Zod-skjema for land-/bransjedata og selvstendig metodeversjon. Felter for kildeutgave, URL, lisensavklaring, ISO-land, SN/NACE-versjon, transformationsregel, review-dato, forfallsdato, reviewer, miljø og checksum. Skriv validator/import-/aktiveringskommando med begrenset vedlikeholdsrolle; aldri en kunde-API. Opprett bare tydelig syntetiske demo-fixtures i testmiljø. Dokumenter ordinal max/ukjent-regel, prioriteringsrekkefølge og forskjell mellom kontrollsignaler og risikofaktorer. Ikke fyll ekte land med gjetninger. Eksisterende produksjonsversjon kan ikke endres på stedet.

Akseptkriterier
1. Ny dataversjon kan importeres og aktiveres uten kodeendring; gammel forblir lesbar.
2. Produksjonsaktivering av demo, uavklart lisens, manglende godkjenning eller ugyldig mapping avvises.
3. Kilder kan være utdaterte; dette blir en eksplisitt datakvalitetstilstand.
4. Metodekontrakten sier tydelig at dette er Kjedeklars screening, med krav om faglig gjennomgang før kundebruk.

Tester og verifisering
Validering: duplisert land, tvetydig bransjemapping, manglende kildereferanse, uventet kodeverk, endret checksum, utgått review, demo i prod. Integrasjon: kunde kan ikke endre felles data og ny versjon endrer ikke gammel.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 15: Deterministisk risikomotor

**Avhengighet:** 14. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 15: Deterministisk risikomotor.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Beregn forklarbar leverandørscreening og lagre reproduserbare vurderinger.

Berørte filer/moduler
src/modules/risk/engine/, src/modules/risk/service.ts, src/server/db/schema/risk-assessment.ts, drizzle/, tests/unit/risk-engine*, tests/integration/risk*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Implementer ren funksjon av normalisert input, godkjente dataversjoner og metodeversjon. Returner screening_level, data_quality, missing_fields, triggered_rules med input/kildereferanser og kontrollsignaler. Kjent høy faktor gir høy; ellers vesentlig datamangel gir ukjent; ellers høyeste kjente nivå. Registreringsland må ikke erstatte ukjent produksjonsland. Beløp skal ikke være argument til beregning av nivå. Lagre immutable input_snapshot/hash og versjonsreferanser. Bruk bulkhandling med fast grense for pilotens 2 000 leverandører; mål om den trenger oppdeling i jobber før du legger til mer kølogikk.

Akseptkriterier
1. Samme input og versjoner gir identisk resultat uten AI eller nettverkskall.
2. En høy bransje/produkt-/landfaktor kan ikke nøytraliseres av en lav faktor.
3. Ukjent/utgått kilde er synlig, og en kjent høy faktor bevares ved andre mangler.
4. Ny leverandørinput/metode gir ny vurdering og merker gammel som utdatert; historikk bevares.

Tester og verifisering
Tabelltester av lav/moderat/høy/ukjent, ingen faktorer, høy+ukjent, utgått kilde, uklart produksjonsland, kodeversjonsmismatch og administrative signaler. Egenskapstest: endring av innkjøpsbeløp påvirker aldri nivå. Integrasjon for snapshots, RLS og audit. Bruk syntetiske forventninger, ikke oppdiktede landfakta.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 16: Risikoliste, forklaring og manuell overstyring

**Avhengighet:** 15. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 16: Risikoliste, forklaring og manuell overstyring.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gjør risikoresultatene nyttige og la kunden dokumentere egne beslutninger.

Berørte filer/moduler
src/modules/risk/components/, src/modules/risk/reviews/, drizzle/, tests/integration/risk-review*, tests/e2e/risk*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag filterbar/paginert liste og detaljvisning med faktorer, kildeutgaver, datamangler og opprinnelig nivå. Egen synlig oppfølgingsgruppe for ukjent; innen samme nivå sorteres beløp fallende, nullbeløp eksplisitt. Bekreftelse/overstyring lagres som ny AssessmentReview med begrunnelse, bruker og tidspunkt. Vis screening og effektiv kundevurdering samtidig. Nye input gjør review utdatert og krever ny bekreftelse. Bruk optimistisk låsing og ingen stille siste-skriver-vinner.

Akseptkriterier
1. Brukeren kan forstå hvorfor en konkret regel slo ut og hvilke data som mangler.
2. Overstyring uten meningsfull begrunnelse avvises; originalberegningen bevares.
3. Liste og tellinger er tenant-/periodeavgrenset og skiller screening fra review.
4. Et overstyrt lavt nivå skjuler ikke opprinnelig høy screening eller ukjent oppstrøms.

Tester og verifisering
Integrasjon: manglende begrunnelse, samtidige review, input endret siden visning, fremmed assessment og auditrollback. E2E: forklaring → begrunnet overstyring → historikk. Sorteringstest beviser at stort beløp aldri flytter lav foran høy i en risikoprioritert liste.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 17: Manuelle funn, tiltak og oppfølging

**Avhengighet:** 16. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 17: Manuelle funn, tiltak og oppfølging.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gi redegjørelsen reelt grunnlag utover leverandørscore uten å bygge leverandørskjema.

Berørte filer/moduler
src/modules/diligence/, src/server/db/schema/diligence.ts, drizzle/, tests/integration/diligence*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag enkle skjema for Finding og Measure, knyttet til perioden og valgfritt leverandør/vurdering. Støtt egen virksomhet, leverandørkjede og forretningsforbindelser; faktiske/potensielle konsekvenser, berørte rettigheter, alvorlighet, sannsynlighet og kort evidensnotat. Tiltak har ansvar, frist, planlagt/gjennomført status, forventet og observert resultat samt oppfølging. Ikke konverter screening til bekreftet brudd. Ingen dokumentopplasting eller sensitive personnavn. Registrer uttrykkelig dersom kunden ikke har identifisert funn eller ikke har vurdert dette ennå.

Akseptkriterier
1. Egen virksomhet kan ha funn uten leverandør.
2. Planlagte tiltak omtales ikke som utført; forventede resultater omtales ikke som observert.
3. Et funn kan ha flere tiltak; alle koblinger er tenant-sikre.
4. Endringer logges og tidligere rapportgrunnlag kan fortsatt rekonstrueres via snapshot.

Tester og verifisering
Integrasjon: egen virksomhet uten supplier, fremmed finding/supplier/user som ansvarlig, ugyldige statusskifter, auditrollback og samtidige endringer. E2E: lag ett potensielt funn og ett planlagt tiltak med forventet resultat.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 18: AI-grensesnitt med personvern- og kostnadsgrenser

**Avhengighet:** 17. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 18: AI-grensesnitt med personvern- og kostnadsgrenser.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag et sikkert valgfritt AI-lag som er deaktivert til faktisk leverandøroppsett er avklart.

Berørte filer/moduler
src/server/ai/, src/server/db/schema/ai.ts, src/server/jobs/handlers/ai.ts, docs/decisions/ai-provider.md, tests/unit/ai*, tests/integration/ai*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Definer adapter for strukturert input/output, fake-provider, AiRun, timeouts, begrenset retry, outputvalidering og tenantbudsjett. Legg konfigurasjon for foreslått Azure OpenAI-implementasjon; reell sending krever eksplisitt godkjent providerkonfigurasjon med EU/EØS-behandling og avtalt dataminimering. Ikke velg en global modell eller geografisk fallback ved manglende kapasitet. En konfigurasjonsbool er ikke dokumentasjon: registrer hvem som har vurdert region, behandling/logging/support og kildegrunnlag. Full flyt virker med AI av. AI har ingen verktøy/SQL/URL-henting.

Akseptkriterier
1. AI er av som default; feil eller uavklart leverandør gir tydelig manuell vei.
2. Kun godkjente nødvendige felter sendes; prompts og tokens dumpes ikke i logger.
3. Maks token/kostnadsgrense per tenant og beskyttelse mot dobbel bestilling virker.
4. Modell, promptversjon, inputrefs/hash og usage lagres; output må passere skjema.

Tester og verifisering
Fake-provider: timeout, 429, ugyldig JSON, ekstraverktøyinstruksjoner i fritekst, kostnadsgrense og idempotent retry. Integrasjon: feil tenant i jobbreferanse og AI avslått når godkjenning mangler. Ekte API-test bare med syntetiske data; dokumenter hvis tilgang/avtale ikke finnes.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 19: AI-forslag til klassifisering og begrunnelser

**Avhengighet:** 18. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 19: AI-forslag til klassifisering og begrunnelser.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Hjelp brukeren med rotete kjøpsdata uten å gi AI beslutningsmyndighet.

Berørte filer/moduler
src/modules/suppliers/classification/, src/modules/risk/explanations/, src/server/ai/prompts/, tests/unit/ai-suggestions*, tests/e2e/ai-suggestions*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag eksplisitte knapper for foreslå kjøpskategori og forklar gjeldende regler på norsk. Kategoriforslag er begrenset til godkjente kategorier med inputreferanser og kan svare ukjent. Aksept/avvisning lagres som AiSuggestion. Akseptert kategori endrer input gjennom vanlig service+audit og krever ny regelberegning; AI setter aldri screeningnivå. Begrunnelsen bygger bare på triggered_rules og mangler, og en deterministisk tekst finnes som fallback. Ikke send leverandørkontakter eller hele kundelisten.

Akseptkriterier
1. Ingenting endres før kunden aksepterer.
2. Forklaring stemmer med regel-ID, nivå og kilder; uunderbygde utsagn avvises/faller tilbake til mal.
3. Akseptert kategori gir sporbar inputendring, historikk og stale vurdering.
4. Avvisning og AI-feil bevarer eksisterende arbeid og nivå.

Tester og verifisering
Fixtures med prompt injection i leverandørnavn/kjøpstekst, ukjent kategori, forsøk på å endre score og begrunnelse som motsier faktagrunnlag. Integrasjon: aksept gjennom riktig tenant og audit; E2E med fake, ikke ekte kostbare kall.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 20: Kontroll av rapportgrunnlag og hull

**Avhengighet:** 19. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 20: Kontroll av rapportgrunnlag og hull.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Samle et sammenhengende grunnlag og vis hva kunden må avklare før gjennomgang.

Berørte filer/moduler
src/modules/statements/readiness/, src/modules/statements/source-snapshot.ts, tests/unit/statement-readiness*, tests/integration/statement-source*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag server-side source snapshot for valgt periode: virksomhetsprofil, leverandørtall, gjeldende vurderinger/review, dataversjoner, mangler, funn, tiltak og resultater. Bygg readiness-sjekkliste mot innholdsområdene i §5. Et tomt funnfelt betyr ikke ingen funn; krev kundens uttrykkelige beskrivelse av hva som er undersøkt/avdekket. Skill datadekning fra juridisk etterlevelse. Vurderinger/overstyringer som er utdaterte gir synlig avklaring. Ingen AI- eller PDF-generering her.

Akseptkriterier
1. Tall og tekstreferanser kommer fra én konsistent DB-snapshot og samme tenant/periode.
2. Manglende profil, uavklart risiko og fravær av tiltak/resultat vises med lenke til riktig skjema.
3. Utkast kan lages med hull, men kan ikke merkes gjennomgått uten avklaringskontroll.
4. Kunden ser at intern sjekkliste ikke er juridisk godkjenning.

Tester og verifisering
Readiness-matrise for tom kunde, kun score, egen virksomhet uten leverandører, utdatert vurdering, uttalt ingen identifiserte funn og manglende tiltak. Integrasjon: snapshot teller korrekt ved samtidige endringer og inneholder ingen fremmede kundedata.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 21: Malbasert redegjørelse uten AI

**Avhengighet:** 20. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 21: Malbasert redegjørelse uten AI.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Generer et nyttig strukturert utkast som fungerer uten ekstern modell.

Berørte filer/moduler
src/modules/statements/templates/, src/modules/statements/service.ts, src/server/db/schema/statement.ts, drizzle/, tests/unit/statement-template*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag norsk versjonert mal for organisering/virksomhet/rutiner, metode og omfang, avdekkede faktiske konsekvenser/vesentlig risiko, tiltak/forventede eller observerte resultater og kjente begrensninger. Bruk source snapshot og eksplisitte plassholdere for mangler. Ikke fyll inn policyer, tilsynsbesøk eller positive garantier som ikke finnes. Lag Statement og immutable StatementRevision med templateversjon, input-/contenthash og kildekoblinger. Intern detaljvisning kan vise kilde-ID-er; offentlig tekst skal ikke røpe kontaktpersoner eller rå leverandørliste.

Akseptkriterier
1. Generering virker helt uten AI-nøkkel.
2. Det fremgår hva som faktisk er dokumentert og hva som mangler.
3. Rapporten har periode, virksomhet og merket status Utkast – ikke signert.
4. Ny generering oppretter ny revisjon og overskriver ikke tidligere tekst.

Tester og verifisering
Innholdstester for komplett syntetisk grunnlag og ufullstendig grunnlag. Kontroller planlagt kontra gjennomført og forventet kontra observert. Test escaping og at ingen automatisk liste over kontaktpersoner/raw supplierdata følger med. Integrasjon: revisionsnummer, snapshots, RLS og audit.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 22: AI-assistert redegjørelsesutkast

**Avhengighet:** 21. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 22: AI-assistert redegjørelsesutkast.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gi valgfri skrivehjelp basert utelukkende på bekreftet strukturert grunnlag.

Berørte filer/moduler
src/modules/statements/ai-draft/, src/server/ai/prompts/statement.ts, src/server/jobs/handlers/statement.ts, tests/unit/statement-ai*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Send minimert source snapshot med referanser til tillatte fakta, ikke rå kundeeksport. Be om strukturerte seksjoner og kilde-ID-er. Valider output, referanser og beskyttede faktafelt; bruk deterministiske blokker for kritiske tall/status som AI ikke kan endre. Uunderbygget eller feilaktig forslag avvises eller faller tilbake til mal; ikke stol på at en LLM kan kvalitetssikre seg selv. Resultatet er en ny utkastversjon som kunden må gjennomgå. Ved jobbfeil beholdes siste tekst.

Akseptkriterier
1. Ingen utsagn om utførte tiltak eller resultater oppstår uten tilsvarende data.
2. Ukjente referanser, endrede kritiske tall eller status gir avvisning.
3. AI- og malutkast har lik dokumentstruktur og samme krav til brukerreview.
4. Modell/prompt/grunnlag er sporbar internt; ingen automatisk godkjenning eller publisering.

Tester og verifisering
Fake-fixtures: oppdiktede tiltak, ukjente source-ID-er, endret leverandørtall, fritekstinjeksjon og timeout. Kontroller at avvist output ikke blir current revision. Integrasjon: tenantbudsjett, riktig snapshot, duplikatjobb og audit.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 23: Redigering, versjoner og intern gjennomgang

**Avhengighet:** 22. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 23: Redigering, versjoner og intern gjennomgang.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
La kunden ferdigstille ordlyden uten å miste historikk eller forveksle review med signering.

Berørte filer/moduler
src/modules/statements/editor/, src/modules/statements/reviews/, drizzle/, tests/integration/statement-revisions*, tests/e2e/statement-editor*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Bygg enkel seksjonseditor med tekst/avgrenset Markdown og sikker rendering, ikke et stort dokumentbehandlingssystem. Lagring oppretter ny immutable revisjon. Vis versjonsliste og sammenligning av relevante endringer. Optimistisk låsing beskytter samtidige redigeringer. Intern gjennomgang gjelder nøyaktig revisjon og kildehash. Endret tekst eller grunnlag markerer gjennomgang utdatert. Påminn om ekstern signering/publisering; ikke bygg styrekontoer eller signaturfelter som ser verifiserte ut.

Akseptkriterier
1. Kunden kan redigere, lagre ny versjon og åpne tidligere versjon.
2. Stale save gir konflikt med mulighet til å beholde egen tekst.
3. Review krever readiness-avklaring og eksplisitt brukerbekreftelse.
4. Status er Utkast eller Gjennomgått internt, aldri Signert/Publisert.

Tester og verifisering
Integrasjon: samtidige save, review av feil revisjon, endret grunnlag etter review og fremmed revisjon. E2E: rediger → ny versjon → gjennomgå → endre → review blir utdatert. Test XSS i Markdown/lenker.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 24: PDF-eksport av eksakt revisjon

**Avhengighet:** 23. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 24: PDF-eksport av eksakt revisjon.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Eksporter en lesbar norsk PDF som kan sendes til ekstern signering.

Berørte filer/moduler
src/modules/statements/pdf/, src/server/jobs/handlers/pdf.ts, src/app/api/statements/, src/server/storage/, tests/integration/pdf*, tests/fixtures/pdf/
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Render lokal HTML/CSS med Chromium i worker, A4, lokalt fontsett, sidetall, periode, virksomhet og korrekt merking. Utkast er alltid merket Utkast – ikke signert; gjennomgått revisjon kan eksporteres Til ekstern signering – ikke signert. Ingen faktisk underskrift eller publisering. Render uten eksterne nettverkskall og uten brukerdefinert HTML. Lag PdfExport med hash, status og privat storage key; gi autorisert no-store-nedlasting for eksakt revisjon. Utdatert kildegrunnlag må vises, ikke skjules av gammel review.

Akseptkriterier
1. PDF samsvarer med valgte revisjon, snapshot og merking.
2. Æ/ø/å, lange avsnitt, sideskift og tomme felt vises pent; ingen avkuttet tekst.
3. Eksport er idempotent per revisjon/merke og kan ikke lastes ned av fremmed tenant.
4. Privat lagring har størrelsesgrense og feil gir ryddbar status uten offentlig fil.

Tester og verifisering
Integrasjon: tekstuttrekk fra PDF for kritiske felter/status, fremmed export-ID, path traversal og avvist ekstern URL. Kjør manuell/renderbasert visuell QA av kort og lang syntetisk rapport; legg ikke kunderapporter i testartefakter. Test workerrestart uten dobbelt resultat.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 25: Reproduserbar EU-staging og avsenderoppsett

**Avhengighet:** 24. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 25: Reproduserbar EU-staging og avsenderoppsett.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gjør løsningen klar til kontrollert staging i EU/EØS og test teknisk e-postlevering.

Berørte filer/moduler
Dockerfile, compose.staging.yml, Caddyfile, scripts/deploy-check.ts, docs/DRIFT.md, docs/decisions/data-processors.md
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag Docker-bygg med web/worker og Chromium-avhengigheter, ikke-root prosess, health/readiness, graceful shutdown, secrets utenfor image og separate runtime/migrasjonslegitimasjoner. Dokumenter og sett opp staging bare hvis nødvendig konto/server/domene er gitt; ellers lever kjørbar lokal staging og presise konfigurasjonstrinn uten å påstå deploy. Velg EU/EØS-region eksplisitt, hold DB privat og bruk TLS. Dokumenter SMTP-kandidat, SPF/DKIM/DMARC, reply-to og bounceflyt. Ingen kundeinnhold i e-post. Reell DNS-/SMTP-test bare med gitt tilgang og en eksplisitt testadresse; ingen bulkutsending.

Akseptkriterier
1. Containerne kan bygges og kjøres lokalt med stagingkonfigurasjon og syntetiske data.
2. Ingen dev-seed, åpen DB-port, produksjonssecret eller global AI-fallback i staging.
3. DRIFT angir versjoner, oppgraderinger, migrasjon før release, healthkontroll og tilbakerulling ved kompatibel migrasjon.
4. Faktisk leverandør/region, tilgjengelige avtaler og uløste e-post-/EU-forhold dokumenteres ærlig.

Tester og verifisering
Bygg og smoke-test containerne, kontroller minste rettigheter og manglende-secrets-feil. Verifiser DNS og testlevering med tilgang; uten tilgang marker dette ikke verifisert. Test ugyldig health/dependency og at logs er redigert. Ingen produksjonsdeploy eller DNS-endring basert bare på denne generelle prompten.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 26: Backup, restore og driftskontroll

**Avhengighet:** 25. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 26: Backup, restore og driftskontroll.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Bevis at både database og privat PDF-lager kan gjenopprettes i valgt EU/EØS-oppsett.

Berørte filer/moduler
scripts/backup*, scripts/restore*, docs/DRIFT.md, docs/RESTORE-PROVE.md, infra/ hvis det finnes
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag kryptert backup av DB og private filer med begrenset tilgang, retention og separat EU/EØS-kopi. Ikke stol bare på VM-snapshot. Dokumenter nøkkelhåndtering og mål for datatap/gjenoppretting, f.eks. pilotmål 24t/4t som må måles, ikke en garanti. Gjenopprett en syntetisk installasjon til separat miljø; kontroller migrasjoner, runtimegrants, RLS og PDF-referanser. Sett enkel varselrutine/healthkontroll uten kundeinnhold. Restore-script skal nekte å overskrive produksjon uten et separat eksplisitt vedlikeholdssteg.

Akseptkriterier
1. Restore-prøve bevarer to tenants, vurderinger, audit, rapportversjon og nedlastbar PDF.
2. Backuper og nøkler havner ikke i git/CI; valgt lagringssted og tilgang er dokumentert.
3. Feilet backup kan oppdages og siste vellykkede tidspunkt finnes.
4. Sletting/restore tar hensyn til at gamle backuper ikke skal gjeninnføre slettede aktive brukere/kundedata uten oppfølging.

Tester og verifisering
Kjør faktisk backup→tomt separat miljø→restore med syntetiske data. Kjør tenanttester og PDF-hashkontroll etterpå. Test manglende nøkkel/fil og backupfeil. Logg observert tid og datatap i RESTORE-PROVE; ikke marker ikke-kjørt skylagring som verifisert.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 27: Personvern, kundeeksport og kontrollert sletting

**Avhengighet:** 26. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 27: Personvern, kundeeksport og kontrollert sletting.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag konkrete kundedokumentutkast og en begrenset operasjonell datarettighetsprosess.

Berørte filer/moduler
docs/PERSONVERN-UTKAST.md, docs/DATABEHANDLERAVTALE-UTKAST.md, docs/VILKAR-UTKAST.md, docs/decisions/retention.md, scripts/customer-export.ts, scripts/customer-delete.ts
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Beskriv faktiske data, formål, behandlingsroller, underleverandører, lokasjoner, supporttilgang, lagringstid, innsyn/sletting, hendelser og backup. Marker ukjente kontrakt-/selskapsopplysninger som avklaringer; ikke finn på DPA-er eller påstå juridisk godkjenning. Vilkår beskriver beslutningsstøtte, kundens gjennomgang/signering/publisering og faktiske tjenestegrenser. Lag operatørkommando for tenantavgrenset eksport og en dry-run-sletteplan. Selve sletting testes i isolert syntetisk miljø, krever eksplisitt tenant-ID/vedlikeholdsautorisasjon og avklart retention, aldri en åpen kunde-API. Gjør skillet mellom runtime append-only og autorisert rettighetsprosess tydelig.

Akseptkriterier
1. Dokumentutkast stemmer med implementerte funksjoner og faktisk valgte/ikke valgte leverandører.
2. Kunden kan få en strukturert eksport av egne data; ingen annen tenant følger med.
3. Dry-run viser DB-rader, privatfiler, AI-output og auth-forhold som berøres.
4. En bruker med medlemskap i to tenants slettes ikke globalt ved avslutning av bare én kunde; backup-policyen beskriver utsatt sletting og restore-sperrer.

Tester og verifisering
Integrasjon med to kunder og delt bruker: eksportgrenser, korrekt tenant-sletteplan, manglende vedlikeholdstilgang og feil tenant-ID. Prøv sletting kun i testmiljø og bevis at andre kundens data bevares. Gjennomgå dokumentene mot en faktisk datakartlegging; ekstern faglig vurdering står som gjenstående hvis den ikke foreligger.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 28: Første faglig gjennomgåtte risikodataversjon

**Avhengighet:** 27. **Anslått aktiv tid:** 2–4 per avgrenset gjennomgang timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 28: Første faglig gjennomgåtte risikodataversjon.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Erstatt demo med en liten dokumentert produksjonsdataversjon innenfor avklart pilotdekning.

Berørte filer/moduler
risk-data/production/, docs/decisions/risk-sources.md, docs/decisions/risk-method-v0.md, tests/fixtures/risk-data-approved/
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Avgrens første kilderunde til land/bransjer de planlagte pilotkundene faktisk trenger; f.eks. maks fem land og tre bransje-/produktkategorier denne kvelden. Sjekk faktisk kilde, utgave, rett til kommersiell bruk, transformasjon og begrensninger. Claude kan strukturere og validere dokumenterte data, men kan ikke tildele seg faglig godkjenning eller finne på risikoverdier/reviewernavn. Importer godkjent versjon bare når menneskelig fagreview og lisensavklaring foreligger. Ellers behold ukjent og lever en presis mangelliste. Repeter som nye små dataversjoner ved større dekningsbehov; ikke behandle hele verdens mapping som én kveld.

Akseptkriterier
1. Hver aktiv datapost har etterprøvbar kilde, kodeverk/utgave, lisensstatus og ekte reviewspor.
2. Demo kan ikke brukes på pilotkundedata; manglende dekning vises ukjent.
3. Kilder/mapping og metode er skilt, versjonert og mulig å gjenskape.
4. Grensesnitt og rapport viser begrensninger uten å fremstille indikatoren som bevis mot en leverandør.

Tester og verifisering
Kjør risk-data:validate og import/aktivering i staging, sammenlign utvalgte poster manuelt mot primærkilden, test hull/utgått kilde og gjenskap en historisk vurdering. Ingen testforventninger oppdateres bare fordi ny motor gir et nytt tall. Hvis godkjenning eller kildebruk mangler, avslutt med eksplisitt blokkert aktivering fremfor falsk grønn status.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 29: Samlet pilotprøve og konkret lanseringsbeslutning

**Avhengighet:** 28. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 29: Samlet pilotprøve og konkret lanseringsbeslutning.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Verifiser hele MVP-en med syntetiske virksomheter og gi en konkret liste over hva som er klart til pilot.

Berørte filer/moduler
tests/e2e/mvp-flow.spec.ts, docs/PILOTSTATUS.md, docs/STATUS.md, eventuelle små feilrettinger i berørte moduler
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Kjør én sammenhengende prøve: invitert admin → org.nr./bekreftet grunnlag → periode/profil → CSV med feilretting → beriking → screening → begrunnet overstyring → eget funn/tiltak → mal/AI-utkast → redigering → intern review → PDF. Prøv to tenants og AI av, samt fake AI-feil. Samle bare nødvendige manglende regresjonstester; ikke dupliser alle enhetstester. Gjennomgå e-post, dataflyt, fagdekning, dokumentutkast, backup/restore og ekstern signering/publisering. Ikke legg til nye funksjoner eller skjul blokkeringer for å erklære ferdig.

Akseptkriterier
1. Alle gjennomgåtte akseptkriterier har faktisk test-/reviewevidens, ikke bare avkrysning.
2. Ingen høy risiko for tenantlekkasje, feil data i PDF eller oppdiktet rapportfakta gjenstår.
3. PILOTSTATUS skiller lokal test, faktisk ekstern integrasjon og uløste menneskelige/kontraktuelle avklaringer.
4. Hvis AI ikke er avklart men øvrig flyt er klar, kan manuell pilot foreslås med AI av. Reell kundetilgang krever avklart databehandling og faglig forsvarlig håndtering av dekning. Ingen automatisk produksjonsrelease.

Tester og verifisering
Kjør lint/typecheck, relevante unit/integration, full kritisk e2e og build i ren CI. Manuell PDF-kontroll og gjentatt sentral tenant-negativtest gjennom nedlasting. Dokumenter faktisk utført restore fra oppgave 26; ikke gjenta skyhandlinger uten grunn. Oppsummer konkrete feil/åpne avklaringer og foreslå neste minste retting ved blokkering.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

