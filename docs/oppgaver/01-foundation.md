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
