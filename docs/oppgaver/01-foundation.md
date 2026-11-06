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

