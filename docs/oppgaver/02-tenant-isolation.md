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
