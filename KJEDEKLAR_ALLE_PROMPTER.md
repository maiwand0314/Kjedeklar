# Kjedeklar – alle oppgaveprompter

Se START_HER.md for bruk og docs/OPPGAVER.md for oversikt. Kopier én promptblokk om gangen til Claude Code. Ikke kjør alle oppgaver som én samlet bestilling.


---

# Oppgave 01: Kjørbart prosjektskjelett

**Avhengighet:** Ingen. **Anslått aktiv tid:** 3–5 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 01: Kjørbart prosjektskjelett.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Opprett repoets minste kjørbare vertikale grunnmur: Convex-backend lokalt, innlogging, én beskyttet side, tenantstruktur og CI.

Berørte filer/moduler
package.json, pnpm-lock.yaml, src/app/, src/lib/, convex/schema.ts, convex/convex.config.ts, convex/auth.config.ts, convex/auth.ts, convex/http.ts, convex/lib/tenant.ts, convex/organizations/, convex/ops/, compose.yml, .env.example, eslint-konfigurasjon, .github/workflows/ci.yml, README.md, tests/
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Undersøk arbeidsmappen og eksisterende git før du endrer noe. Arbeid på branch feature/01-foundation. Sett opp Next.js App Router og Convex. Kjør Convex sin åpne backend og Mailpit i compose.yml med eksakt låste image-versjoner, og en separat lokal test-backend for integrasjonstester. Ingen Convex Cloud-konto trengs i denne oppgaven. Installer Better Auth via @convex-dev/better-auth med e-post/passord og åpen registrering slått av. Opprett bare tabellene organizations og memberships i appens skjema; Better Auth-tabellene ligger i komponenten. Lag tenant-byggeklossene tenantQuery/tenantMutation (og tenantAction hvis den trengs nå) i convex/lib/tenant.ts: verifisert bruker → aktivt medlemskap → rolle → ctx.tenant, med innpakket ctx.db via RLS-hjelperen i convex-helpers for organizations og memberships, samt getOwned. Legg ESLint-regel som forbyr rå query/mutation/action fra convex/_generated/server utenfor convex/lib/ og eksplisitt unntatte filer. Lag en intern seed-funksjon (convex/ops/) som oppretter to syntetiske organisasjoner og lokale testbrukere med passord fra utviklingsmiljøet; den nekter å kjøre mot annet enn lokal backend. Aldri hardkodet produksjonsbruker. Én norsk beskyttet side viser valgt organisasjons navn, med logout. Ingen leverandør-, risiko-, AI- eller rapportmoduler. Legg kommandoavtalen fra CLAUDE.md i package.json for eksisterende deler, og dokumenter i README hvordan admin key for lokal backend genereres. Velg og lås kompatible stabile versjoner; pakker under 1.0 låses eksakt. Dokumenter valgte versjoner i README eller docs/decisions/.

Akseptkriterier
1. Fra ren klon kan en utvikler følge README for installasjon, lokal Convex-backend, deploy av skjema/funksjoner, seed og oppstart.
2. Uinnlogget bruker kommer ikke inn; innlogget bruker ser bare en organisasjon vedkommende er medlem av. Manglende eller fremmed organisasjon gir samme nøytrale avslag.
3. Next.js og nettleser har aldri Convex admin/deploy key; bare offentlig Convex-URL og brukerens sesjon. Seed og bootstrap er interne funksjoner. Env-eksempler inneholder ingen ekte secrets.
4. CI installerer låst avhengighetssett, starter tom lokal Convex-backend, deployer skjema og funksjoner, seeder syntetiske data og kjører lint, typecheck, tester og build. Ingen kundedata eller produksjonssecrets.

Tester og verifisering
Integrasjonstest mot lokal Convex-backend med to ekte innloggede testbrukere: bruker A kan lese org A og kan ikke lese org B gjennom samme offentlige funksjon. convex-test for tenant-byggeklossene (manglende sesjon, manglende medlemskap, inaktivt medlemskap, fremmed organizationId). Playwright-smoke: lokal login → beskyttet side → logout. Testene må være reelt kjørbare i CI, ikke bare konfigurasjonsfiler. Kjør alle grunnsjekkene. Dette er en lokal grunnmur, ikke ferdig produksjonsautentisering.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```


---

# Oppgave 02: Bevis tenant-isolasjonen

**Avhengighet:** 01. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 02: Bevis tenant-isolasjonen.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Herd grunnmuren og bevis at tenants ikke kan lese, endre eller koble hverandres data.

Berørte filer/moduler
convex/lib/tenant.ts, convex/lib/rls.ts, convex/organizations/, eslint-konfigurasjon, tests/convex/tenancy.test.ts, tests/integration/tenancy.test.ts, docs/decisions/tenant-boundary.md
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Gjennomgå samtlige offentlige Convex-funksjoner, HTTP-ruter og Next.js-innganger. Default-deny skal være eksplisitt: RLS-hjelperens regler avviser lesing og skriving for tabeller uten eksplisitt regel, og ingen offentlig funksjon med kundedata er laget uten tenant-byggeklossene. Kontroller at ESLint-regelen mot rå query/mutation/action faktisk feiler på et brudd (lag en negativ lint-test eller fixture). Lag gjenbrukbar testhjelper for to kunder med ekte innloggede brukere mot lokal backend. Avgrens Better Auth-komponenten: appens kode leser bare autentisert bruker via komponentens API, og medlemskap kan ikke opprettes av vanlige offentlige funksjoner. Bruk organizations og memberships som ekte testobjekter; ikke legg inn en dummy produksjonstabell. Lag en sjekkliste/testhelper for getOwned-referanser når nye tabeller bygges. Dokumenter hvorfor valgt organisasjon i cookie/URL/argument ikke er autorisasjon, og hva Convex-modellen ikke beskytter mot (deploy key, interne funksjoner, dashboard).

Akseptkriterier
1. Forsøk på fremmed organisasjon i URL, argument og cookie gir samme avslag uten å røpe data eller om ressursen finnes.
2. Ingen offentlig funksjon eller HTTP-rute gir tilgang til kundedata uten verifisert medlemskap; interne funksjoner (seed, bootstrap) kan ikke kalles fra klient eller Next.js uten admin key.
3. Tenantkonteksten lekker ikke mellom samtidige kall, kall fra ulike brukere i samme nettleser/klient, eller etter at et medlemskap er deaktivert.
4. Klientkode kan ikke lese Better Auth-tabeller direkte eller tildele seg selv medlemskap eller rolle.

Tester og verifisering
Negative integrasjonstester mot lokal backend for lese/opprette/endre/slette der operasjonen finnes; manglende sesjon, fremmed organizationId, deaktivert medlemskap, samtidige kall fra to brukere og forsøk på å kalle interne funksjoner med vanlig klient. convex-test for RLS-hjelperens regler og getOwned. Sett fremtidige referansemisbrukstilfeller i testhelperen, ikke tomme grønne tester.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```


---

# Oppgave 03: Invitasjon, verifisering og kontogjenoppretting

**Avhengighet:** 02. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 03: Invitasjon, verifisering og kontogjenoppretting.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gjør pilotens kontolivssyklus brukbar uten åpen selvregistrering.

Berørte filer/moduler
convex/auth.ts, convex/auth.config.ts, convex/http.ts, src/lib/auth-client.ts, convex/email/, convex/organizations/, convex/ops/, src/modules/organizations/components/, convex/schema.ts, tests/integration/auth*, tests/e2e/auth*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Implementer kontrollert opprettelse av workspace/første admin via intern Convex-funksjon kjørt av operatør (`npx convex run ops/...`) og invitasjon. Bare en admin i aktuell tenant kan invitere flere administratorer. Bruk Better Auths støttede mekanismer via `@convex-dev/better-auth` for emailverifisering, passordreset og sesjoner. Invitasjoner er engangs, utløper, lagres sikkert (bare tokenHash) og krever riktig verifisert e-post; aksept oppretter medlemskap i én mutasjon. Sett opp Mailpit lokalt og et SMTP-interface med Nodemailer i en Convex Node-action; ingen produksjonsleverandør aktiveres her. Legg ratebegrensning på innlogging/reset med Better Auths innebygde mekanisme eller `@convex-dev/rate-limiter` (sjekk installert dokumentasjon for hva som lagres i Convex og virker på tvers av restart); unngå account enumeration. Bruk sikre cookies og frameworkets origin/CSRF-mekanismer. Org.nr. er ingen eierskapsverifisering.

Akseptkriterier
1. Invite → verifisering → velg passord → login fungerer i Mailpit.
2. Feil e-post, utløpt eller brukt invitasjon gir ingen Membership.
3. Reset flyt virker, gammel lenke er ubrukelig og relevante sesjoner kan tilbakekalles.
4. Vanlig brukerinput kan ikke sette adminrolle eller velge fremmed tenant; dev-seed/provisionering er interne funksjoner som ikke kan kalles fra klient og ikke utilsiktet kjøre mot produksjon.

Tester og verifisering
Integrasjon: gjenbruk/utløp/feil mottaker, to samtidige akseptforsøk, ugyldig origin og rategrense. E2E: aksept og passordreset via lokal e-post. Kontroller at logg ikke inneholder token eller passord.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 04: Norsk appskall og navigasjon

**Avhengighet:** 03. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 04: Norsk appskall og navigasjon.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Bygg et rolig profesjonelt, norsk grensesnitt med tydelig valgt virksomhet og senere rapportperiode.

Berørte filer/moduler
src/app/(app)/, src/components/ui/, src/modules/organizations/components/, src/lib/ (Convex-provider), convex/organizations/ (egne medlemskap), tests/e2e/navigation*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag responsiv sidebar/header og sider for Oversikt, Virksomheten, Leverandører, Risikovurderinger, Funn og tiltak, Redegjørelse og Innstillinger. Ubygde deler har ærlige tomtilstander, ingen fiktive kundetall. Vis organisasjon og trygg bytting bare mellom egne medlemskap. Etabler typografi, spacing, tabell-/skjemaprimitiver, lys/mørk modus og loading/error/empty-states. Bruk lokal font. Unngå å bygge et generelt designsystem utover dette.

Akseptkriterier
1. Norsk bokmål i all synlig tekst og feilmeldinger.
2. Navigasjonen fungerer på mobil og desktop; tastaturfokus og skjemalabels er synlige.
3. Organisasjonsbytte rydder tidligere viste kundedata og aktive Convex-abonnementer for forrige organisasjon; ingen flash med forrige kunde.
4. Ingen eksterne font-/analyticskall og ingen demoinnhold som ser ekte ut.

Tester og verifisering
Playwright: naviger med tastatur, vis mobilbredde, bytt organisasjon og test loading/avslag. Enkel tilgjengelighetssjekk av sentrale skjema/navigation; visuell manuell kontroll i begge tema. Ikke skriv snapshot av hele DOM.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 05: Transaksjonell revisjonslogg

**Avhengighet:** 04. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 05: Transaksjonell revisjonslogg.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Etabler en gjenbrukbar revisjonslogg før forretningsfunksjonene får mutasjoner.

Berørte filer/moduler
convex/schema.ts, convex/lib/audit.ts, convex/audit/, convex/organizations/, src/modules/audit/components/, tests/convex/audit*, tests/integration/audit*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag `auditEvents`, eksplisitt safe-diff og en audithjelper i `convex/lib/audit.ts` som tar mutasjonskonteksten fra `tenantMutation` eller en intern mutasjon, slik at audit alltid skrives i samme mutasjon som endringen. Koble den til endring av et reelt organisasjonsfelt og medlemskap/invitasjonshendelser uten token. Legg visning i Innstillinger med filtrering/paginering via `tenantQuery` og indeks som starter med `organizationId`. Tid settes på serveren (`Date.now()` i mutasjonen). Ingen offentlig eller intern funksjon oppdaterer eller sletter `auditEvents`, og RLS-hjelperen nekter endring av tabellen fra tenantfunksjoner. Dokumenter ærlig at deploy/admin key og Convex-dashboardet kan omgå dette, og beskriv en separat kontrollert vedlikeholds-/sletteprosess, ikke en kundeknapp for å endre historikk.

Akseptkriterier
1. Endring og audit er atomiske; feil i audit gir ingen endring.
2. Aktør, tenant, objektreferanse, hendelse, tidspunkt og safe diff lagres.
3. Fremmed kunde kan ikke se audit, og ingen appfunksjon kan omskrive den.
4. Passord, tokens og fritekst med unødvendige personopplysninger inngår ikke i diff.

Tester og verifisering
convex-test og integrasjon mot lokal backend: kastet feil i samme mutasjon etter audit-skriving ruller tilbake både domeneendring og audit; forsøk på å endre eller slette `auditEvents` via RLS-hjelperen avvises, og ingen eksportert funksjon gir slik mulighet; to tenants isoleres; tillatt diff inneholder bare avtalte felter. Manuell gjennomgang av en logget endring.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 06: Brreg-oppslag for egen virksomhet

**Avhengighet:** 05. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 06: Brreg-oppslag for egen virksomhet.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Hent nødvendige virksomhetsopplysninger på org.nr. og la kunden bekrefte dem.

Berørte filer/moduler
convex/integrations/brreg/, convex/organizations/, convex/schema.ts, src/modules/organizations/components/, tests/fixtures/brreg/, tests/unit/brreg*, tests/integration/organization*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Implementer adapter til dokumentert Enhetsregister-endepunkt som kalles fra en Convex-action (ikke fra query/mutasjon eller nettleser), med org.nr.-validering, timeout, begrenset retry og Zod-validering av svaret for valgte felt. Hent bare navn, org.nr., organisasjonsform, adresse, bransjekode og relevant status. Lag bekreftelsessteg og minimal `registrySnapshots`-dokument med kildetid; bekreftet lagring, snapshot og audit skrives i én tenantmutasjon. Organisasjonsnummer kan ikke brukes til å ta over eller slå sammen workspace. Ikke hent personroller eller forsøk å utlede årsverk/salgsinntekt fra antallAnsatte.

Akseptkriterier
1. Gyldig oppslag vises før kunden lagrer; kilde og hentetid er synlige.
2. 404, ugyldig org.nr., timeout, manglende bransje og API-endring gir forståelige feil/datamangler.
3. Brukerens tidligere bekreftede verdier overskrives ikke stille.
4. Endring og audit lagres atomisk; orgbytte gir ikke tilgang til en annen tenant.

Tester og verifisering
Adaptertester med realistiske syntetiske kontraktfixtures, 404/429/timeout/manglende felt. Integrasjon: bekreftet lagring og audit, uautorisert endring av fremmed org avvises. Live-oppslag er valgfri manuell kontroll, ikke en ustabil CI-avhengighet.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 07: Veiledende vurdering av lovens virkeområde

**Avhengighet:** 06. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 07: Veiledende vurdering av lovens virkeområde.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gi en forklarbar, veiledende pliktvurdering med synlig usikkerhet og versjonerte regler.

Berørte filer/moduler
src/domain/applicability/ (rene regler), convex/organizations/ (lagring av applicabilityAssessments), convex/schema.ts, src/modules/organizations/components/, docs/decisions/applicability-rules.md, tests/unit/applicability*, tests/integration/applicability*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Les gjeldende §§2–3 og dokumenter sannhetstabell før implementasjon. Be om salgsinntekt, balansesum og gjennomsnittlige årsverk for to år, tidligere status, konsern/allmenn interesse og norsk/utenlandsk tilknytning. For ordinære norske tilfeller med avklart historikk: sannsynlig omfattet/ikke omfattet. Konsern, særlige virkeområder, overgangstilfeller med ukjent historikk eller ufullstendig input gir manuell avklaring. Ikke lag en omfattende juridisk ekspertmotor. Reglene er ren TypeScript i `src/domain/applicability/` uten Convex/Next. Vis input, terskler, regelversjon og begrunnelse; la kunden bekrefte grunnlaget.

Akseptkriterier
1. Nøyaktig terskel behandles etter lovens ordlyd; antallAnsatte fra Brreg brukes ikke som årsverk.
2. Toårsregelen inngår i testmatrisen; ukjent historikk gir ikke skråsikkert nei.
3. Alle resultater er veiledende og lagres som ny historikk med kundens bekreftelse.
4. Et sannsynlig ikke-omfattet foretak kan fortsatt bruke verktøyet frivillig; ingen automatisk utestenging.

Tester og verifisering
Tabellstyrte tester for 0/1/2/3 overskredne terskler, lik terskel, ett/to sammenhengende år, ny overgang og ukjent historikk, konsern/allmenn interesse/utenlandsk virksomhet. Testmatrisen må bygge på lest kilde; ved uløst tolkning skal utfallet være manuell avklaring. Integrasjon for tenant og audit.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 08: Rapportperiode og virksomhetsprofil

**Avhengighet:** 07. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 08: Rapportperiode og virksomhetsprofil.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Opprett årets dokumentasjonsgrunnlag for egen virksomhet, rutiner og ansvar.

Berørte filer/moduler
convex/schema.ts, convex/organizations/ (reportingPeriods, businessProfileRevisions), src/modules/organizations/components/, tests/convex/profile*, tests/integration/profile*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag `reportingPeriods` med eksplisitte datoer (`YYYY-MM-DD`-strenger) og publiseringsfrist, samt versjonert `businessProfileRevisions`. Skjema for organisering, drift/produkter, geografisk virksomhet, ansvar, retningslinjer, rutiner, interessentdialog og eventuell gjenopprettingsprosess. Skill ikke etablert/ukjent fra utfylt. Ikke påstå at kunden har en policy bare fordi feltet finnes. Kalenderår foreslås, avvikende perioder tillates. Ingen automatisk årshjul eller e-postvarsler.

Akseptkriterier
1. Kunden kan opprette og velge periode med start/slutt og eksplisitt frist.
2. Profilendringer lagres som historikk med audit og bekreftet status.
3. Usvarte spørsmål forblir synlige hull.
4. Valgt periode følger navigasjon og kan ikke referere til en annen tenant.

Tester og verifisering
Enhet: datoer, ugyldig intervall, avvikende regnskapsår. Integrasjon: ny profilversjon bevarer gammel, fremmed periode avvises av `getOwned`, audit ved endring. E2E-smoke av skjema og lagringsfeil.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 09: Leverandørregister med manuell registrering

**Avhengighet:** 08. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 09: Leverandørregister med manuell registrering.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag den minste nyttige leverandørlisten og detaljsiden før CSV bygges.

Berørte filer/moduler
convex/schema.ts, convex/suppliers/, src/domain/ (norsk beløpsparsing), src/modules/suppliers/components/, tests/unit/, tests/convex/suppliers*, tests/integration/suppliers*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Implementer `suppliers` og `supplierPeriods`, manuell opprettelse/redigering/arkivering og paginert søk med Convex-paginering over indeks som starter med `organizationId`. Felter: navn, stabil ID/org.nr. hvis kjent, registreringsland, kodeverk+bransjekode, kjøpsbeskrivelse/kategori, kjente produksjonsland og ukjent oppstrøms, årets innkjøpsbeløp i NOK (`spendOre` som `v.int64()`). Ukjent er lovlig der datagrunnlaget mangler. Ikke bygg risiko ennå. Dedup av org.nr. innen tenant med indeksoppslag (`by_org_orgnumber`) i samme mutasjon; navnelikhet er forslag, ikke automatisk sammenslåing. Optimistisk låsing med `rowVersion` ved redigering.

Akseptkriterier
1. Leverandørprofil er adskilt fra årets innkjøpsdata.
2. Beløp lagres eksakt i øre og vises norsk; ukjent beløp er forskjellig fra null.
3. Norsk registrering gjør ikke produksjonslandet kjent.
4. Arkivering bevarer historikk; alle endringer får audit.

Tester og verifisering
Integrasjon: samme org.nr. tillatt i ulike tenants, avvist dobbelt innen tenant; fremmed periode-/supplier-referanse avvises av `getOwned`; utdatert `rowVersion` gir konflikt fremfor datatap; audit. Enhetstest av norsk desimalparsing og store beløp.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 10: CSV-opplasting og forhåndsvisning

**Avhengighet:** 09. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 10: CSV-opplasting og forhåndsvisning.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
La brukeren laste opp og forstå en CSV før den påvirker leverandørregisteret.

Berørte filer/moduler
src/domain/import/ (ren parser og normalisering), convex/suppliers/import/ (tenantAction for servervalidering), src/modules/suppliers/components/import/, tests/fixtures/csv/, tests/unit/csv*, tests/convex/csv*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Bruk et etablert CSV-bibliotek, ikke split(','). Støtt UTF-8/BOM, komma/semikolon, siterte felter og norske beløpsformater. Mapping av kolonner for navn, org.nr./ekstern ID, land og beløp; valgfrie bransje-/kjøpsfelter. 2 MiB/2 000 rader. Vis kildekolonne, normalisert verdi, radfeil, dubletter og foreslått matching. Ingen endring av leverandørdata i denne oppgaven. Den rene parseren i `src/domain/import/` kjøres også på server: filen sendes som bytes til en `tenantAction` som håndhever 2 MiB / 2 000 rader og parser i minne. Råfil lagres aldri, verken i tabeller, Convex file storage eller logg. Legg en syntetisk CSV-mal i repoet.

Akseptkriterier
1. Kolonnemapping og feil kan gjennomgås før import.
2. Ukjent land, ugyldig org.nr., tvetydig beløp og negative beløp blir synlige avklaringer.
3. Filer over grense avvises tidlig; filinnhold renderes som tekst.
4. Råfil lagres ikke i Convex (tabeller eller file storage) eller i logg.

Tester og verifisering
Fixtures for BOM, separatorer, escaped quotes, linjeskift, tomt felt, liknende navn, eksakt beløp, ugyldig encoding og fil-/radgrense. Test HTML/script-lignende navn og regnearkformler som ubetrodd tekst. Manuell preview med feilfil.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 11: Bekreftet, idempotent CSV-import

**Avhengighet:** 10. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 11: Bekreftet, idempotent CSV-import.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lagre bare bekreftede importrader og hindre dubletter eller delvis skjult import.

Berørte filer/moduler
convex/schema.ts, convex/suppliers/import/, src/domain/import/, src/modules/suppliers/components/import/, tests/convex/import*, tests/integration/import*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Opprett `importBatches`/`importRows` fra servervalidert preview (tenantAction fra oppgave 10; råfil lagres aldri), med tenant, periode, hash, mappingversjon og utløp. Bind commit til dette grunnlaget. La bruker eksplisitt velge skip eller oppdater kjente leverandører; årets beløp erstattes med bekreftet aggregering, ikke summeres ved retry. Uklar navnematch må avklares. Commit skjer i Convex-mutasjoner innenfor Convex sine transaksjonsgrenser (sjekk installert dokumentasjon). Får ikke MVP-grensen plass i én mutasjon, lagres radene i batcher bundet til batchdokumentet med status og idempotens, slik at en avbrutt commit kan fullføres eller vises som ufullstendig, aldri delvis skjult. Validerte feilrader må rettes eller eksplisitt utelates før commit. Audit per batch med relevante endringsreferanser; dokumenter nødvendig detaljnivå uten full råfil.

Akseptkriterier
1. Dobbelklikk, retry og identisk fil for samme mapping/periode gir ikke flere leverandører eller dobbelt beløp.
2. Stale/utløpt preview eller endret leverandør etter preview gir konflikt og ny bekreftelse.
3. Resultat viser opprettet/oppdatert/utelatt og valgte feilrader.
4. Fremmed batch eller `targetSupplierId` kan ikke importeres (`getOwned`).

Tester og verifisering
Integrasjon: to samtidige commit, feil midt i en batch (mutasjonen rulles tilbake og batchstatus viser ufullstendig), gjentatt fil, endret mapping, matchkonflikt, fremmed tenant og auditrollback. E2E: preview → velg håndtering → commit → kontroller totalsum og liste.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 12: Varige bakgrunnsjobber

**Avhengighet:** 11. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 12: Varige bakgrunnsjobber.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag en liten robust jobbmekanisme for Brreg-batch, AI og PDF med Convex scheduler og `@convex-dev/workpool`.

Berørte filer/moduler
convex/jobs/, convex/convex.config.ts (workpool-komponent), convex/schema.ts, tests/convex/jobs*, tests/integration/jobs*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Implementer `jobs`-tabell (organizationId, type, inputRef, idempotencyKey, status, attempts, maxAttempts, runAfter, errorCode) og planlegg arbeid via `@convex-dev/workpool`. Ikke bygg generelt automasjonssystem, egen kø eller egen workerprosess; PDF-workeren kommer i oppgave 24. En `tenantMutation` oppretter jobben idempotent på (organizationId, type, idempotencyKey) med indeksoppslag i samme mutasjon og planlegger en intern handler. Handler velges fra en allowlist per type, og input valideres med validator/Zod. Handleren tar tenant fra den lagrede jobben, ikke fra ubetrodd payload, og kontrollerer inputRef med `getOwned`. Begrensede forsøk med backoff (workpool sine retry-innstillinger eller egen runAfter; sjekk installert dokumentasjon) og terminal feilstatus etter maks forsøk. Eksterne kall og langkjørende arbeid skjer i actions, ikke i mutasjoner. Resultater skrives via intern mutasjon som kontrollerer tenant og jobbstatus på nytt og er idempotente, siden actions ikke er exactly-once. Status leses bare via `tenantQuery`. Bruk kontrollert testhandler.

Akseptkriterier
1. Dobbel innsending gir én jobb, og samme jobb kjøres ikke dobbelt eller skriver resultat to ganger.
2. Feilet/avbrutt action retries til maks forsøk og får terminal feilstatus.
3. En jobb kan ikke skrive til feil tenant eller velge egen vilkårlig handler.
4. Interne jobbfunksjoner kan ikke kalles fra klient; status kan leses bare av rett kunde.

Tester og verifisering
convex-test med fake timers: dobbel innsending, feil/retry med backoff, idempotent resultat, fremmed objektreferanse, ukjent handler og terminal feil. Integrasjon mot lokal backend: status isoleres mellom tenants, og interne funksjoner kan ikke kalles fra klient. Bruk fake timers/korte testgrenser fremfor lange sleeps. Bekreft at Next.js ikke bruker deploy/admin key.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 13: Brreg-beriking av leverandører

**Avhengighet:** 12. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 13: Brreg-beriking av leverandører.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Berik norske leverandører kontrollert etter import uten å blokkere webrequesten.

Berørte filer/moduler
convex/suppliers/ (beriking), convex/integrations/brreg/, convex/jobs/handlers/, src/modules/suppliers/components/, tests/convex/enrichment*, tests/integration/enrichment*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag batchjobber (jobs og workpool fra oppgave 12) for org.nr.-oppslag i Convex-actions med timeout, Zod-validering av svar, begrenset samtidighet og adapteren fra oppgave 06. Lagre minimal `registrySnapshots` via intern mutasjon som kontrollerer tenant, foreslå/oppdater avtalte registerfelter og vis status sist hentet/feilet/ikke relevant. Brukerrettede/overstyrte felt skal ikke overskrives uten bekreftelse. Skill registreringsstatus fra faglig menneskerettighetsrisiko. Eksterne leverandører uten norsk org.nr. må fungere manuelt.

Akseptkriterier
1. Import kan brukes mens beriking kjører; status per leverandør er synlig.
2. 429/timeout gir begrenset retry og delvis feilstatus uten tap av import.
3. Bransjekode har kodeverkversjon og hentetid; manglende kode blir ikke lav risiko.
4. Oppdatering gir audit og markerer relevant vurderingsgrunnlag endret når risikomodulen finnes.

Tester og verifisering
Integrasjon med fake Brreg: blanding av norske/utenlandske/manglende oppslag, avbrutt action og duplikatjobber, brukerredigering mens jobben kjører, cross-tenant payload og audit. Kontroller at nytteløs retries ikke fortsetter uendelig.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 14: Versjonerte risikodata og faglig metodekontrakt

**Avhengighet:** 13. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 14: Versjonerte risikodata og faglig metodekontrakt.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Opprett dataformat og godkjenningsflyt før risikomotoren implementeres.

Berørte filer/moduler
risk-data/, src/domain/risk/datasets/ (Zod-skjema og validator), convex/schema.ts, convex/risk/ (interne import-/aktiveringsfunksjoner og lesefunksjoner), scripts/risk-data-*.ts, docs/decisions/risk-method-v0.md, tests/unit/risk-data*, tests/integration/risk-data*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Definer manifests og Zod-skjema for land-/bransjedata og selvstendig metodeversjon. Felter for kildeutgave, URL, lisensavklaring, ISO-land, SN/NACE-versjon, transformationsregel, review-dato, forfallsdato, reviewer, miljø og checksum. Tabellene er globale og har ikke `organizationId`. Skriv validator/import-/aktiveringskommando: skriving og aktivering skjer bare via interne Convex-funksjoner kjørt av operatør, og `pnpm risk-data:import` bruker admin/deploy key lokalt hos operatør, aldri i appen; aldri en kunde-API. Tenantfunksjoner leser bare aktiverte, godkjente versjoner gjennom egne lesefunksjoner. Opprett bare tydelig syntetiske demo-fixtures i testmiljø. Dokumenter ordinal max/ukjent-regel, prioriteringsrekkefølge og forskjell mellom kontrollsignaler og risikofaktorer. Ikke fyll ekte land med gjetninger. Eksisterende produksjonsversjon kan ikke endres på stedet.

Akseptkriterier
1. Ny dataversjon kan importeres og aktiveres uten kodeendring; gammel forblir lesbar.
2. Produksjonsaktivering av demo, uavklart lisens, manglende godkjenning eller ugyldig mapping avvises.
3. Kilder kan være utdaterte; dette blir en eksplisitt datakvalitetstilstand.
4. Metodekontrakten sier tydelig at dette er Kjedeklars screening, med krav om faglig gjennomgang før kundebruk.

Tester og verifisering
Validering: duplisert land, tvetydig bransjemapping, manglende kildereferanse, uventet kodeverk, endret checksum, utgått review, demo i prod. Integrasjon mot lokal backend: kunde kan ikke endre felles data (ingen offentlig skrivefunksjon, interne funksjoner kan ikke kalles fra klient), tenantfunksjoner ser ikke uaktiverte versjoner, og ny versjon endrer ikke gammel.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 15: Deterministisk risikomotor

**Avhengighet:** 14. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 15: Deterministisk risikomotor.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Beregn forklarbar leverandørscreening og lagre reproduserbare vurderinger.

Berørte filer/moduler
src/domain/risk/ (ren motor), convex/risk/ (lagring av riskAssessments), convex/schema.ts, tests/unit/risk-engine*, tests/convex/risk*, tests/integration/risk*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Implementer ren funksjon i `src/domain/risk/` uten Convex- eller Next.js-avhengigheter, av normalisert input, godkjente dataversjoner og metodeversjon. Returner screeningLevel, dataQuality, missingFields, triggeredRules med input/kildereferanser og kontrollsignaler. Kjent høy faktor gir høy; ellers vesentlig datamangel gir ukjent; ellers høyeste kjente nivå. Registreringsland må ikke erstatte ukjent produksjonsland. Beløp skal ikke være argument til beregning av nivå. Lagre uforanderlig inputSnapshot/inputHash og versjonsreferanser i nye `riskAssessments`-dokumenter via `convex/risk/`. Bruk bulkhandling med fast grense for pilotens 2 000 leverandører; mål om lagringen må deles i flere mutasjoner eller jobber innenfor Convex sine grenser (sjekk installert dokumentasjon) før du legger til mer kølogikk.

Akseptkriterier
1. Samme input og versjoner gir identisk resultat uten AI eller nettverkskall.
2. En høy bransje/produkt-/landfaktor kan ikke nøytraliseres av en lav faktor.
3. Ukjent/utgått kilde er synlig, og en kjent høy faktor bevares ved andre mangler.
4. Ny leverandørinput/metode gir ny vurdering og merker gammel som utdatert; historikk bevares.

Tester og verifisering
Tabelltester av lav/moderat/høy/ukjent, ingen faktorer, høy+ukjent, utgått kilde, uklart produksjonsland, kodeversjonsmismatch og administrative signaler. Egenskapstest: endring av innkjøpsbeløp påvirker aldri nivå. Integrasjon mot lokal backend for snapshots, tenantvern (`getOwned`) og audit. Bruk syntetiske forventninger, ikke oppdiktede landfakta.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 16: Risikoliste, forklaring og manuell overstyring

**Avhengighet:** 15. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 16: Risikoliste, forklaring og manuell overstyring.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gjør risikoresultatene nyttige og la kunden dokumentere egne beslutninger.

Berørte filer/moduler
src/modules/risk/components/, convex/risk/reviews.ts, convex/schema.ts, tests/convex/risk-review*, tests/integration/risk-review*, tests/e2e/risk*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag filterbar/paginert liste og detaljvisning med faktorer, kildeutgaver, datamangler og opprinnelig nivå. Egen synlig oppfølgingsgruppe for ukjent; innen samme nivå sorteres beløp fallende, nullbeløp eksplisitt. Bekreftelse/overstyring lagres som nytt assessmentReviews-dokument med begrunnelse, bruker og tidspunkt i en tenantmutasjon med audit. Vis screening og effektiv kundevurdering samtidig. Nye input gjør review utdatert og krever ny bekreftelse. Bruk optimistisk låsing (rowVersion/forventet gjeldende review sjekket i mutasjonen) og ingen stille siste-skriver-vinner.

Akseptkriterier
1. Brukeren kan forstå hvorfor en konkret regel slo ut og hvilke data som mangler.
2. Overstyring uten meningsfull begrunnelse avvises; originalberegningen bevares.
3. Liste og tellinger er tenant-/periodeavgrenset og skiller screening fra review.
4. Et overstyrt lavt nivå skjuler ikke opprinnelig høy screening eller ukjent oppstrøms.

Tester og verifisering
Integrasjon: manglende begrunnelse, samtidige review, input endret siden visning, fremmed assessment (getOwned) og auditrollback. E2E: forklaring → begrunnet overstyring → historikk. Sorteringstest beviser at stort beløp aldri flytter lav foran høy i en risikoprioritert liste.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 17: Manuelle funn, tiltak og oppfølging

**Avhengighet:** 16. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 17: Manuelle funn, tiltak og oppfølging.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gi redegjørelsen reelt grunnlag utover leverandørscore uten å bygge leverandørskjema.

Berørte filer/moduler
src/modules/diligence/components/, convex/diligence/, convex/schema.ts, tests/convex/diligence*, tests/integration/diligence*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag enkle skjema og tenantmutasjoner for findings og measures, knyttet til perioden og valgfritt leverandør/vurdering. Støtt egen virksomhet, leverandørkjede og forretningsforbindelser; faktiske/potensielle konsekvenser, berørte rettigheter, alvorlighet, sannsynlighet og kort evidensnotat. Tiltak har ansvar, frist, planlagt/gjennomført status, forventet og observert resultat samt oppfølging. Ikke konverter screening til bekreftet brudd. Ingen dokumentopplasting eller sensitive personnavn. Registrer uttrykkelig dersom kunden ikke har identifisert funn eller ikke har vurdert dette ennå.

Akseptkriterier
1. Egen virksomhet kan ha funn uten leverandør.
2. Planlagte tiltak omtales ikke som utført; forventede resultater omtales ikke som observert.
3. Et funn kan ha flere tiltak; alle koblinger kontrolleres med getOwned, og ansvarlig må ha aktivt medlemskap i samme organisasjon.
4. Endringer logges og tidligere rapportgrunnlag kan fortsatt rekonstrueres via snapshot.

Tester og verifisering
Integrasjon: egen virksomhet uten supplier, fremmed finding/supplier/user som ansvarlig, ugyldige statusskifter, auditrollback og samtidige endringer. E2E: lag ett potensielt funn og ett planlagt tiltak med forventet resultat.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 18: AI-grensesnitt med personvern- og kostnadsgrenser

**Avhengighet:** 17. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 18: AI-grensesnitt med personvern- og kostnadsgrenser.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag et sikkert valgfritt AI-lag som er deaktivert til faktisk leverandøroppsett er avklart.

Berørte filer/moduler
convex/ai/, convex/schema.ts, convex/jobs/handlers/ai.ts, docs/decisions/ai-provider.md, tests/unit/ai*, tests/convex/ai*, tests/integration/ai*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Definer adapter for strukturert input/output i Convex Node-actions («use node»), fake-provider, aiRuns, timeouts, begrenset retry, outputvalidering og tenantbudsjett. Legg konfigurasjon for foreslått Azure OpenAI-implementasjon; reell sending krever eksplisitt godkjent providerkonfigurasjon med EU/EØS-behandling og avtalt dataminimering. Ikke velg en global modell eller geografisk fallback ved manglende kapasitet. En konfigurasjonsbool er ikke dokumentasjon: registrer hvem som har vurdert region, behandling/logging/support og kildegrunnlag. AI-kall bestilles av en tenantmutasjon som jobb i jobs-tabellen og kjøres via scheduler/workpool fra oppgave 12; actionen får bare minimert input, og resultatet skrives via intern mutasjon som kontrollerer tenant på nytt. Modellen har aldri databasetilgang. Full flyt virker med AI av. AI har ingen verktøy/databasetilgang/URL-henting.

Akseptkriterier
1. AI er av som default; feil eller uavklart leverandør gir tydelig manuell vei.
2. Kun godkjente nødvendige felter sendes; prompts og tokens dumpes ikke i logger.
3. Maks token/kostnadsgrense per tenant og beskyttelse mot dobbel bestilling virker.
4. Modell, promptversjon, inputrefs/hash og usage lagres; output må passere skjema.

Tester og verifisering
Fake-provider: timeout, 429, ugyldig JSON, ekstraverktøyinstruksjoner i fritekst, kostnadsgrense og idempotent retry. Integrasjon: feil tenant i jobbreferanse og AI avslått når godkjenning mangler. Ekte API-test bare med syntetiske data; dokumenter hvis tilgang/avtale ikke finnes.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 19: AI-forslag til klassifisering og begrunnelser

**Avhengighet:** 18. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 19: AI-forslag til klassifisering og begrunnelser.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Hjelp brukeren med rotete kjøpsdata uten å gi AI beslutningsmyndighet.

Berørte filer/moduler
src/modules/suppliers/components/classification/, src/modules/risk/components/explanations/, convex/ai/prompts/, convex/ai/suggestions.ts, tests/unit/ai-suggestions*, tests/convex/ai-suggestions*, tests/integration/ai-suggestions*, tests/e2e/ai-suggestions*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag eksplisitte knapper for foreslå kjøpskategori og forklar gjeldende regler på norsk. Kategoriforslag er begrenset til godkjente kategorier med inputreferanser og kan svare ukjent. Forslag lages i Node-action via jobb fra oppgave 18. Aksept/avvisning lagres i aiSuggestions. Akseptert kategori endrer input gjennom vanlig tenantmutasjon med audit, aldri direkte fra en action, og krever ny regelberegning; AI setter aldri screeningnivå. Begrunnelsen bygger bare på triggeredRules og missingFields, og en deterministisk tekst finnes som fallback. Ikke send leverandørkontakter eller hele kundelisten.

Akseptkriterier
1. Ingenting endres før kunden aksepterer.
2. Forklaring stemmer med regel-ID, nivå og kilder; uunderbygde utsagn avvises/faller tilbake til mal.
3. Akseptert kategori gir sporbar inputendring, historikk og stale vurdering.
4. Avvisning og AI-feil bevarer eksisterende arbeid og nivå.

Tester og verifisering
Fixtures med prompt injection i leverandørnavn/kjøpstekst, ukjent kategori, forsøk på å endre score og begrunnelse som motsier faktagrunnlag. Integrasjon: aksept gjennom riktig tenant og audit; E2E med fake, ikke ekte kostbare kall.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 20: Kontroll av rapportgrunnlag og hull

**Avhengighet:** 19. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 20: Kontroll av rapportgrunnlag og hull.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Samle et sammenhengende grunnlag og vis hva kunden må avklare før gjennomgang.

Berørte filer/moduler
src/domain/statements/readiness/, convex/statements/sourceSnapshot.ts, src/modules/statements/components/readiness/, tests/unit/statement-readiness*, tests/convex/statement-source*, tests/integration/statement-source*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag source snapshot i én Convex-query/-mutasjon for valgt periode, slik at alt leses konsistent: virksomhetsprofil, leverandørtall, gjeldende vurderinger/review, dataversjoner, mangler, funn, tiltak og resultater. Bygg readiness-sjekkliste mot innholdsområdene i §5 som ren logikk i src/domain/statements/. Et tomt funnfelt betyr ikke ingen funn; krev kundens uttrykkelige beskrivelse av hva som er undersøkt/avdekket. Skill datadekning fra juridisk etterlevelse. Vurderinger/overstyringer som er utdaterte gir synlig avklaring. Ingen AI- eller PDF-generering her.

Akseptkriterier
1. Tall og tekstreferanser kommer fra én konsistent lesing i samme Convex-funksjon og samme tenant/periode.
2. Manglende profil, uavklart risiko og fravær av tiltak/resultat vises med lenke til riktig skjema.
3. Utkast kan lages med hull, men kan ikke merkes gjennomgått uten avklaringskontroll.
4. Kunden ser at intern sjekkliste ikke er juridisk godkjenning.

Tester og verifisering
Readiness-matrise for tom kunde, kun score, egen virksomhet uten leverandører, utdatert vurdering, uttalt ingen identifiserte funn og manglende tiltak. Integrasjon: snapshot teller korrekt ved samtidige endringer og inneholder ingen fremmede kundedata.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 21: Malbasert redegjørelse uten AI

**Avhengighet:** 20. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 21: Malbasert redegjørelse uten AI.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Generer et nyttig strukturert utkast som fungerer uten ekstern modell.

Berørte filer/moduler
src/domain/statements/templates/, convex/statements/, convex/schema.ts, src/modules/statements/components/, tests/unit/statement-template*, tests/convex/statement*, tests/integration/statement*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag norsk versjonert mal for organisering/virksomhet/rutiner, metode og omfang, avdekkede faktiske konsekvenser/vesentlig risiko, tiltak/forventede eller observerte resultater og kjente begrensninger. Bruk source snapshot og eksplisitte plassholdere for mangler. Ikke fyll inn policyer, tilsynsbesøk eller positive garantier som ikke finnes. Lag statements og uforanderlige statementRevisions (sourceSnapshot lagret i dokumentet) med templateversjon, input-/contenthash og kildekoblinger. Intern detaljvisning kan vise kilde-ID-er; offentlig tekst skal ikke røpe kontaktpersoner eller rå leverandørliste.

Akseptkriterier
1. Generering virker helt uten AI-nøkkel.
2. Det fremgår hva som faktisk er dokumentert og hva som mangler.
3. Rapporten har periode, virksomhet og merket status Utkast – ikke signert.
4. Ny generering oppretter ny revisjon og overskriver ikke tidligere tekst.

Tester og verifisering
Innholdstester for komplett syntetisk grunnlag og ufullstendig grunnlag. Kontroller planlagt kontra gjennomført og forventet kontra observert. Test escaping og at ingen automatisk liste over kontaktpersoner/raw supplierdata følger med. Integrasjon: revisionsnummer, snapshots, tenantvern (getOwned/RLS-hjelper) og audit.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 22: AI-assistert redegjørelsesutkast

**Avhengighet:** 21. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 22: AI-assistert redegjørelsesutkast.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gi valgfri skrivehjelp basert utelukkende på bekreftet strukturert grunnlag.

Berørte filer/moduler
src/modules/statements/components/ai-draft/, convex/ai/prompts/statement.ts, convex/jobs/handlers/statement.ts, convex/statements/aiDraft.ts, tests/unit/statement-ai*, tests/convex/statement-ai*, tests/integration/statement-ai*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Kjør som jobb (jobs-tabell + scheduler/workpool fra oppgave 12) i Convex Node-action («use node») via AI-adapteren fra oppgave 18; modellen har aldri databasetilgang. Send minimert source snapshot med referanser til tillatte fakta, ikke rå kundeeksport. Be om strukturerte seksjoner og kilde-ID-er. Valider output, referanser og beskyttede faktafelt; bruk deterministiske blokker for kritiske tall/status som AI ikke kan endre. Uunderbygget eller feilaktig forslag avvises eller faller tilbake til mal; ikke stol på at en LLM kan kvalitetssikre seg selv. Godkjent output lagres som ny utkastversjon via intern mutasjon som kontrollerer tenant og grunnlag på nytt, med audit; kunden må gjennomgå den. Ved jobbfeil beholdes siste tekst.

Akseptkriterier
1. Ingen utsagn om utførte tiltak eller resultater oppstår uten tilsvarende data.
2. Ukjente referanser, endrede kritiske tall eller status gir avvisning.
3. AI- og malutkast har lik dokumentstruktur og samme krav til brukerreview.
4. Modell/prompt/grunnlag er sporbar internt; ingen automatisk godkjenning eller publisering.

Tester og verifisering
Fake-fixtures: oppdiktede tiltak, ukjente source-ID-er, endret leverandørtall, fritekstinjeksjon og timeout. Kontroller at avvist output ikke blir current revision. Integrasjon: tenantbudsjett, riktig snapshot, duplikatjobb og audit.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 23: Redigering, versjoner og intern gjennomgang

**Avhengighet:** 22. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 23: Redigering, versjoner og intern gjennomgang.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
La kunden ferdigstille ordlyden uten å miste historikk eller forveksle review med signering.

Berørte filer/moduler
src/modules/statements/components/editor/, convex/statements/revisions.ts, convex/statements/reviews.ts, convex/schema.ts, tests/convex/statement-revisions*, tests/integration/statement-revisions*, tests/e2e/statement-editor*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Bygg enkel seksjonseditor med tekst/avgrenset Markdown og sikker rendering, ikke et stort dokumentbehandlingssystem. Lagring oppretter ny immutable revisjon. Vis versjonsliste og sammenligning av relevante endringer. Optimistisk låsing (rowVersion på statements sjekket i mutasjonen) beskytter samtidige redigeringer. Intern gjennomgang gjelder nøyaktig revisjon og kildehash. Endret tekst eller grunnlag markerer gjennomgang utdatert. Påminn om ekstern signering/publisering; ikke bygg styrekontoer eller signaturfelter som ser verifiserte ut.

Akseptkriterier
1. Kunden kan redigere, lagre ny versjon og åpne tidligere versjon.
2. Stale save gir konflikt med mulighet til å beholde egen tekst.
3. Review krever readiness-avklaring og eksplisitt brukerbekreftelse.
4. Status er Utkast eller Gjennomgått internt, aldri Signert/Publisert.

Tester og verifisering
Integrasjon: samtidige save, review av feil revisjon, endret grunnlag etter review og fremmed revisjon. E2E: rediger → ny versjon → gjennomgå → endre → review blir utdatert. Test XSS i Markdown/lenker.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 24: PDF-eksport av eksakt revisjon

**Avhengighet:** 23. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 24: PDF-eksport av eksakt revisjon.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Eksporter en lesbar norsk PDF som kan sendes til ekstern signering.

Berørte filer/moduler
worker/, package.json (`pnpm worker`), convex/http.ts, convex/statements/pdf.ts, convex/schema.ts, src/app/api/statements/, src/modules/statements/components/pdf/, tests/convex/pdf*, tests/integration/pdf*, tests/fixtures/pdf/
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Convex-actions kan ikke kjøre Chromium. Opprett `pnpm worker` og en egen Node-worker i worker/ som rendrer lokal HTML/CSS med Playwright/Chromium, A4, lokalt fontsett, sidetall, periode, virksomhet og korrekt merking. Utkast er alltid merket Utkast – ikke signert; gjennomgått revisjon kan eksporteres Til ekstern signering – ikke signert. Ingen faktisk underskrift eller publisering. Render uten eksterne nettverkskall og uten brukerdefinert HTML. En tenantmutasjon oppretter PDF-jobben i jobs-tabellen fra oppgave 12. Workeren autentiserer med PDF_WORKER_SECRET mot smale HTTP-endepunkter i convex/http.ts (hent tildelt jobb og renderingsgrunnlag, lever resultat), har aldri deploy/admin key og får bare data for jobben den er tildelt; utløpt tildeling gjør jobben tilgjengelig igjen. Lag pdfExports med sha256, status og storageId i Convex file storage. Gi ingen storage.getUrl-lenker til klient; nedlasting går via Next.js route handler eller HTTP-action som sjekker medlemskap og rapporttilknytning for eksakt revisjon og svarer med Cache-Control: no-store. Utdatert kildegrunnlag må vises, ikke skjules av gammel review.

Akseptkriterier
1. PDF samsvarer med valgte revisjon, snapshot og merking.
2. Æ/ø/å, lange avsnitt, sideskift og tomme felt vises pent; ingen avkuttet tekst.
3. Eksport er idempotent per revisjon/merke og kan ikke lastes ned av fremmed tenant.
4. Lagring i Convex file storage har størrelsesgrense og feil gir ryddbar status uten offentlig URL.

Tester og verifisering
Integrasjon: tekstuttrekk fra PDF for kritiske felter/status, fremmed export-ID, path traversal i nedlastingsruten, avvist ekstern URL, manglende/feil PDF_WORKER_SECRET, worker som ber om grunnlag for en jobb den ikke er tildelt, og utløpt tildeling. Kjør manuell/renderbasert visuell QA av kort og lang syntetisk rapport; legg ikke kunderapporter i testartefakter. Test workerrestart uten dobbelt resultat.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 25: Reproduserbar EU-staging og avsenderoppsett

**Avhengighet:** 24. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 25: Reproduserbar EU-staging og avsenderoppsett.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gjør løsningen klar til kontrollert staging i EU/EØS og test teknisk e-postlevering.

Berørte filer/moduler
Dockerfile (Next.js og PDF-worker), compose.staging.yml, reverse proxy-konfigurasjon hvis Next.js/worker selvhostes, .github/workflows/ (Convex-deploy til staging), scripts/deploy-check.ts, docs/DRIFT.md, docs/decisions/hosting.md, docs/decisions/data-processors.md
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Staging bruker en Convex Cloud-deployment i aws-eu-west-1; regionen kan ikke endres etterpå, så kontroller den før første deploy. Deploy key finnes bare i CI og hos navngitt operatør, aldri i Next.js, nettleser eller PDF-worker. Ingen `convex dev` mot staging eller produksjon. Velg og dokumenter EU/EØS-leverandør for hosting av Next.js og PDF-worker. Lag Docker-bygg for web og PDF-worker med Chromium-avhengigheter, ikke-root prosess, health/readiness, graceful shutdown og secrets utenfor image. Bruk TLS, med reverse proxy der Next.js/worker selvhostes. Dokumenter og sett opp staging bare hvis nødvendig konto/server/domene er gitt; ellers lever kjørbar lokal staging mot lokal Convex-backend og presise konfigurasjonstrinn uten å påstå deploy. Gi brukeren konkrete steg for å opprette Convex-konto/team, prosjekt med staging-deployment i EU-region og deploy key for CI; sjekk installert dokumentasjon/Convex-dokumentasjonen for gjeldende fremgangsmåte. Dokumenter SMTP-kandidat, SPF/DKIM/DMARC, reply-to og bounceflyt. Ingen kundeinnhold i e-post. Reell DNS-/SMTP-test bare med gitt tilgang og en eksplisitt testadresse; ingen bulkutsending.

Akseptkriterier
1. Containerne kan bygges og kjøres lokalt med stagingkonfigurasjon og syntetiske data.
2. Ingen dev-seed, deploy key utenfor CI/operatør, `convex dev` mot staging, produksjonssecret eller global AI-fallback i staging.
3. DRIFT angir versjoner, oppgraderinger, rekkefølge for Convex-deploy og Next.js-/worker-release, healthkontroll og tilbakerulling ved kompatible skjemaendringer.
4. Faktisk leverandør/region, tilgjengelige avtaler og uløste e-post-/EU-forhold dokumenteres ærlig.

Tester og verifisering
Bygg og smoke-test containerne, kontroller at Next.js og worker ikke har deploy/admin key, og at manglende secrets gir feil. Verifiser DNS og testlevering med tilgang; uten tilgang marker dette ikke verifisert. Test ugyldig health/dependency og at logs er redigert. Ingen produksjonsdeploy eller DNS-endring basert bare på denne generelle prompten.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 26: Backup, restore og driftskontroll

**Avhengighet:** 25. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 26: Backup, restore og driftskontroll.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Bevis at både Convex-data og PDF-filer i Convex file storage kan gjenopprettes i valgt EU/EØS-oppsett.

Berørte filer/moduler
scripts/backup*, scripts/restore*, docs/DRIFT.md, docs/RESTORE-PROVE.md, infra/ hvis det finnes
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Backupenheten er Convex-eksport (`npx convex export`, inkludert filer; sjekk installert dokumentasjon for flagg) lagret kryptert i EU/EØS med begrenset tilgang, retention og separat kopi. Sjekk Convex-dokumentasjonen for innebygd backupfunksjon (tilgjengelighet, frekvens, lagringssted, region) og dokumenter den; ikke anta at den finnes eller dekker kravet. Dokumenter nøkkelhåndtering og mål for datatap/gjenoppretting, f.eks. pilotmål 24t/4t som må måles, ikke en garanti. Gjenopprett en syntetisk installasjon til ny, tom deployment (`npx convex import`); kontroller skjema, tenantfunksjoner, RLS-hjelper og pdfExports.storageId-referanser. Sett enkel varselrutine/healthkontroll uten kundeinnhold. Restore-script skal nekte å importere til produksjon uten et separat eksplisitt vedlikeholdssteg. Dokumenter hvem som har deploy key til eksport/import.

Akseptkriterier
1. Restore-prøve bevarer to tenants, vurderinger, audit, rapportversjon og nedlastbar PDF.
2. Backuper og nøkler havner ikke i git/CI; valgt lagringssted og tilgang er dokumentert.
3. Feilet backup kan oppdages og siste vellykkede tidspunkt finnes.
4. Sletting/restore tar hensyn til at gamle backuper ikke skal gjeninnføre slettede aktive brukere/kundedata uten oppfølging.

Tester og verifisering
Kjør faktisk Convex-eksport → ny tom deployment → import med syntetiske data. Kjør tenanttester og PDF-hashkontroll etterpå. Test manglende nøkkel/fil og backupfeil. Logg observert tid og datatap i RESTORE-PROVE; ikke marker ikke-kjørt skylagring som verifisert.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 27: Personvern, kundeeksport og kontrollert sletting

**Avhengighet:** 26. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 27: Personvern, kundeeksport og kontrollert sletting.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag konkrete kundedokumentutkast og en begrenset operasjonell datarettighetsprosess.

Berørte filer/moduler
docs/PERSONVERN-UTKAST.md, docs/DATABEHANDLERAVTALE-UTKAST.md, docs/VILKAR-UTKAST.md, docs/decisions/retention.md, convex/ops/customerExport.ts, convex/ops/customerDelete.ts, scripts/customer-export.ts, scripts/customer-delete.ts
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Beskriv faktiske data, formål, behandlingsroller, underleverandører, lokasjoner, supporttilgang, lagringstid, innsyn/sletting, hendelser og backup. Marker ukjente kontrakt-/selskapsopplysninger som avklaringer; ikke finn på DPA-er eller påstå juridisk godkjenning. Vilkår beskriver beslutningsstøtte, kundens gjennomgang/signering/publisering og faktiske tjenestegrenser. Lag operatørkommando for tenantavgrenset eksport og en dry-run-sletteplan som interne Convex-funksjoner kjørt med operatørlegitimasjon (`npx convex run ops/...`). Sletteplanen dekker alle tenanttabeller, filer i Convex file storage (pdfExports.storageId), jobs og aiRuns/aiSuggestions. Selve sletting testes i isolert syntetisk miljø, krever eksplisitt tenant-ID/vedlikeholdsautorisasjon og avklart retention, aldri en åpen kunde-API eller tenantfunksjon. Slettingen auditlogges; avklar i retention-beslutningen hvor slettehendelsen bevares når tenantens data fjernes. Gjør skillet mellom at tenantfunksjoner aldri endrer eller sletter audit og autorisert rettighetsprosess tydelig.

Akseptkriterier
1. Dokumentutkast stemmer med implementerte funksjoner og faktisk valgte/ikke valgte leverandører.
2. Kunden kan få en strukturert eksport av egne data; ingen annen tenant følger med.
3. Dry-run viser dokumenter per tabell, filer i file storage, jobs, AI-output og auth-forhold som berøres.
4. En bruker med medlemskap i to tenants slettes ikke globalt ved avslutning av bare én kunde; backup-policyen beskriver utsatt sletting og restore-sperrer.

Tester og verifisering
Integrasjon med to kunder og delt bruker: eksportgrenser, korrekt tenant-sletteplan, manglende vedlikeholdstilgang og feil tenant-ID. Prøv sletting kun i testmiljø (lokal Convex-backend) og bevis at andre kundens data bevares. Gjennomgå dokumentene mot en faktisk datakartlegging; ekstern faglig vurdering står som gjenstående hvis den ikke foreligger.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 28: Første faglig gjennomgåtte risikodataversjon

**Avhengighet:** 27. **Anslått aktiv tid:** 2–4 per avgrenset gjennomgang timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 28: Første faglig gjennomgåtte risikodataversjon.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Erstatt demo med en liten dokumentert produksjonsdataversjon innenfor avklart pilotdekning.

Berørte filer/moduler
risk-data/production/, docs/decisions/risk-sources.md, docs/decisions/risk-method-v0.md, tests/fixtures/risk-data-approved/
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Avgrens første kilderunde til land/bransjer de planlagte pilotkundene faktisk trenger; f.eks. maks fem land og tre bransje-/produktkategorier denne kvelden. Sjekk faktisk kilde, utgave, rett til kommersiell bruk, transformasjon og begrensninger. Claude kan strukturere og validere dokumenterte data, men kan ikke tildele seg faglig godkjenning eller finne på risikoverdier/reviewernavn. Importer godkjent versjon bare når menneskelig fagreview og lisensavklaring foreligger. Ellers behold ukjent og lever en presis mangelliste. Repeter som nye små dataversjoner ved større dekningsbehov; ikke behandle hele verdens mapping som én kveld.

Akseptkriterier
1. Hver aktiv datapost har etterprøvbar kilde, kodeverk/utgave, lisensstatus og ekte reviewspor.
2. Demo kan ikke brukes på pilotkundedata; manglende dekning vises ukjent.
3. Kilder/mapping og metode er skilt, versjonert og mulig å gjenskape.
4. Grensesnitt og rapport viser begrensninger uten å fremstille indikatoren som bevis mot en leverandør.

Tester og verifisering
Kjør risk-data:validate og import/aktivering i staging via interne funksjoner kjørt av operatør, sammenlign utvalgte poster manuelt mot primærkilden, test hull/utgått kilde og gjenskap en historisk vurdering. Ingen testforventninger oppdateres bare fordi ny motor gir et nytt tall. Hvis godkjenning eller kildebruk mangler, avslutt med eksplisitt blokkert aktivering fremfor falsk grønn status.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```



---

# Oppgave 29: Samlet pilotprøve og konkret lanseringsbeslutning

**Avhengighet:** 28. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 29: Samlet pilotprøve og konkret lanseringsbeslutning.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Verifiser hele MVP-en med syntetiske virksomheter og gi en konkret liste over hva som er klart til pilot.

Berørte filer/moduler
tests/e2e/mvp-flow.spec.ts, docs/PILOTSTATUS.md, docs/STATUS.md, eventuelle små feilrettinger i berørte moduler
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Kjør én sammenhengende prøve: invitert admin → org.nr./bekreftet grunnlag → periode/profil → CSV med feilretting → beriking → screening → begrunnet overstyring → eget funn/tiltak → mal/AI-utkast → redigering → intern review → PDF. Prøv to tenants og AI av, samt fake AI-feil. Samle bare nødvendige manglende regresjonstester; ikke dupliser alle enhetstester. Gjennomgå e-post, dataflyt, fagdekning, dokumentutkast, backup/restore og ekstern signering/publisering, samt status for Convex-avklaringene i docs/decisions/0001-convex-eu.md (DPA, underleverandører og overføringsgrunnlag, backup/logg/support, dashboard- og deploy key-tilgang). Ikke legg til nye funksjoner eller skjul blokkeringer for å erklære ferdig.

Akseptkriterier
1. Alle gjennomgåtte akseptkriterier har faktisk test-/reviewevidens, ikke bare avkrysning.
2. Ingen høy risiko for tenantlekkasje, feil data i PDF eller oppdiktet rapportfakta gjenstår.
3. PILOTSTATUS skiller lokal test, faktisk ekstern integrasjon og uløste menneskelige/kontraktuelle avklaringer.
4. Hvis AI ikke er avklart men øvrig flyt er klar, kan manuell pilot foreslås med AI av. Reell kundetilgang krever avklart databehandling, lukkede Convex-avklaringer i beslutning 0001 og faglig forsvarlig håndtering av dekning. Ingen automatisk produksjonsrelease.

Tester og verifisering
Kjør lint/typecheck, relevante unit/integration, full kritisk e2e og build i ren CI. Manuell PDF-kontroll og gjentatt sentral tenant-negativtest gjennom nedlasting. Dokumenter faktisk utført restore fra oppgave 26; ikke gjenta skyhandlinger uten grunn. Oppsummer konkrete feil/åpne avklaringer og foreslå neste minste retting ved blokkering.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

