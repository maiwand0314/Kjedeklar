# Status

Startpakke opprettet 6. november 2026. Dokumentasjonen ble samme dag skrevet om fra PostgreSQL/Drizzle til Convex Cloud i EU (se docs/decisions/0001-convex-eu.md).

| Oppgave | Status | Verifisering | Begrensning |
|---|---|---|---|
| 01 | Implementert, verifisert lokalt og i CI (PR #1, review-endringer rettet) | Lint, typecheck, 35 enhets-/convex-test-tester, 9 integrasjonstester mot lokal test-backend, 3 Playwright-tester og build er grønne fra ren start. CI var grønn på første versjon av PR-en | Kun lokal backend. Ingen Convex Cloud-deployment |
| 02 | Implementert, verifisert lokalt og i CI, merget (PR #2) | Lokalt med Docker på 363fff4 (review 7.11): lint, typecheck, 69 enhets-/convex-test-tester, 21 integrasjonstester (to kjøringer), 4 e2e-tester (to kjøringer) og build. `convex/_generated` stemmer med ekte codegen. CI grønn på 363fff4 og på main etter merge | Innloggingsbegrensningen er felles for alle brukere (ingen klient-IP); løses i oppgave 03 |
| 03 | Implementert og verifisert lokalt (branch `feature/03-auth-lifecycle`) | Fra ren start: lint, typecheck, 117 enhets-/convex-test-tester, 50 integrasjonstester mot lokal backend og Mailpit (fire kjøringer, tre på rad grønne etter siste rettelse), 6 e2e-tester (seks kjøringer) og build | Bare Mailpit, ingen produksjonsleverandør. Klient-IP i produksjon krever at reverse proxy overskriver headeren (oppgave 25) |
| 04 | Implementert, verifisert lokalt, review-merknader rettet (PR #4) | Lokalt med Docker etter review: lint, typecheck, 120 enhets-/convex-test-tester (tre kjøringer), 50 integrasjonstester, 11 e2e-tester (to kjøringer) og build. Visuell kontroll av skjermbilder i lys og mørk modus | Lys/mørk følger systemvalget; ingen egen bryter. Ingen klientside Convex-provider ennå (sidene rendres på serveren) |
| 05 | Implementert og verifisert lokalt (branch `feature/05-audit`) | Lint, typecheck, 146 enhets-/convex-test-tester, 59 integrasjonstester (to kjøringer), 12 e2e-tester (to kjøringer) og build | Append-only bare i appen; deploy key og dashboard kan omgå (beslutning 0004). Lagringstid/sletting avklares i oppgave 27 |
| 06 | Implementert og verifisert lokalt (branch `feature/06-brreg-onboarding`) | Lint, typecheck, 196 enhets-/convex-test-tester, 71 integrasjonstester (to kjøringer), 12 e2e-tester og build. Live-kontroll mot Enhetsregisteret OK (manuell, ikke i CI) | SN-versjon oppgis ikke av Brreg. Ingen e2e av selve oppslaget (krever nettverk) |
| 07 | Implementert og verifisert lokalt (branch `feature/07-applicability`) | Lokalt med Docker: lint, typecheck, 265 enhets-/convex-test-tester, 78 integrasjonstester, 13 e2e-tester (to kjøringer) og build | Veiledende; konsern, utenlandske virksomheter og ukjent historikk gir manuell avklaring. Lovteksten lest 9.11.2026; må leses på nytt ved lovendring |
| 08 | Implementert, verifisert lokalt og i CI, review-merknader rettet (PR #10) | Lokalt med Docker: lint, typecheck, 330 enhets-/convex-test-tester, 92 integrasjonstester, 14 e2e-tester og build. Etter review: lint, typecheck, enhetstester og e2e på nytt (ingen endring i Convex) | Perioder kan ikke endres eller slettes. Innholdet i eldre profilversjoner kan ikke åpnes i appen. Ugyldig periode i adressen gir «Ikke funnet» med HTTP 200 (beslutning 0006) |
| 09 | Implementert og verifisert lokalt (branch `feature/09-suppliers`) | Lokalt med Docker: lint, typecheck, 417 enhets-/convex-test-tester, 112 integrasjonstester, 15 e2e-tester og build | Søk bare på starten av navnet. `externalKey` er ikke unik ennå. Ingen risiko, import eller Brreg-beriking (senere oppgaver) |
| 10 | Implementert, verifisert lokalt og i CI, merget (PR #12 og #13) | Lokalt med Docker: lint, typecheck, 538 enhets-/convex-test-tester, 120 integrasjonstester, 16 e2e-tester og build | Bare forhåndsvisning; ingenting importeres før oppgave 11. Bare UTF-8. `externalKey` er fortsatt ikke unik. To lokale e2e-kjøringer fikk tidsavbrudd av uavklart årsak (se under) |
| 11 | Implementert, verifisert lokalt og i CI, review-merknader rettet, merget (PR #14) | Lokalt med Docker: lint, typecheck, 601 enhets-/convex-test-tester, 145 integrasjonstester, 17 e2e-tester og build | Importen drives av nettleseren og fortsetter ikke av seg selv etter et avbrudd. Revisjonslogg per batch, ikke per leverandør. Feilrader kan ikke rettes i appen |
| 12 | Implementert og verifisert lokalt (branch `feature/12-jobs`) | Lokalt med Docker: lint, typecheck, 636 enhets-/convex-test-tester, 160 integrasjonstester, 17 e2e-tester og build | Bare en kontrollert testtype; ingen jobbtype for produksjon og ingen visning i grensesnittet ennå. Workpool er under 1.0 (låst 0.4.15) |
| 13 | Implementert og verifisert lokalt (branch `feature/13-brreg-enrichment`) | Lokalt med Docker: lint, typecheck, 676 enhets-/convex-test-tester, 175 integrasjonstester, 18 e2e-tester (med lokalt installert Chrome) og build | Registerverdier er forslag brukeren godtar; ingen automatisk utfylling. SN-versjon velges av bruker. Ikke kjørt mot ekte Enhetsregisteret. Risikomodulen finnes ikke, så ingenting merkes utdatert |
| 14 | Implementert og verifisert lokalt (branch `feature/14-risk-data`) | Lokalt med Docker: lint, typecheck, 741 enhets-/convex-test-tester, 187 integrasjonstester, 18 e2e-tester (med lokalt installert Chrome) og build | Ingen reelle risikodata og ingen fagreview: bare syntetiske demo-fixtures. Kommandoene er bare prøvd mot lokal backend, ikke Convex Cloud. Ingen motor (oppgave 15) |
| 15 | Implementert og verifisert lokalt (branch `feature/15-risk-engine`) | Lokalt med Docker: lint, typecheck, 797 enhets-/convex-test-tester, 197 integrasjonstester (196 i første fulle kjøring, én gjeldende test rettet og kjørt på nytt), 18 e2e-tester (med lokalt installert Chrome; én flaky test bestod ved ny kjøring) og build | Bare syntetiske demo-data; uten aktive produksjonsdata gir motoren synlige mangler og ukjent. Ingen grensesnitt. Bulkgrenser målt bare mot lokal backend |
| 16 | Implementert og verifisert lokalt (branch `feature/16-risk-review`) | Lokalt med Docker: lint, typecheck, 847 enhets-/convex-tester, 208 integrasjonstester, 19 e2e-tester (med lokalt installert Chrome) og build | Bare syntetiske demo-data. Listen leser opptil 2 000 leverandører per kall, målt bare mot lokal backend. Ingen funn/tiltak (oppgave 17). To flaky tester, se under |

Oppdater ved hver oppgave. Bruk «implementert», «verifisert» og «ekstern avklaring» presist. Et lokalt fake-resultat betyr ikke at en ekstern integrasjon er godkjent.

## Oppgave 01 – kjørbart prosjektskjelett

### Endret
- Next.js 16.4.5 (App Router, TypeScript strict, Tailwind) og Convex 1.49.0. Versjonene er låst eksakt; se README.
- `compose.yml`: lokal Convex dev-backend (3210/3211), separat test-backend med tmpfs (3220/3221) og Mailpit. Images er låst til revisjon og digest, og telemetri er av.
- Better Auth 1.7.18 via `@convex-dev/better-auth` 0.13.0: e-post/passord, åpen registrering av, ratebegrensning med databaselagring, minimum 12 tegn i passord.
- Skjema: `organizations` og `memberships`. Better Auth-tabellene ligger i komponenten.
- `convex/lib/tenant.ts` inneholder:
  - `tenantQuery`, `tenantMutation` og `userQuery`, som går fra verifisert sesjon til aktivt medlemskap, aktiv organisasjon, rolle og `ctx.tenant`;
  - innpakket `ctx.db` med RLS-hjelperen (default-deny, medlemskap og organisasjoner kan ikke endres fra tenantfunksjoner);
  - `getOwned`.
- ESLint forbyr rå `query`/`mutation`/`action` i `convex/` utenfor `convex/lib/tenant.ts`.
- Interne funksjoner: `ops/organizations:ensureOrganizationWithMember` (bootstrap), `ops/seed:seedDev` og `ops/testing:createTenantFixture`. Seed og fixture nekter å kjøre uten riktig `KJEDEKLAR_ENV` og lokal `CONVEX_CLOUD_URL`.
- Next.js-sider: `/logg-inn`, `/` (organisasjonsvelger/omdirigering), `/o/[organizationId]` (norsk beskyttet side med organisasjonsnavn og utlogging) og `/api/auth/[...all]` (proxy til Convex).
- Alle svar får `Cache-Control: private, no-store`, og Cache Components er av. Ingen Google Fonts.
- `scripts/local-convex.mjs` genererer admin key til egne CLI-env-filer som Next.js ikke leser, og setter env-variablene på deploymenten.
- CI: `.github/workflows/ci.yml` med Actions låst til SHA. Den deployer til tom lokal backend, kontrollerer `convex/_generated`, seeder og kjører lint, typecheck, alle testnivåer og build.

### Kjørte kommandoer (6.11.2026, fra ren start: `docker compose down -v`, env-filer slettet)
```text
pnpm install --frozen-lockfile                          OK
docker compose up -d --wait convex convex-test mailpit  OK
pnpm convex:deploy:local                                OK (Convex functions ready)
pnpm seed:dev                                           OK (2 syntetiske org/brukere)
pnpm lint                                               OK
pnpm typecheck                                          OK
pnpm test:unit                                          35/35 bestått (etter review)
pnpm test:integration                                   9/9 bestått
pnpm test:e2e                                           3/3 bestått
pnpm build                                              OK
```
Ekstra kontroller:
- Mutasjonskontroll: når sjekken av aktivt medlemskap eller innpakningen av `ctx.db` ble fjernet midlertidig, feilet testene som forventet.
- Et bevisst brudd på ESLint-regelen ga feil.
- `curl` mot `/api/auth/sign-up/email` ga 400.

### Rettet etter review (PR #1)
- Bootstrap matchet organisasjon på navn. Nå oppretter `ops/organizations:createWorkspace` alltid en ny organisasjon, og `setMembership` krever eksplisitt `organizationId`. Seed er idempotent via brukerens medlemskap (indeks). Det er test på at samme navn gir to organisasjoner. Den ubegrensede `.collect()` er fjernet.
- `returns`-validatorer er lagt til på `current` og `listMine`.
- ESLint stopper også `queryGeneric`/`mutationGeneric`/`actionGeneric`/`httpActionGeneric` fra `convex/server`. Ny negativ lint-test (`tests/unit/lint-rules.test.ts`) feilet før rettelsen og passerer etter.
- Hemmeligheter settes via stdin (`convex env set NAME`), ikke som argument. Utlogging viser feilmelding hvis den feiler. Kommentaren om roller i `tenantQuery` er rettet.
- Funnet underveis: Convex CLI viser bare navn i `env list` når den kjøres av en AI-agent. Oppsettsskriptet trodde da at `BETTER_AUTH_SECRET` manglet, og byttet den ved hver deploy, noe som gjorde token-utstedelse ugyldig. Sjekken godtar nå begge formatene. Verifisert med to deploys og to seed-kjøringer på rad (2 organisasjoner) og to integrasjonskjøringer på rad.

### Manuell prøve
Login → beskyttet side → fremmed org («Ikke funnet») → utlogging er kjørt automatisk i Playwright. Ingen menneskelig prøve i nettleser er gjort ennå. Slik prøver du selv: følg «Kom i gang» i README og logg inn med passordet i `.env.convex-dev.local`.

### Ikke verifisert / begrensninger
- Convex Cloud (EU) er ikke satt opp. Det skjer i oppgave 25 og krever konto.
- `@convex-dev/better-auth` er under 1.0. Self-hosted Convex-image er en rullerende revisjon som er bevisst valgt og låst.
- Ratebegrensning er på, men ikke eksplisitt testet. Det hører til oppgave 03. Integrasjonstesten venter og prøver på nytt ved 429.
- Feilmeldinger fra backend til klient er redigert bort (`REDACT_LOGS_TO_CLIENT`). Kall til interne funksjoner fra klient gir derfor en generell «Server Error», ikke en egen kode.
- Revisjonslogg (oppgave 05) og invitasjon/reset (03) er ikke gjort. Isolasjonsherding er gjort i oppgave 02.

## Oppgave 02 – bevis tenant-isolasjonen

### Endret
- `convex/lib/rls.ts` (ny): RLS-reglene er flyttet ut av `tenant.ts`. Typen `ExhaustiveRules` krever eksplisitt `read`/`modify`/`insert` for hver tabell, og `defaultPolicy: "deny"` gjelder fortsatt i kjøretid.
- `convex/lib/tenant.ts`: organisasjonskandidaten tas imot som streng og normaliseres. Ugyldig format, id fra en annen tabell, slettet, fremmed og inaktiv organisasjon gir nå identisk `NOT_FOUND`. Tidligere ga ugyldig format en valideringsfeil. Roller er samlet i `READ_ROLES`/`WRITE_ROLES`, og `userQueryInput` er eksportert for test.
- `src/app/(app)/o/[organizationId]/page.tsx`: URL-verdien sendes som kandidat uten typecast.
- `eslint.config.mjs`:
  - Better Auth-komponenten (`components`) kan bare brukes i `convex/auth.ts`.
  - `convex/lib/**` kan pakke inn rå byggere, men ikke bruke komponenten.
  - `src/**` kan ikke importere `internal`/`components`, `_generated/server`, `convex/lib`, `convex/ops`, `convex/auth` eller `convex/http`.
- `docs/decisions/0002-tenant-boundary.md` (ny) beskriver:
  - tilgangskjeden og hvorfor URL/cookie/argument ikke er autorisasjon;
  - inventaret over innganger;
  - avgrensningen av Better Auth-komponenten;
  - hva Convex-modellen ikke beskytter mot;
  - unntak og sjekklister for nye tabeller og funksjoner.

### Tester
- `tests/convex/registry.test.ts` (ny):
  - Alle offentlige funksjoner og HTTP-ruter må stå i registeret `tests/helpers/public-functions.ts`, og offentlige funksjoner må ha returvalidator.
  - Tenantfunksjoner tar organisasjonskandidat som streng. Hver registrert funksjon testes automatisk for manglende sesjon, og identisk avslag for fremmed, inaktiv, ugyldig og annen tabell.
  - Hver tabell har regel for alle tre operasjoner. Kundetabeller har påkrevd `organizationId`, og indekser starter med den, med begrunnede unntak.
- `tests/convex/references.test.ts` og `tests/convex/tenant-tables.ts` (nye): en typekrevd sjekkliste per kundetabell. `getOwned` (eget, fremmed, slettet, ugyldig, annen tabell) og innpakket lesing og skriving (get, query, patch, replace, delete, insert) testes automatisk for hver registrert tabell, i dag `memberships`.
- `tests/helpers/convex-functions.ts` (ny): leser alle registrerte Convex-funksjoner fra modulene.
- `tests/helpers/local-backend.ts`: `setupTwoTenants()` gir to kunder med ekte innloggede brukere (cookie og token). I tillegg kommer `signIn`, `clientWithToken` og `errorOf`.
- `tests/integration/tenancy.test.ts`, utvidet mot lokal backend:
  - identisk avslag for fem kandidater;
  - manglende sesjon;
  - 24 samtidige, blandede kall fra to brukere;
  - bytte av bruker og utlogging i samme klient;
  - en probe med effektkontroll for hver intern funksjon, der testen krever probe for alle;
  - komponentens funksjoner kan ikke kalles fra klient;
  - admin- og organisasjonsendepunkter i Better Auth gir 404;
  - deaktivert medlemskap gir avslag ved neste kall med samme token og i et åpent live-abonnement.
- `tests/e2e/login.spec.ts`: fremmed, inaktiv, ugyldig og annen tabell i URL gir identisk 404-side med `no-store`. Organisasjon i fire typiske cookie-navn gir ingen tilgang.
- `tests/unit/lint-rules.test.ts`: negative tester for de nye lint-reglene.

### Kjørte kommandoer (6.11.2026, macOS uten Docker)
```text
pnpm install --frozen-lockfile    OK
pnpm lint                         OK
pnpm typecheck                    OK
pnpm test:unit                    69/69 bestått
pnpm build                        OK (med offentlige lokale NEXT_PUBLIC_*-verdier)
pnpm test:integration             IKKE KJØRT (Docker manglet da). Se lokal kjøring 7.11 under
pnpm test:e2e                     IKKE KJØRT LOKALT
```
CI på PR #2, første kjøring (commit abe0fe0):
```text
git diff --exit-code convex/_generated   OK (den håndskrevne endringen stemmer)
pnpm test:unit                           69/69 bestått
pnpm test:integration                    19/19 bestått mot lokal Convex-backend i Docker
pnpm test:e2e                            3/4. Den nye URL/cookie-testen feilet
```
E2E-feilen: etter innlogging ble siden stående på `/` lenger enn standardgrensen på 5 s, fordi Next.js i utviklermodus kompilerte `/` første gang. Testene logger nå inn via `/` med felles hjelper, og omdirigeringen får 20 s.

Andre kjøring (commit 658dc85): integrasjonstesten for samtidige kall feilet med `InvalidAuthHeader: Could not fetch JWKS … HTTP 500`. Funn og rettelse:
- Convex-backenden henter offentlige nøkler fra `/api/auth/convex/jwks` for å verifisere token. Better Auths ratebegrensning gjaldt også dette endepunktet.
- Forespørslene har ingen klient-IP, så alle havnet i én delt teller, lagret i én databaserad.
- Samtidige verifiseringer ga derfor skrivekonflikter (HTTP 500). Over 100 oppslag per 10 s ville gitt avslag, og hvem som helst kunne brukt opp telleren og blokkert innlogget bruk for alle.
- Rettelse: `customRules: { "/convex/jwks": false }` i `convex/auth.ts`. Endepunktet er offentlig, leser bare og har ingen brukerdata.
- Ny regresjonstest: 120 JWKS-oppslag i bolker på 30 gir bare 200.
- CI skriver nå ut logger fra de lokale Convex-backendene ved feil.

Lokal kjøring med Docker (7.11.2026, Docker-VM med 2 CPU-er):
```text
docker compose up -d --wait convex convex-test mailpit   OK
pnpm convex:deploy:local                                  OK
git diff --exit-code convex/_generated                    OK (ekte codegen = håndskrevet endring)
pnpm seed:dev                                             OK
pnpm test:integration                                     19/20. Samtidighetstesten feilet (se under)
```
Funn med backend-logger (`convex logs --jsonl`): JWKS-oppslagene ga nå 200, så rettelsen over virket. Det som feilet, var `organizations/queries:current`: 8 av 76 kall avbrøt med `Function execution timed out (maximum duration: 1s)` før de hadde lest et eneste dokument. Årsaken er kapasitet i testmiljøet:
- Backenden kjører med standardverdier mange V8-isolater parallelt.
- På 2 CPU-er overbookes de, og veggklokketiden for brukerkode passerer grensen på 1 s. Uten konkurranse tar kallet 0,1–0,2 s.
- Det skyldes ikke tung import: en bunt med bare `createClient` er 218 kB, mot 228 kB for hele query-bunten.

Rettelse i `compose.yml` for begge lokale backender: `APPLICATION_MAX_CONCURRENT_QUERIES/MUTATIONS/V8_ACTIONS = 4`. Overskytende kall venter da i kø. Tidsgrensen for funksjoner er ikke hevet, og testen sender fortsatt 24 samtidige kall.

Etter rettelsen:
```text
samtidighetstesten alene        5/5 kjøringer grønne (før: 1 av 3)
pnpm test:integration           20/20, to kjøringer på rad
```

E2E lokalt (Playwright-Chromium installert 7.11.2026):
- **Med `next dev` var den nye URL/cookie-testen ustabil** (2 av 3 kjøringer feilet). Navigeringen ble avbrutt (`net::ERR_ABORTED`), fordi utviklerserveren kompilerer ruter ved første besøk og laster siden på nytt.
  - Rettelse: e2e kjører nå mot produksjonsbygg (`next build && next start`) i `playwright.config.ts`. Den forlengede tidsgrensen for omdirigering (20 s) er fjernet igjen.
- **Med produksjonsbygg feilet fortsatt 1 av 5 kjøringer.** Etter innlogging ble brukeren sendt tilbake til `/logg-inn`. Backend-loggen viste `GET /api/auth/convex/token` med 429.
  - Next.js henter Convex-token for hver sidevisning. Endepunktet delte én ratebegrensningsteller for alle, fordi det ikke finnes noen klient-IP.
  - Telleren ga 429 selv ved om lag 20 oppslag per 10 s, og hvem som helst kunne fylle den og sende alle innloggede brukere ut.
  - Rettelse: `"/convex/token": false` i `customRules`. Endepunktet krever gyldig sesjonscookie, og innlogging er fortsatt begrenset.
  - Ny regresjonstest: 120 oppslag uten sesjon gir ingen 429, og en innlogget bruker får fortsatt token. Testen feilet uten rettelsen (21 av 120 fikk 429).

Sluttresultat lokalt (Docker, 7.11.2026):
```text
pnpm lint / pnpm typecheck      OK
pnpm test:unit                  69/69
pnpm test:integration           21/21, to kjøringer på rad
pnpm test:e2e                   4/4, seks kjøringer på rad (mot produksjonsbygg)
pnpm build                      OK
```
Mutasjonskontroll med convex-test: koden ble sabotert midlertidig på fem måter, og testene feilet hver gang:
- medlemskap lesbart på tvers;
- inaktivt medlemskap godtatt;
- `v.id` i stedet for streng;
- rå offentlig query, der også lint feilet;
- insert tillatt for medlemskap.

`convex codegen` krever backend. Derfor er `convex/_generated/api.d.ts` oppdatert for hånd med `lib/rls`. CI kontrollerer at filen stemmer med generert kode.

### Manuell prøve
Ingen menneskelig prøve i nettleser. Slik prøver du selv:
1. Logg inn som `anna.admin@nordlys.example`.
2. Åpne `/o/<id til Fjordlys>`, `/o/tull` og `/o/<din egen id>x`. Alle skal gi samme «Ikke funnet».
3. Sett en cookie `organizationId=<id til Fjordlys>` i devtools, og last `/` på nytt. Du skal fortsatt havne i Nordlys.

### Ikke verifisert / begrensninger
- Probe-testen for `ops/seed:seedDev` er svak: funksjonen har i tillegg miljøsperre, så den ville feilet på test-backenden selv om den var offentlig.
- Fra klient gir kall til interne funksjoner og komponentfunksjoner en generell feil (`REDACT_LOGS_TO_CLIENT`). Testene kontrollerer avslag og effekt, ikke feilteksten.
- Det finnes ingen offentlige mutasjoner ennå, så negative skrive- og slettetester mot backend venter til første kundetabell. Registeret og `tenant-tables.ts` kjører dem automatisk når den kommer.
- Isolasjonen er i applikasjonslaget. Deploy/admin key, interne funksjoner og dashboard kan omgå den (se beslutning 0002).
- Til oppgave 25: samtidighetsgrensen gjelder bare lokale backender. Convex Cloud har egne grenser; ytelse under last må vurderes der.
- **Til oppgave 03 (viktig før pilot):** Better Auth finner ikke klient-IP i Convex sine HTTP-actions og faller tilbake til én delt teller per sti. Innloggingsbegrensningen (3 per 10 s) er derfor felles for alle brukere, ikke per IP. Den databasebaserte telleren gir også feilaktige 429 under samtidige kall. JWKS og token er unntatt i oppgave 02. Klient-IP-oppsett (`advanced.ipAddress`, IP-videresending fra Next.js) og lagringsvalg for ratebegrensningen må løses i oppgave 03.

## Oppgave 03 – invitasjon, verifisering og kontogjenoppretting

### Endret
- **Invitasjoner:**
  - Tabellen `invitations` lagrer bare tokenhash.
  - Operatør-bootstrap `ops/workspaces:provision` lager ny organisasjon og invitasjon til første admin.
  - Admin inviterer og tilbakekaller fra organisasjonssiden.
  - Aksept skjer med ny konto (velg passord) eller som innlogget bruker med samme verifiserte e-post.
  - Engangs, utløper etter 7 dager, og samtidige forsøk gir én vinner.
- **Nye byggeklosser** med tokenet som tilgangsbevis: `invitationQuery`/`invitationMutation`/`invitationAction` og `verificationAction`, med egne RLS-regler (default-deny).
- **Better Auth:**
  - e-postverifisering (påkrevd);
  - passordreset med tilbakekalling av alle sesjoner;
  - hashede verifiseringstoken;
  - Convex-JWT med 5 minutters levetid;
  - ratebegrensning per klient-IP via Next.js-proxyen med `AUTH_PROXY_SECRET`. Forfalsket IP uten hemmelighet gir ingen egen bøtte.
- **Token aldri i server-URL-er:** Lenker bruker URL-fragment (`#token=`), og tokenet sendes i POST-body. Integrasjonstesten fant at Better Auths `/verify-email?token=` havnet i Convex sin tilgangslogg; det er løst med `account/actions:verifyEmail`.
- **E-post:** Nodemailer i Convex Node-action. Bare Mailpit er tillatt (`KJEDEKLAR_ENV` development/test). Lenker til planlagte e-postjobber er forseglet med AES-GCM.
- **Sider:** `/invitasjon`, `/glemt-passord`, `/tilbakestill-passord` og `/bekreft-epost`. «Glemt passord?» er lagt til på innlogging, og omdirigering etter innlogging går bare til hvitelistede interne stier.
- **Beslutning:** [0003](decisions/0003-kontolivssyklus.md). Beslutning 0002 har oppdatert inventar og indeksunntak.

### Kjørte kommandoer (7.11.2026, fra ren start: `docker compose down -v`, env-filer slettet)
```text
pnpm install --frozen-lockfile                 OK
docker compose up -d --wait convex convex-test mailpit   OK
pnpm convex:deploy:local / pnpm seed:dev       OK
pnpm lint / pnpm typecheck                     OK
pnpm test:unit                                 117/117
pnpm test:integration                          50/50 (1. kjøring). 2. kjøring rett etter: 49/50,
                                               kollisjon i tilfeldige IPv4-test-IP-er innen 60 s;
                                               rettet (IPv6 /64 per kall), deretter 50/50 tre ganger på rad
pnpm test:e2e                                  6/6, seks kjøringer
pnpm build                                     OK
```
Mutasjonskontroller:
- Fjernet sjekk av mottaker/verifisert e-post: testen feilet.
- Invitasjon ikke merket brukt: testen feilet.
- Convex godtok klient-IP uten hemmelighet: testen for forfalsket IP feilet.
- Loggtesten fant verifiseringstokenet i backendens logg før omleggingen til fragmenter.

### Manuell prøve
Invitasjon → e-post i Mailpit → velg passord → innlogging, og glemt passord → e-post → nytt passord → innlogging, er kjørt automatisk i Playwright. Ingen menneskelig prøve er gjort. Slik prøver du selv: `pnpm dev`, kjør `ops/workspaces:provision` (README) og åpne lenken fra http://localhost:8025.

### Ikke verifisert / begrensninger
- **Ingen ekte SMTP-leverandør** (oppgave 25). Ingen leveringslogg for e-post.
- **Klient-IP i produksjon** forutsetter at reverse proxy overskriver `x-forwarded-for` (eller headeren satt i `AUTH_CLIENT_IP_SOURCE_HEADER`). Lokalt kan klienten forfalske den mot Next.js; e2e bruker dette bevisst.
- **Ratebegrensning med databaselagring** er ikke lasttestet mot Convex Cloud.
- **Utlogging fra alle enheter** finnes bare via passordreset. Utløpte invitasjoner ryddes ikke automatisk.
- **Revisjonslogg** for invitasjoner og medlemskap kommer i oppgave 05.

## Oppgave 04 – norsk appskall og navigasjon

### Endret
- **Appskall** (`src/app/(app)/o/[organizationId]/layout.tsx`):
  - sidebar på desktop og «Meny» (`<details>`) på mobil;
  - header med valgt virksomhet og utlogging;
  - lenken «Hopp til innholdet».
  - Layouten sjekker innlogging og medlemskap i Convex (`current` og `listMine`), som før. Fremmed eller ukjent organisasjon gir 404.
- **Sider:** Oversikt, Virksomheten, Leverandører, Risikovurderinger, Funn og tiltak, Redegjørelse og Innstillinger.
  - De fem delene som ikke er bygget ennå, deler én plassholderrute (`[section]/page.tsx`). Tekstene står i `src/modules/organizations/sections.ts`, som også styrer menyen. De har ærlige tomtilstander uten tall eller eksempeldata.
  - Når en del bygges, får den egen rutemappe, som går foran plassholderen.
  - Invitasjonene er flyttet til Innstillinger.
- **Organisasjonsbytte** (`organization-switcher.tsx`):
  - viser bare egne aktive medlemskap;
  - bytte er en vanlig sidelasting (`<a>`, ikke `next/link`), så all klienttilstand, ruterbuffer og eventuelle Convex-abonnementer for forrige kunde forsvinner;
  - listen har tilgjengelig navn («Bytt virksomhet»).
- **Lasting og feil:**
  - `loading.tsx` («Laster …», `role="status"`) ligger i `[section]/` og `innstillinger/`, under layouter som validerer.
  - `error.tsx` (norsk, uten tekniske detaljer, med «Prøv igjen») finnes både i organisasjonen og på `(app)`-nivå, så også feil i layouten fanges.
- **Tema og font:**
  - semantiske farger i `globals.css` med verdier for lys og mørk modus (`prefers-color-scheme`), og `color-scheme: light dark`;
  - alle faste Tailwind-farger i eksisterende komponenter er byttet til de semantiske;
  - synlig `:focus-visible` overalt;
  - lokal font fra `geist` 1.9.2 (`next/font/local`, filer i pakken), så ingen ekstern fonttjeneste brukes.
- **Primitiver** i `src/components/ui/`:
  - `Button` og `Field` (label, hjelpetekst og feil koblet med `aria-describedby`/`aria-invalid`);
  - `Table` (med caption og vannrett rulling på smale skjermer) og `EmptyState`.
  - De er tatt i bruk i invitasjonsskjemaet, invitasjonstabellen og utloggingsknappen.
- **Sidetitler:** malen er «%s – Kjedeklar».

### Tester
- `tests/e2e/navigation.spec.ts` (ny):
  - **Tastatur:** «Hopp til innholdet» er første fokus, fokus er synlig, og alle sju seksjoner kan åpnes med Enter, med `aria-current="page"`. På hver side er det én h1, en navngitt hovedmeny og ingen skjemafelt uten label.
  - **Mobil (375 px):** menyen åpnes, navigerer og lukkes, og det er ingen vannrett rulling.
  - **Organisasjonsbytte:** bare egne medlemskap vises. En vindusmarkør forsvinner, som beviser full sidelasting, og innholdet viser ikke forrige kunde.
  - **Lasting og avslag:** «Laster …» vises ved forsinket svar, fremmed organisasjon gir 404, og ukjent seksjon gir «Ikke funnet».
  - **Tema og nettverk:** lys og mørk modus gir lys og mørk bakgrunn, og ingen forespørsler går til andre verter enn localhost og 127.0.0.1.
- `tests/e2e/auth.spec.ts`: invitasjonen går nå via Innstillinger i menyen.

### Kjørte kommandoer (7.11.2026, lokalt med Docker)
```text
pnpm install --frozen-lockfile    OK (ny avhengighet: geist 1.9.2, låst eksakt)
pnpm lint / pnpm typecheck        OK
pnpm test:unit                    117/117 (etter review: 120/120 tre ganger; én kjøring traff kjent ustabil test, punkt 5)
pnpm test:integration             50/50
pnpm test:e2e                     11/11, to kjøringer på rad (også etter review)
pnpm build                        OK
```
### Rettet etter review (PR #4)
1. **`Button` og `Field` brukes nå i alle skjemaene:** innlogging, glemt og nytt passord, ny konto og invitasjon. Den mekaniske omskrivingen gjorde først etiketter med `{MIN}` til bokstavelig tekst; det ble fanget i diffen og rettet. `Field` tar nå `ref`.
2. **Ukjent seksjon gir ekte 404.**
   - Den foreslåtte `[section]/layout.tsx` alene var ikke nok; testet, ga fortsatt 200. Årsaken er at `loading.tsx` i foreldresegmentet også omslutter den.
   - Løsning: `[section]/layout.tsx` validerer, og `loading.tsx` er flyttet ned under den (`[section]/`, `innstillinger/`). Oversikt henter ingen data og trenger ingen lastetilstand.
3. **Mobilmenyen og virksomhetsvelgeren** (`Disclosure`) lukkes med Escape, med fokus tilbake til knappen, og ved klikk utenfor. Dekket i e2e.
4. **Bare avslag gir 404.** `handlePageLoadError` gir innloggingssiden for `UNAUTHENTICATED` og 404 for `NOT_FOUND`. Andre feil, som nedetid eller kodefeil, går til feilsiden i stedet for å skjules som «Ikke funnet». Enhetstest: `tests/unit/page-load-error.test.ts`.
5. **Ustabil test i `invitations.test.ts`** (fra oppgave 03) feilet én gang av fire også her. Reviewer retter den i egen PR.

### Manuell prøve
- Jeg har sett på skjermbilder av Oversikt med åpen virksomhetsvelger, Innstillinger med fokus i skjemafeltet og mobilmenyen, i både lys og mørk modus. Kontrast, fokusring og oppsett ser riktige ut.
- Ingen menneskelig prøve i nettleser.
- Slik prøver du selv: logg inn lokalt, bytt systemtema, og naviger med Tab og Enter.

### Ikke gjort / begrensninger
- Lys og mørk modus følger systemvalget. Det finnes ingen egen bryter i appen.
- Ingen klientside Convex-provider: sidene rendres på serveren, og ingen abonnementer finnes ennå. Organisasjonsbytte med full sidelasting sørger for at de blir ryddet når de kommer.
- Rapportperiode vises ikke ennå (oppgaven sier «senere»).
- Ingen automatisk tilgjengelighetsskanning (axe). Sjekken er enkle regler i Playwright og manuell kontroll av skjermbilder.

## Oppgave 05 – transaksjonell revisjonslogg

### Endret
- **Tabellen `auditEvents`:** organisasjon, aktør (bruker eller system), hendelse, objekttype og -id, `occurredAt` satt i mutasjonen, `requestId` og trygg diff. Indeksene starter med `organizationId`.
- **`convex/lib/audit.ts`:** `writeAudit` skriver i samme mutasjon som endringen. `safeDiff` tar bare felter fra `AUDIT_DIFF_FIELDS`: navn, status, rolle og utløpstid. Aldri e-post, token, passord eller fritekst.
- **Logges nå:**
  - navneendring (ny `organizations/mutations:rename`);
  - invitasjon sendt, fornyet, tilbakekalt og godtatt;
  - medlemskap opprettet og endret;
  - operatør-bootstrap og interne medlemskapsfunksjoner (som system).
- **Append-only:**
  - RLS nekter endring av `auditEvents` i tenant-, bruker- og invitasjonsreglene.
  - En statisk test stopper `patch`/`replace`/`delete` på tabellen og innsetting utenfor hjelperen.
  - Registeret har bare en lesefunksjon.
- **Krav for nye mutasjoner:** Registeret i `tests/helpers/audited-mutations.ts` krever at hver mutasjon er klassifisert som logget eller unntatt med begrunnelse. Testen feiler ellers.
- **Atferdsendring:** Tenantfunksjoner kan nå endre egen organisasjon (for navn); fremmed organisasjon avvises fortsatt. Testene fra oppgave 01/02 er oppdatert.
- **Innstillinger:** felt for nytt navn og revisjonslogg med filter på objekttype, 25 per side og «Vis eldre». Aktør vises med navn.
- **Beslutning [0004](decisions/0004-revisjonslogg.md)** dekker også begrensninger og kontrollert vedlikeholds- og sletteprosess. Beslutning 0002 har oppdatert inventar.

### Kjørte kommandoer (7.11.2026, Docker)
```text
pnpm convex:deploy:local / pnpm seed:dev   OK
pnpm lint / pnpm typecheck                 OK
pnpm test:unit                             146/146 (inkl. registertest for logging av mutasjoner)
pnpm test:integration                      59/59 (to kjøringer etter at rollback-proben fikk kontrollkjøring)
pnpm test:e2e                              12/12 (to kjøringer)
pnpm build                                 OK
```
**Rollback mot ekte backend:**
- Proben uten feil lagrer både navn og logglinje. Det beviser at koden når fram til skrivingen.
- Med feil etter audit-skrivingen lagres ingen av dem.
- Backenden skjuler feilmeldingen (`REDACT_LOGS_TO_CLIENT`), så testen sjekker typen (`ConvexError`), ikke teksten.

### Manuell prøve
E2E-testen `tests/e2e/audit.spec.ts` endrer navnet i Innstillinger og bekrefter at raden «Navnet ble endret» viser «Navn: gammelt → nytt» og aktørens navn, og at filteret skjuler den. Ingen menneskelig prøve er gjort.

### Ikke verifisert / begrensninger
- **Append-only gjelder bare i appen:** deploy key, admin key og Convex-dashboardet kan endre loggen. Det er ingen ekstern, uforanderlig kopi.
- **`requestId`** er per hendelse, ikke per forespørsel. Convex eksponerer ikke en id per forespørsel.
- **Lagringstid og pseudonymisering** avklares i oppgave 27; til da slettes ingen revisjonslogg.
- **Registeret for logging av mutasjoner** sjekker per fil, ikke per mutasjon. Når første forretningsmutasjon kommer, skal det få en kjørbar sjekk per mutasjon i convex-test (review av PR #6).

## Oppgave 06 – Brreg-oppslag for egen virksomhet

### Endret
- **Ren domenekode** (`src/domain/brreg/`):
  - org.nr.-validering med mod 11;
  - Zod-kontrakt for de valgte feltene: navn, org.nr., organisasjonsform, adresse, næringskode 1 og status (konkurs, avvikling, tvangsavvikling, slettet);
  - `profileGaps` for datamangler.
  - Ingen roller og ingen `antallAnsatte`.
  - Manglende konkurs- og avviklingsfelt er ukjent (`null`), ikke «nei». De vises som «Ukjent» og blir en datamangel (review av PR #7).
- **Adapter** (`convex/integrations/brreg/client.ts`): 5 s timeout per forsøk og opptil 2 nye forsøk ved 429/5xx/timeout. 404, 410 og 400 gir egne resultater, og svar som ikke matcher kontrakten gir `contract_changed`. Kilde-hash (SHA-256) og mappingversjon lagres.
- **Ny byggekloss `tenantAction`** (`convex/lib/tenantAction.ts`) for nettverkskall. Den verifiserer medlemskap via en intern query med brukerens identitet.
- **Funksjoner:**
  - `organizations/registry:lookup` (action) lagrer bare en forhåndsvisning i `registrySnapshots`.
  - `organizations/registry:confirm` (tenantMutation) skriver opplysninger, snapshot-status og revisjonslogg i én mutasjon. Den har optimistisk sjekk mot det brukeren så som gjeldende (`CONFLICT`), og forhåndsvisningen er gyldig i 30 minutter (`PREVIEW_EXPIRED`).
  - Visningsnavnet endres bare når brukeren krysser av.
- **Org.nr. gir ingen tilgang på tvers:** Det slås aldri opp mot andre arbeidsområder og brukes ikke til å slå sammen eller ta over workspace.
- **Siden Virksomheten** viser bekreftede opplysninger med kilde, hentetid, registerstatus som kontrollsignaler og datamangler. Den har et oppslagsskjema med forhåndsvisning og varsel om endret org.nr. eller navn.
- **RLS:** Bekreftede snapshots kan ikke endres fra tenantfunksjoner; bare forhåndsvisninger kan endres.
- **Registrene** for offentlige funksjoner, mutasjoner med revisjonslogg, kundetabeller og interne prober er oppdatert. `convex-test` har nettverket stoppet.

### Kjørte kommandoer (8.11.2026, Docker)
```text
pnpm lint / pnpm typecheck     OK
pnpm test:unit                 196/196 (etter review)
pnpm test:integration          71/71 (to kjøringer)
pnpm test:e2e                  12/12
pnpm build                     OK
Live-kontroll (manuell)        fetchEnhet("974760673") → found (ORGL, 84.110); 123456785 → not_found
```

### Manuell prøve
Siden Virksomheten er bare prøvd gjennom e2e-navigasjonen (overskrift og tilgjengelighet). Oppslag i nettleseren mot det ekte registeret er ikke prøvd; adapteren er kontrollert direkte mot live-API-et.

### Ikke verifisert / begrensninger
- **SN-versjon:** Brreg oppgir ikke hvilken SN-versjon næringskoden følger. Den lagres som «SN» uten versjon.
- **Forhåndsvisninger** som ikke bekreftes, blir liggende. `shortcut:` ingen opprydding ennå; legg til når jobbmekanismen kommer (oppgave 12).
- **Ingen e2e av selve oppslaget:** Det krever nettverk til Brreg, og live-kall skal ikke være en ustabil CI-avhengighet.

## Oppgave 07 – veiledende pliktvurdering

### Kilde lest før implementasjon
- Åpenhetsloven §§ 2–3 på Lovdata, lest 9. november 2026. Teksten er endret ved lov 21. juni 2024 nr. 42, i kraft 1. november 2024.
- Avgjørende ordlyd:
  - foretak «av allmenn interesse etter regnskapsloven § 1-6»;
  - ellers «overskrider minst to av følgende tre terskler» på balansedagen: 70 mill. kr salgsinntekt, 35 mill. kr balansesum og 50 årsverk;
  - morselskap vurderes «for mor- og datterselskaper sett som en enhet»;
  - endret status får virkning først for «det andre av to regnskapsår etter hverandre».
- Sannhetstabell og tolkning står i `docs/decisions/0005-pliktvurdering.md`.

### Endret
- **`src/domain/applicability/`** (ren TypeScript):
  - `assess.ts` har terskler, regelversjon `apenhetsloven-3a-2024-11-01-v1` og vurdering med begrunnelse per punkt;
  - `parse.ts` tolker kroner og årsverk;
  - `form.ts` gjør skjemaverdier om til grunnlag og formaterer kroner.
- **Regelen:**
  - «overskrider» er strengt over; nøyaktig lik terskel teller ikke;
  - per år er det «overskrider» med minst to kjente verdier over, «overskrider ikke» med minst to kjente på eller under, og ellers uavklart;
  - samme utfall to år gir det utfallet, mens ulikt utfall betyr at tidligere status gjelder;
  - ukjent tidligere status, konsern, utenlandsk eller ukjent tilknytning, usikker allmenn interesse, ufullstendige tall og år som ikke henger sammen gir manuell avklaring;
  - foretak av allmenn interesse er sannsynlig omfattet.
- **`applicabilityAssessments`:**
  - én ny rad per vurdering, med input (beløp i øre som `int64`), resultat, begrunnelse, regelversjon, `assessedBy` og `userConfirmedAt`;
  - indeksen starter med `organizationId`;
  - RLS tillater lesing og innsetting i egen organisasjon, men aldri endring.
- **`organizations/applicability:assess`** (`tenantMutation`):
  - krever `confirmed: true` og validerer år og at ingen tall er negative;
  - resultatet regnes ut på serveren;
  - vurdering og revisjonslogg (`applicability.assessed`, diff bare `result` og `ruleVersion`, ingen tall) skrives i samme mutasjon.
- **`organizations/applicability:history`** gir de siste ti vurderingene.
- **Virksomheten-siden** viser:
  - siste vurdering med resultat (tekst, alltid «veiledende»), begrunnelse, neste steg, tallene for begge år, tersklene, svarene, tidspunkt og regelversjon;
  - et skjema med forhåndsvisning (samme regelfunksjon), feilmelding per felt og avkrysning for å bekrefte grunnlaget. Server-actionen validerer med Zod og tolker på nytt.
- **Ingen utestenging:** «sannsynlig ikke omfattet» sier at verktøyet kan brukes frivillig.
- **Revisjonsloggen i Innstillinger** har tekst og filter for «Pliktvurdering».

### Tester
- `tests/unit/applicability.test.ts` (49 tester):
  - 0, 1, 2 og 3 overskredne terskler, nøyaktig lik terskel, og én øre eller 0,01 årsverk over;
  - delvis manglende tall;
  - toårsregelen i alle retninger, ny overgang og ukjent historikk (aldri skråsikkert nei), og år som ikke henger sammen;
  - konsern, allmenn interesse og utenlandsk eller ukjent tilknytning;
  - tolking av kroner og årsverk, og skjema til grunnlag.
- `tests/convex/applicability.test.ts`:
  - resultatet regnes på serveren, ny rad per vurdering og gammel uendret;
  - revisjonsloggen har bare resultat og regelversjon;
  - ugyldige tall og manglende bekreftelse lagrer ingenting;
  - fremmed organisasjon avvises.
- `tests/convex/applicability-rollback.test.ts`: feiler `writeAudit`, lagres ingen vurdering.
- `tests/integration/applicability.test.ts` mot lokal backend: historikk, revisjonslogg, fremmed organisasjon, at ingenting lekker, og uinnlogget kall.
- `tests/e2e/applicability.spec.ts`: utfylling, forhåndsvisning, feilmelding per felt, at lagring er sperret uten bekreftelse, lagring og visning med grunnlag og regelversjon.
- Registrene er oppdatert: offentlige funksjoner, kundetabeller (`getOwned`/RLS) og revisjonslogging av mutasjoner.

### Kjørte kommandoer (9.11.2026, lokalt med Docker)
```text
pnpm convex:deploy:local          OK (convex/_generated oppdatert med ekte codegen)
pnpm lint / pnpm typecheck        OK
pnpm test:unit                    265/265
pnpm test:integration             78/78
pnpm test:e2e                     13/13, to kjøringer på rad
pnpm build                        OK
```

### Manuell prøve
- Jeg har sett på et skjermbilde av seksjonen etter lagring: resultat, grunnlag mot terskler, svar, regelversjon og skjema med forhåndsvisning.
- Ingen menneskelig prøve i nettleser.
- Slik prøver du selv: Virksomheten → fyll inn to år → se forhåndsvisningen → kryss av for bekreftelse → lagre.

### Ikke gjort / begrensninger
- **Ikke juridisk kvalitetssikret.** Tolkningen av toårsregelen og «allmenn interesse» bør gjennomgås av en med juridisk kompetanse før pilot.
- **Konsern, utenlandske virksomheter, Svalbard/Jan Mayen og nystiftede foretak** uten to regnskapsår gir bare manuell avklaring. Det finnes ingen egen regel for dem.
- **«Tilbyr varer og tjenester» (§ 2) forutsettes** og spørres ikke om.
- **Ingen kobling til rapportperiode ennå** (oppgave 08 og senere). Regnskapsåret skrives inn fritt.

## Oppgave 08 – rapportperiode og virksomhetsprofil

Beslutninger og begrunnelser står i `docs/decisions/0006-rapportperiode-og-virksomhetsprofil.md`.

### Endret
- **`src/domain/reporting/`** (ren TypeScript):
  - `period.ts` har datokontroll (`YYYY-MM-DD`, ekte kalenderdato, 2000–2100), periodevalidering, forslag til periode og norsk datoformat;
  - `profile.ts` har de åtte temaene, svarstatusene, normalisering av svar og listen over hull.
- **`reportingPeriods`:** start, slutt og frist som datotekst, status `open`, `createdAt`/`createdBy`. Indeksen starter med `organizationId`. RLS tillater lesing og innsetting i egen organisasjon, aldri endring.
- **`businessProfileRevisions`:** én rad per lagring, med periode, versjonsnummer, åtte svar (`status` + `text`) og valgfri intern bekreftelse. RLS nekter endring.
- **`organizations/reportingPeriods:create`** (`tenantMutation`): validerer på serveren, avviser lik start og slutt i samme organisasjon (`PERIOD_EXISTS`) og skriver `reporting_period.created` i samme mutasjon. **`:list`** gir de 50 nyeste.
- **`organizations/businessProfile:save`** (`tenantMutation`): laster perioden med `getOwned`, normaliserer svarene, avviser utdatert `expectedRevision` (`CONFLICT`), setter inn ny versjon og skriver `business_profile.saved` (versjon, bekreftelse og status per tema, aldri svartekst) i samme mutasjon. **`:current`** gir perioden, siste versjon og historikken.
- **Appskallet:** periodevelger i toppen. Valgt periode ligger i adressen (`?periode=<id>`) og følger med i menyen, men bare når den er en av organisasjonens egne perioder.
- **Virksomheten-siden:**
  - skjema for ny periode med foreslått kalenderår, feilmelding per felt og fritt valg av alle tre datoene;
  - virksomhetsprofil for valgt periode med Ja / Nei, ikke etablert / Ikke besvart per tema, liste over hull («Ikke besvart (n)») og over det som er oppgitt som ikke etablert;
  - status for siste versjon (lagret, bekreftet eller ikke) og versjonstabell;
  - lagringsfeil vises som varsel, og teksten i skjemaet beholdes.
- **Revisjonsloggen i Innstillinger** har tekst og filter for «Rapportperiode» og «Virksomhetsprofil».
- **Ikke bygget:** automatisk årshjul og e-postpåminnelser (utenfor MVP).

### Akseptkriterier
1. *Opprette og velge periode med start, slutt og eksplisitt frist:* e2e oppretter to avvikende regnskapsår og bytter mellom dem.
2. *Endringer i profilen lagres som historikk med audit og bekreftet-status:* convex- og integrasjonstester viser at versjon 1 er uendret etter versjon 2, og at revisjonsloggen har diff uten svartekst.
3. *Ubesvarte spørsmål er synlige hull:* enhetstest av `profileGaps` og e2e («Ikke besvart (8)» → «Ikke besvart (5)», «Oppgitt som ikke etablert: Retningslinjer»).
4. *Valgt periode følger navigasjonen og kan ikke peke på en annen tenant:* e2e for navigasjon; convex- og integrasjonstester for at fremmed periode gir `NOT_FOUND` både ved lagring og lesing.

### Tester
- `tests/unit/reporting.test.ts`: gyldige og ugyldige datoer (skuddag, 30. februar, norsk format, tidsstempel), ugyldig intervall, frist før slutt, avvikende regnskapsår, periodeforslag rundt 30. juni, og svarregler i profilen.
- `tests/convex/profile.test.ts`: opprettelse med audit, duplikat avvises men er tillatt i en annen organisasjon, ugyldig input lagrer ingenting, ny versjon bevarer gammel, utdatert versjon gir `CONFLICT`, fremmed periode, ugyldig id og id fra annen tabell gir `NOT_FOUND`, og audit uten svartekst.
- `tests/convex/profile-rollback.test.ts`: feiler `writeAudit`, lagres verken periode eller profil.
- `tests/integration/profile.test.ts` mot lokal backend med to innloggede organisasjoner: historikk og audit, to samtidige lagringer fra samme versjon (én `CONFLICT`), to samtidige opprettelser av samme periode (én `PERIOD_EXISTS`, én rad), fremmed periode avvises og ingenting lekker, og uinnloggede kall.
- `tests/e2e/profile.spec.ts`: tom tilstand, ugyldig intervall, opprett og bytt periode, periode gjennom navigasjon, hull, påkrevd beskrivelse, lagring, versjonshistorikk, lagringsfeil fra utdatert fane (teksten beholdes) og ugyldig periode i adressen.
- Registrene er oppdatert: offentlige funksjoner, kundetabeller (`getOwned`/RLS) og revisjonslogging av mutasjoner.

### Kjørte kommandoer (natt til 10.11.2026, lokalt med Docker)
```text
pnpm convex:deploy:local          OK (convex/_generated oppdatert med ekte codegen)
pnpm lint / pnpm typecheck        OK
pnpm test:unit                    330/330
pnpm test:integration             92/92
pnpm test:e2e                     14/14
pnpm build                        OK
```
Underveis:
- Første integrasjonskjøring hadde 92 beståtte tester, men avsluttet med feil fordi en test opprettet kall som ble avvist før de ble ventet på. Testen er rettet, og kjøringen over er etter rettelsen.
- Første e2e-kjøring feilet på forventet 404 for ugyldig periode i adressen. Siden viser «Ikke funnet» uten data, men statuskoden er 200 fordi siden strømmes. Testen kontrollerer nå innholdet i stedet for statuskoden; se beslutning 0006.

### Rettet etter review (PR #10)
- **Konfliktmeldingen:** standardmeldingen ba brukeren laste siden på nytt, og da ville teksten i skjemaet forsvinne. Lagring av profilen gir nå «Noen har lagret en nyere versjon av profilen. Kopier teksten din før du laster siden på nytt.» Ingen endring i Convex.
- **Adressen:** periodevelgeren beholder andre parametere (for eksempel filteret i revisjonsloggen), og lenkene i revisjonsloggen beholder valgt periode. E2e-testen dekker begge retninger.
- **Versjonshistorikken** sier fra når bare de 20 nyeste versjonene vises.
- Kjørt etter rettelsene (10.11.2026): `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` (330/330) og `pnpm test:e2e` (14/14, med ny produksjonsbygging). `pnpm test:integration` er ikke kjørt på nytt, siden ingenting i `convex/` er endret.

### Manuell prøve
- Ingen menneskelig prøve i nettleser, og ingen visuell kontroll av skjermbilder denne gangen.
- Slik prøver du selv: Virksomheten → opprett rapportperiode → fyll inn noen temaer, la andre stå ubesvart → lagre → se hull og versjonshistorikk → opprett en periode til og bytt i toppen.

### Ikke gjort / begrensninger
- **Perioder kan ikke endres eller slettes.** En periode med feil datoer må i dag rettes av operatør.
- **Ingen kontroll av overlapp eller lengde** på perioder; bare eksakt like datoer avvises.
- **Eldre profilversjoner kan ikke åpnes**, og historikken viser ikke hvem som lagret (det står i revisjonsloggen).
- **Ugyldig periode i adressen gir HTTP 200** med «Ikke funnet»-siden.
- **Pliktvurderingen er ikke koblet til rapportperioden.**
- **Temaene og spørsmålene er ikke faglig kvalitetssikret** mot åpenhetsloven § 5 og OECD-veilederen.

## Oppgave 09 – leverandørregister med manuell registrering

Beslutninger og begrunnelser står i `docs/decisions/0007-leverandorregister.md`.

### Endret
- **`src/domain/suppliers/`** (ren TypeScript):
  - `countries.ts` har de 249 landkodene i ISO 3166-1 alfa-2 og norske navn til visning;
  - `supplier.ts` har validering av profil og innkjøpsdata, navnenøkkel og tolking av skjemaet for innkjøp. Beløp tolkes med den eksisterende `parseKronerToOre`.
- **`suppliers`:** profil med navn, norsk org.nr., egen leverandør-ID, registreringsland, kodeverk og bransjekode, pluss `status`, `archivedAt` og `rowVersion`. Felt som mangler, er ukjente.
- **`supplierPeriods`:** innkjøpsdata per leverandør og rapportperiode med `spendOre` (`int64`, mangler når ukjent), kategori, beskrivelse, kjente produksjonsland, `upstreamUnknown` og egen `rowVersion`.
- **Indekser** starter med `organizationId`. RLS tillater lesing, innsetting og endring i egen organisasjon. Ingen funksjon sletter.
- **`suppliers/mutations`** (`tenantMutation`, alle med revisjonslogg i samme mutasjon):
  - `create` og `update` validerer på serveren og avviser org.nr. som finnes fra før i organisasjonen (`SUPPLIER_EXISTS`);
  - `update`, `setArchived` og `savePeriod` avviser utdatert `expectedRowVersion` (`CONFLICT`);
  - `savePeriod` laster både leverandør og periode med `getOwned`.
- **`suppliers/queries`** (`tenantQuery`): `list` er paginert over indeks, med aktive eller arkiverte og søk på starten av navnet. `get` gir profilen, innkjøpsdata for valgt periode og andre leverandører med samme navn.
- **Sider:** Leverandører (liste, søk, aktive og arkiverte), Ny leverandør og detaljside med profilskjema, innkjøp for valgt rapportperiode og arkivering. Valgt periode (`?periode=`) følger lenkene.
- **Visning:** «Ukjent» står som tekst for beløp, registreringsland, produksjonsland og leddene bak leverandøren. Registreringsland og produksjonsland vises som to forskjellige rader.
- **Menyen** markerer nå seksjonen også på undersider.
- **Revisjonsloggen i Innstillinger** har tekst og filter for «Leverandører» og «Innkjøpsdata», og viser beløp i kroner.
- **Ikke bygget:** risiko, CSV-import og Brreg-beriking av leverandører (senere oppgaver).

### Akseptkriterier
1. *Leverandørprofil er adskilt fra årets innkjøpsdata:* to tabeller. Convex-testen viser at lagring av innkjøpsdata ikke endrer leverandørdokumentet, og at hver periode har sin egen rad.
2. *Beløp lagres eksakt i øre og vises norsk; ukjent er forskjellig fra null:* enhetstester for tolking og et beløp over `Number.MAX_SAFE_INTEGER`, convex- og integrasjonstester for ukjent, `0n` og stort beløp, og e2e for «Ukjent» → «0 kr» → «1 250,50 kr».
3. *Norsk registrering gjør ikke produksjonslandet kjent:* convex- og integrasjonstest, og e2e viser «Registreringsland Norge» sammen med «Kjente produksjonsland Ukjent».
4. *Arkivering bevarer historikk; alle endringer får audit:* convex-, integrasjons- og e2e-tester for arkivering og gjenoppretting, registertesten for at alle fire mutasjoner logger, og rollback-test.

### Tester
- `tests/unit/suppliers.test.ts` (36 tester): landkoder, profilvalidering, navnenøkkel, norsk desimaltolking, store beløp, ugyldige beløp og innkjøpsdata.
- `tests/convex/suppliers.test.ts`: opprettelse, org.nr. i to organisasjoner og dobbelt i samme (også arkivert), likt navn uten sammenslåing, ugyldig input, endring med fjerning av felt, konflikt, fremmed og ugyldig id, arkivering og gjenoppretting, ukjent mot null, fremmed periode og leverandør i sju kombinasjoner, revisjonslogg uten kjøpsbeskrivelse, og paginert liste med søk.
- `tests/convex/suppliers-rollback.test.ts`: feiler `writeAudit`, lagres ingen av de fire endringene.
- `tests/integration/suppliers.test.ts` mot lokal backend med to innloggede organisasjoner: org.nr. på tvers og dobbelt, to samtidige opprettelser (én `SUPPLIER_EXISTS`, én leverandør), to samtidige endringer og lagringer (én `CONFLICT`), fremmed periode- og leverandørreferanse avvist uten lekkasje eller endring, arkivering, revisjonslogg og uinnloggede kall.
- `tests/e2e/suppliers.spec.ts`: hele flyten i nettleser, med feil ved feltene, konflikt fra utdatert fane, duplikat, søk, arkivering, revisjonslogg og ugyldig id i adressen.
- Registrene er oppdatert: offentlige funksjoner, kundetabeller (`getOwned`/RLS) og revisjonslogging av mutasjoner.

### Kjørte kommandoer (10.11.2026, lokalt med Docker)
```text
pnpm convex:deploy:local          OK (convex/_generated oppdatert med ekte codegen)
pnpm lint / pnpm typecheck        OK
pnpm test:unit                    417/417
pnpm test:integration             112/112
pnpm test:e2e                     15/15
pnpm build                        OK
```
Underveis feilet to tester på grunn av selve testen, ikke koden: en testtittel kunne ikke skrive ut et `bigint`, og en rad-velger i e2e traff to rader. Begge er rettet, og kjøringene over er etter rettelsene.

### Manuell prøve
- Jeg har sett på skjermbilder av detaljsiden på stor og smal skjerm. Listen er bare kontrollert gjennom e2e-testen.
- Ingen menneskelig prøve i nettleser.
- Slik prøver du selv: Leverandører → Ny leverandør → fyll inn navn → på detaljsiden: la beløpet stå tomt, lagre, skriv 0, lagre → legg til et produksjonsland → arkiver og gjenopprett.

### Ikke gjort / begrensninger
- **Søket treffer bare starten av navnet**, og ikke org.nr.
- **`externalKey` er ikke unik.** Må avgjøres før importen i oppgave 11 matcher på den.
- **Mulig duplikat** foreslås bare for helt like navn.
- **Listen viser ikke innkjøpsbeløp**, og det er ingen sortering på beløp (kommer med risiko).
- **Ingen adresse eller valuta** på leverandøren; beløp er alltid NOK.
- **Ugyldig leverandør-id i adressen gir HTTP 200** med «Ikke funnet»-siden.
- **Leverandørnavn i revisjonsloggen** kan være et personnavn for enkeltpersonforetak; avklares i oppgave 27.

## Oppgave 10 – CSV-opplasting og forhåndsvisning

Beslutninger og begrunnelser står i `docs/decisions/0008-csv-forhandsvisning.md`.

### Endret
- **Ny pakke:** `papaparse` 5.7.0 (og `@types/papaparse` 5.5.2), låst eksakt. Ingen egne avhengigheter.
- **`src/domain/import/`** (ren TypeScript, samme kode i tester og i Convex):
  - `csv.ts` leser bytes til en tabell: UTF-8 med eller uten BOM, semikolon eller komma, siterte felt, radnummer som i et regneark, og avvisning av hele filen ved for stor fil, feil tegnsett, tom fil, for mange rader eller kolonner;
  - `amount.ts` tolker norske beløp til øre som `bigint` og melder fra om tvetydige beløp i stedet for å gjette;
  - `country.ts` kjenner igjen landkoder og norske og engelske landnavn fra en fast tabell;
  - `mapping.ts` foreslår kolonner fra overskriftene;
  - `normalize.ts` gir normaliserte verdier, feil og avklaringer per rad, og dubletter i filen;
  - `match.ts` foreslår matching mot leverandører som finnes fra før;
  - `preview.ts` setter stegene sammen.
- **`suppliers/import/actions:preview`** (`tenantAction`): tar filen som bytes, håndhever 2 MiB og 2 000 rader, og returnerer forhåndsvisningen. Leverandørene hentes av en intern query med `organizationId` fra verifisert tenant. Ingen tabell, fillagring, jobb eller logg.
- **Siden «Forhåndsvis CSV-fil»** under Leverandører:
  - filvalg med avvisning av for store filer før opplasting;
  - valg av skilletegn, desimaltegn, kolonne per felt og kodeverk for bransjekode, med oppdatert forhåndsvisning for hvert valg;
  - oppsummering, filter på rader med feil eller avklaringer, og 50 rader per side;
  - for hver rad: normalisert verdi og teksten i filen per felt, forslag til matching, og feil og avklaringer i full bredde.
- **Syntetisk mal:** `public/maler/leverandorer-mal.csv`, lenket fra siden.
- **`next.config.ts`:** grensen for server-actions er satt til `3mb` (standard 1 MB), så filer på inntil 2 MiB kommer gjennom.
- **Rettet underveis:** `formatKroner` viste negative beløp feil («−2 500,-50 kr»). Den viser nå «−2 500,50 kr». Feilen ble funnet av e2e-testen og har fått enhetstest.
- **`SelectField`** lar ikke lenger lange alternativer gjøre siden bredere enn skjermen.
- **Ikke bygget:** selve importen, tabellene `importBatches`/`importRows` og kobling til rapportperiode (oppgave 11).

### Akseptkriterier
1. *Kolonnemapping og feil kan gjennomgås før import:* e2e endrer kolonnevalg, desimaltegn og filter og ser radene oppdateres. Ingenting kan importeres ennå.
2. *Ukjent land, ugyldig org.nr., tvetydig beløp og negative beløp blir synlige avklaringer:* enhetstester per type, og e2e ser hver melding på riktig rad i feilfilen.
3. *Filer over grense avvises tidlig; filinnhold renderes som tekst:* nettleseren avviser uten opplasting (e2e teller forespørsler), server-actionen kontrollerer størrelsen før filen leses, og Convex kontrollerer på nytt. Script, HTML og formler vises som tekst i e2e, uten dialog og uten nye elementer på siden.
4. *Råfil lagres ikke:* convex-testen sammenligner alle tabeller, fillagring og planlagte funksjoner før og etter, og en statisk test stopper skriving, fillagring, jobber og logging i koden for forhåndsvisningen.

### Tester
- `tests/fixtures/csv/`: BOM med semikolon og CRLF, komma, anførselstegn med linjeskift, tomme felt, lignende navn, beløp, ISO-8859-1 (ugyldig tegnsett), ubetrodd tekst og en feilfil. Fil- og radgrensen lages i testene.
- `tests/unit/csv-parse.test.ts` (16), `csv-amount.test.ts` (55), `csv-preview.test.ts` (24) og `csv-no-storage.test.ts` (16).
- `tests/convex/csv-preview.test.ts` (7): malen, matching bare mot egne leverandører, henting over flere sider, at ingenting lagres, servergrenser, brukerens valg og fremmed organisasjon.
- `tests/integration/csv-preview.test.ts` (5) mot lokal backend: parseren i Convex sin kjøretid, eksakt beløp over 2^53 øre gjennom hele veien, en fil like under 2 MiB med 2 000 rader, matching og svar uten noe fra den andre organisasjonen, og uendrede leverandører og revisjonslogg.
- `tests/e2e/import.spec.ts`: hele flyten i nettleser, også en fil på over 1,5 MB gjennom server-actionen og visning på smal skjerm uten vannrett rulling av siden.
- Registrene er oppdatert: den offentlige actionen og den interne queryen har fått sine standardtester for tenantgrensen.

### Kjørte kommandoer (10.11.2026, lokalt med Docker)
```text
pnpm convex:deploy:local          OK (convex/_generated oppdatert med ekte codegen)
pnpm lint / pnpm typecheck        OK
pnpm test:unit                    538/538
pnpm test:integration             120/120
pnpm test:e2e                     16/16 i siste kjøring
pnpm build                        OK
```
Hele e2e-suiten ble kjørt fire ganger, pluss én delkjøring. Bare den siste fulle kjøringen var helt grønn:
- **Kjøring 1:** importtesten feilet på en påstand i selve testen (elementet var ikke rullet inn i bildet). Rettet. Testen hadde da brukt 30 sekunder, mot 10–11 til vanlig.
- **Kjøring 2:** importtesten traff tidsgrensen på 30 sekunder allerede ved opprettelsen av den første leverandøren. **Årsaken er ikke funnet.** Mønsteret ligner den kjente, lokale tregheten ved innlogging, men det er ikke bekreftet, fordi sporingsfilen ble overskrevet av neste kjøring.
- **Delkjøring** (de fire første testfilene) og **kjøring 4:** grønne. Importtesten brukte 10 sekunder.
- **Kjøring 3** ble kjørt med sporing påslått. Da traff leverandørtesten fra oppgave 09 tidsgrensen. Sporingen viste ingen steg som hang: testen bruker 22–25 av 30 sekunder til vanlig og ble for treg med sporing. Den testen har altså liten margin.

### Manuell prøve
- Jeg har sett på skjermbilder av forhåndsvisningen med feilfilen (`tests/fixtures/csv/feilfil.csv`) på stor og smal skjerm. Første utgave skjulte forslag og avklaringer utenfor høyre kant; tabellen ble lagt om, og skjermbildene ble kontrollert på nytt.
- Ingen menneskelig prøve i nettleser.
- Slik prøver du selv: Leverandører → Forhåndsvis CSV-fil → last ned malen og last den opp → last opp `tests/fixtures/csv/feilfil.csv` → bytt desimaltegn til komma og se at det tvetydige beløpet avklares.

### Rettet etter review (PR #12 og #13)
- De to lange e2e-flytene (`suppliers.spec.ts` og `import.spec.ts`) har fått `test.slow()`, som tredobler tidsgrensen for bare dem. Bekreftet med full e2e-kjøring lokalt (16/16) og grønn CI på 7bb1c87. Årsaken til det ene tidsavbruddet ved opprettelse av leverandør er fortsatt ikke funnet.
- PR #13: konfliktmeldingen i forhåndsvisningen nevner bare identifikatorene raden faktisk har.

### Ikke gjort / begrensninger
- **Ingen import.** Forhåndsvisningen lagrer ingenting, og siden sier det.
- **`externalKey` er fortsatt ikke unik.** Flere treff på samme ID vises som konflikt. Regelen må avgjøres i oppgave 11.
- **Bare UTF-8.** Eldre Excel-filer i Windows-1252 avvises med forklaring.
- **Produksjonsland kan ikke leses fra fil**; «land» er registreringsland.
- **Navnelikhet** fanger ikke skrivefeil eller delvise navn.
- **Grensen på 3 MB for server-actions gjelder hele appen.**
- **Tidsavbruddene i e2e er ikke forklart** (se over). CI viser om de også skjer der.

## Oppgave 11 – bekreftet, idempotent CSV-import

Beslutninger og begrunnelser står i `docs/decisions/0009-csv-import.md`.

### Endret
- **`src/domain/import/plan.ts`** (ren TypeScript): slår sammen rader for samme leverandør til én oppføring med summert beløp, gir hver oppføring en type, og avgjør hvilke valg som er tillatt og hvilket valg som gjelder.
- **`importBatches` og `importRows`:** importgrunnlaget. Bare normaliserte verdier, radnummer, meldinger og hasher lagres; aldri filen eller teksten fra cellene. RLS tillater lesing og endring i egen organisasjon; opprettelse skjer bare i intern mutasjon.
- **`suppliers/import/prepare:prepare`** (`tenantAction`): leser filen på nytt, lager oppføringene og lagrer grunnlaget i stykker på 200 via interne mutasjoner (`store.ts`). Perioden og hver foreslått leverandør kontrolleres mot organisasjonen i samme transaksjon som lagrer dem.
- **`suppliers/import/batches`** (`tenantQuery`/`tenantMutation`):
  - `list`, `get` og `rows` (paginert) for oversikt og gjennomgang;
  - `setPolicy` og `decide` for fellesvalg og valg per oppføring, med versjonssjekk;
  - `startCommit` bekrefter når alt har valg, grunnlaget ikke er utløpt og versjonen stemmer;
  - `commitChunk` gjennomfører 100 oppføringer per transaksjon og kan kalles til importen er ferdig.
- **Leverandør-ID er unik per organisasjon** når den er satt, også ved manuell registrering (`SUPPLIER_KEY_EXISTS`). Kontrollen av profilen er flyttet til `convex/suppliers/model.ts` og brukes av både registrering og import.
- **Grensesnitt:**
  - «Klargjør import» under forhåndsvisningen, med valg av rapportperiode;
  - egen side per import med fellesvalg, valg per oppføring, bekreftelse med fremdrift, «Fortsett importen» etter avbrudd, og resultat;
  - liste over de ti siste importene.
- **Revisjonsloggen i Innstillinger** har tekst og filter for «Import».
- **`Table`** lar innhold måle seg mot tabellens synlige bredde, så meldingslinjer ikke blir bredere enn tabellen.
- **Ikke bygget:** bakgrunnsjobb for gjennomføringen (oppgave 12), retting av feilrader i appen og sletting av importgrunnlag.

### Akseptkriterier
1. *Dobbeltklikk, retry og identisk fil gir ikke flere leverandører eller dobbelt beløp:* convex- og integrasjonstester for gjentatt klargjøring, gjentatt bekreftelse, gjentatt gjennomføring og ny import av samme fil. E2e dobbeltklikker bekreftelsen og importerer samme fil to ganger.
2. *Stale eller utløpt preview, eller endret leverandør etter preview, gir konflikt og ny bekreftelse:* utløpt grunnlag og eldre regelversjon gir `IMPORT_EXPIRED`, utdatert versjon gir `CONFLICT`, og endret leverandør eller endret beløp gir «ikke importert» på oppføringen uten overskriving.
3. *Resultat viser opprettet, oppdatert, utelatt og valgte feilrader:* resultatsiden har antallene, og hver oppføring viser sitt resultat. E2e kontrollerer begge.
4. *Fremmed batch eller `targetSupplierId` kan ikke importeres:* convex- og integrasjonstester med fremmed batch, fremmed periode, fremmed leverandør, egen leverandør utenfor forslagene og oppføring fra et annet grunnlag.

### Tester
- `tests/unit/import-plan.test.ts` (12): sammenslåing og summering, ukjent mot null, kreditnota, feilrader utenfor summen, motstrid i filen, typer, tillatte valg og fingeravtrykk.
- `tests/convex/import.test.ts` (13): grunnlag uten råfil, idempotent klargjøring, valg og avvisninger, full gjennomføring med beløp og profil, gjentakelser, utløp, konflikter, stykkevis gjennomføring og unik leverandør-ID.
- `tests/convex/import-rollback.test.ts` (3): feiler revisjonsloggen, lagres ingenting fra det steget. Feil midt i importen ruller tilbake hele stykket, og importen kan fortsettes.
- `tests/integration/import.test.ts` (5) mot lokal backend:
  - 2 000 oppføringer klargjort og gjennomført av to samtidige klienter, uten dubletter;
  - feil midt i importen: stykket rulles tilbake, importen står som ikke fullført og fortsettes;
  - gjentatt fil, samtidig dobbel klargjøring og endrede valg;
  - leverandør endret etter grunnlaget;
  - fremmed batch, periode og leverandør.
- `tests/e2e/import-commit.spec.ts`: forhåndsvisning, klargjøring, valg, dobbeltklikk på bekreftelse, resultat, beløp og liste, ny import av samme fil, revisjonslogg, smal skjerm og ugyldig id i adressen.
- Registrene er oppdatert: åtte offentlige funksjoner, to kundetabeller, åtte mutasjoner og fire interne funksjoner.

### Kjørte kommandoer (10.11.2026, lokalt med Docker)
```text
pnpm convex:deploy:local          OK (convex/_generated oppdatert med ekte codegen)
pnpm lint / pnpm typecheck        OK
pnpm test:unit                    601/601
pnpm test:integration             145/145
pnpm test:e2e                     17/17
pnpm build                        OK
```
Underveis:
- Første integrasjonskjøring av importen feilet: to klienter som gjennomførte samme import samtidig, fikk en samtidighetsfeil fra Convex. Ingenting ble behandlet to ganger, men feilen nådde klienten. Testen og grensesnittet venter nå og prøver igjen.
- En convex-test fant at gjentatt import av samme fil ikke ble gjenkjent, fordi fingeravtrykket ble regnet ut etter matchingen. Rettet.
- E2e fant at valg ikke ble vist før serveren hadde svart, og at lange meldinger ble kuttet på stor skjerm. Begge er rettet.
- E2e-suiten ble kjørt én gang i full bredde etter siste endring, og den var grønn. Tidsavbruddene fra oppgave 10 kom ikke tilbake i denne kjøringen.

### Manuell prøve
- Jeg har sett på skjermbilder av utkastsiden og resultatsiden på stor skjerm. Smal skjerm er bare kontrollert av e2e-testen (ingen vannrett rulling av siden, og valgene er synlige).
- Ingen menneskelig prøve i nettleser.
- Slik prøver du selv: Leverandører → Importer fra CSV → last opp malen → Klargjør import → velg for hver type → Bekreft og importer → se resultatet og leverandørlisten. Last så opp samme fil en gang til.

### Ikke gjort / begrensninger
- **Importen drives av nettleseren.** Lukkes fanen midt i en stor import, står importen som ikke fullført til noen velger «Fortsett importen».
- **Revisjonslogg per batch.** En leverandør opprettet ved import står ikke som egen hendelse under «Leverandører» i loggen.
- **Feilrader kan ikke rettes i appen.**
- **Oppdatering endrer ikke leverandørens profil**, bare periodens innkjøpsdata.
- **Arkivering etter at grunnlaget ble laget oppdages ikke.**
- **Importgrunnlag slettes ikke**; lagringstid avklares i oppgave 27.
- **Convex sine grenser er lest fra dokumentasjonen på nett**, ikke fra den installerte pakken, som ikke har dem. 2 000 oppføringer er prøvd mot lokal backend.

## Oppgave 12 – varige bakgrunnsjobber

Beslutninger og begrunnelser står i `docs/decisions/0010-bakgrunnsjobber.md`.

### Endret
- **Ny pakke:** `@convex-dev/workpool` 0.4.15, låst eksakt (under 1.0). Registrert som komponenten `jobWorkpool` i `convex/convex.config.ts`.
- **`jobs`-tabellen:** organisasjon, type, `inputRef`, `idempotencyKey`, status, forsøk, maks forsøk, `runAfter`, feilkode og tidsstempler. Indeksene starter med `organizationId`. RLS lar tenantfunksjoner lese og opprette, aldri endre.
- **`convex/jobs/`:**
  - `handlers.ts` og `types.ts`: listen over tillatte jobbtyper og formen på en handler;
  - `model.ts`: `enqueueJob`, som oppretter en jobb idempotent og legger den i køen i samme transaksjon;
  - `mutations.ts`: `enqueue` (`tenantMutation`);
  - `queries.ts`: `get` og `list` (`tenantQuery`);
  - `internal.ts`: `begin`, `attemptFailed`, `complete` og `completed`;
  - `run.ts`: den interne actionen køen kaller for hvert forsøk;
  - `pool.ts`: køen, med fem samtidige jobber;
  - `testHandler.ts`: den kontrollerte testtypen `test.probe`.
- **`getOwned`** krever nå bare organisasjonen fra tenantkonteksten, så interne jobbfunksjoner kan bruke den med tenant fra den lagrede jobben.
- **ESLint:** bare `convex/jobs/pool.ts` får koble til workpool-komponenten.
- **Revisjonsloggen i Innstillinger** har tekst og filter for «Bakgrunnsjobber».
- **Ikke bygget:** jobbtyper for Brreg, AI og PDF, visning av jobber, avbryting og egen workerprosess.

### Akseptkriterier
1. *Dobbel innsending gir én jobb, og samme jobb kjøres ikke dobbelt eller skriver resultat to ganger:* convex-test for gjentatt innsending og for resultat som leveres flere ganger; integrasjonstest med to samtidige klienter.
2. *Feilet eller avbrutt action prøves på nytt til maks forsøk og får terminal feilstatus:* convex-test med falske klokker, og integrasjonstest der køen gjør tre ekte forsøk med ventetid før jobben får `failed`.
3. *En jobb kan ikke skrive til feil tenant eller velge egen handler:* ukjent type og innebygde navn avvises, fremmed referanse avvises ved opprettelse, og en lagret jobb med fremmed referanse eller ukjent type stoppes før arbeidet.
4. *Interne jobbfunksjoner kan ikke kalles fra klient; status leses bare av rett kunde:* én probe per intern funksjon mot lokal backend, og `NOT_FOUND` for en annen organisasjons jobb.

### Tester
- `tests/convex/jobs.test.ts` (17) med falske klokker: dobbel innsending, annen nøkkel og organisasjon, gjenbrukt nøkkel for annet dokument, tillatte typer, testtypen utenfor testmiljø, fremmed referanse, forsøk med økende ventetid, sluttstatus etter maks forsøk, stoppende feil, uventet feil uten feilmelding i loggen, resultat i feil form, idempotent resultat, sent resultat, gammelt forsøk, ukjent handler på lagret jobb, slettet eller fremmed referanse, forsøk utover maks, og status per organisasjon.
- `tests/convex/jobs-rollback.test.ts` (1): feiler revisjonsloggen, finnes verken jobben eller noe i køen.
- `tests/integration/jobs.test.ts` (3) mot lokal backend: to samtidige innsendinger, ekte forsøk og sluttstatus gjennom køen, og isolasjon mellom organisasjoner.
- `tests/integration/tenancy.test.ts`: seks nye prober for de interne jobbfunksjonene, og standardtestene for de tre offentlige.
- `tests/unit/next-no-admin-key.test.ts` (3): Next.js-koden leser ikke deploy key eller admin key og importerer ikke interne funksjoner.
- Registrene er oppdatert: tre offentlige funksjoner, én kundetabell, fem mutasjoner og seks interne funksjoner.

### Kjørte kommandoer (12.11.2026, lokalt med Docker)
```text
pnpm install --frozen-lockfile    OK
pnpm convex:deploy:local          OK (komponenten jobWorkpool installert; convex/_generated oppdatert)
pnpm lint / pnpm typecheck        OK
pnpm test:unit                    636/636
pnpm test:integration             160/160
pnpm test:e2e                     17/17
pnpm build                        OK
```
Underveis:
- **Maskinen blokkerte arbeidet en stund.** Repoet lå på Skrivebordet, som iCloud synkroniserer. iCloud hadde flyttet innholdet i 1 237 filer under `node_modules` og 71 under `.git/objects` ut av disken, så `convex dev --once`, typesjekk og alle convex-tester hang. Repoet ligger nå i `~/Downloads/Developer/Kjedeklar`: de 71 git-objektene ble hentet på nytt fra GitHub (alle kom tilbake), `node_modules` ble installert på nytt, og mappen ble flyttet. Kjøringene over er gjort utenfor iCloud; lint, typecheck, enhetstester, integrasjonstester og build er også kjørt fra den endelige plasseringen, e2e er ikke det.
- Første integrasjonskjøring hadde én feil i en ny test: den brukte samme idempotensnøkkel for tre leverandører. Det viste også at en gjenbrukt nøkkel for et annet dokument ga en urelatert jobb tilbake. Nå avvises det med `CONFLICT`.
- Workpool 0.4.16 ble utgitt dagen før og ble valgt bort til fordel for 0.4.15, som da var to uker gammel.

### Manuell prøve
- Ingen. Jobbene har ikke noe grensesnitt, og testtypen kan bare opprettes i lokale testmiljø.

### Ikke gjort / begrensninger
- **Ingen jobbtype for produksjon.** Mekanismen er bare prøvd med testtypen.
- **Ingen visning, avbryting eller ny start** av jobber for brukeren.
- **Handlere må selv være idempotente mot eksterne tjenester.** Mekanismen hindrer bare dobbel skriving i databasen.
- **Ikke prøvd mot Convex Cloud.** Workpool er bare kjørt i convex-test og mot lokal selvhostet backend.
- **Én uforklart testfeil.** `tests/convex/jobs.test.ts` («dobbel innsending gir én jobb») feilet én gang i en full kjøring rett etter pakkeinstallasjon. Feilmeldingen ble ikke fanget opp, og testen har bestått i ti kjøringer etterpå, også med tom testbuffer. Årsaken er ikke funnet.

## Oppgave 13 – Brreg-beriking av leverandører

Beslutninger og begrunnelser står i `docs/decisions/0011-brreg-beriking.md`.

### Endret
- **Jobbtypen `brreg.enrich`** (`convex/suppliers/enrichmentJob.ts`), registrert i `convex/jobs/handlers.ts`: én jobb per leverandør, slår opp org.nr. med adapteren fra oppgave 06 (8 s timeout, én henting per forsøk), validerer svaret med Zod, og skriver snapshot og status i samme mutasjon som setter jobben fullført. Fire forsøk med 30 s, 2 min og 8 min ventetid; kontrakt som ikke stemmer prøves ikke på nytt. Køen begrenser til fem samtidige.
- **`convex/suppliers/enrichment.ts`:** `request` og `requestMissing` (høyst 50 om gangen) oppretter jobber via `enqueueJob`; `get` gir status, registerprofil, datamangler og forslag; `applySuggestion` godtar ett forslag med versjonssjekk og revisjonslogg.
- **Det generelle `jobs/mutations:enqueue` kan nå bare opprette testtyper** (funnet i review av oppgave 12). Produksjonstyper opprettes bare av egne tenantmutasjoner.
- **Jobbmekanismen:** valgfri `onFailed`-hook i `JobHandler`, kalt fra sluttstatusen `failed`, så leverandøren kan vise feilen.
- **Skjema:** `registrySnapshots` får `supplierId`, status `fetched` og indeksen `by_organizationId_and_supplierId_and_fetchedAt`. `suppliers` får `registryEnrichment` og `industryCodeSource` (rører ikke `rowVersion`). Ingen nye tabeller.
- **Audit:** `supplier.registry_requested` og `supplier.registry_fetched`; godkjente forslag logges som `supplier.updated` med begrunnelse.
- **Domene:** `src/domain/suppliers/registry.ts` (status, forslag, feiltekster); `registryProfileSchema` (Zod) i `src/domain/brreg/enhet.ts`.
- **Grensesnitt:** status per leverandør i listen med «Hent fra Enhetsregisteret for alle», og en Enhetsregisteret-seksjon på leverandørsiden med status, hentetid, registerstatus, datamangler, forslag («Bruk registerverdien», kodeverk velges for næringskode) og «Hent på nytt». Siden oppdaterer seg selv hvert femte sekund mens noe hentes.
- **Testoppsett:** `BRREG_ENHET_URL` leses av adapteren bare på lokal test-backend; `scripts/local-convex.mjs` setter den, og `compose.yml` gir `convex-test` `host.docker.internal`, så integrasjons- og e2e-testene kan kjøre en falsk Brreg på port 38100.

### Akseptkriterier
1. *Importen kan brukes mens beriking kjører; status per leverandør er synlig:* integrasjonstest oppretter og redigerer leverandører mens et oppslag står og venter; status vises i listen og på leverandørsiden (e2e).
2. *429/timeout gir begrenset retry og delvis feilstatus uten tap av import:* convex-test med falske klokker (429 gir nøyaktig fire oppslag, så ingen flere; fire leverandører der tre lykkes og én feiler; timeout; kontrakt prøves én gang); integrasjonstest for første 429 og ventetid.
3. *Bransjekode har kodeverkversjon og hentetid; manglende kode blir ikke lav risiko:* koden lagres med snapshot og hentetid og kodeverket brukeren velger; manglende kode gir ingen verdi, intet forslag og synlig datamangel.
4. *Oppdatering gir audit og markerer vurderingsgrunnlag endret når risikomodulen finnes:* audit er dekket og rollback-testet. Risikomodulen finnes ikke; `rowVersion` og nytt snapshot er signalene den kan bruke (se 0011). Ingenting merkes utdatert i dag.

### Tester
- `tests/convex/enrichment.test.ts` (18): lykket henting uten profilendring, blanding av norske/ikke funnet/utenlandske/uten org.nr., 50-grense, dobbel forespørsel, manglende næringskode, 429 med maks forsøk, forbigående feil og delvis feil, timeout og endret kontrakt, beholdt siste snapshot, redigering og endret org.nr. mens jobben kjører, godkjenning av forslag (versjon, kodeverk, kilde, audit, tapt kilde), NUF, fremmed leverandør, «hent for alle» per organisasjon, stengt generelt endepunkt, jobb med fremmed referanse og intern query.
- `tests/convex/enrichment-rollback.test.ts` (3): feiler revisjonsloggen, rulles forespørsel, godkjenning og skriving av registersvar tilbake.
- `tests/unit/supplier-registry.test.ts` (7): status, forslagsregler og Zod-skjema.
- `tests/integration/enrichment.test.ts` (6) mot lokal backend med falsk Brreg: blanding, redigering mens oppslaget pågår, 429 uten hamring, kontrakt, to samtidige faner og tenantisolasjon.
- `tests/integration/tenancy.test.ts`: probe for `orgNumberFor`; `public-functions.ts`/`audited-mutations.ts` har de fire nye funksjonene og tre mutasjoner.
- `tests/e2e/enrichment.spec.ts` (1): utenlandsk leverandør, henting, forslag, valg av kodeverk og liste.

### Kjørte kommandoer (14.11.2026, lokalt med Docker)
```text
pnpm convex:deploy:test           OK (convex/_generated oppdatert)
pnpm lint / pnpm typecheck        OK
pnpm test:unit                    676/676
pnpm test:integration             175/175
pnpm exec playwright test         18/18 (med Google Chrome, se under)
pnpm build                        OK
```
- **E2E ble kjørt med lokalt installert Google Chrome**, via en midlertidig Playwright-konfigurasjon (`channel: "chrome"`, ikke sjekket inn), fordi Playwrights egen Chromium ikke var installert og ikke ble lastet ned. CI bruker Playwrights Chromium.
- Etter e2e-kjøringen ble én linje i `enrichmentJob.ts` forenklet (feilkoden fra et tidligere forsøk fjernes uten destrukturering). Etterpå er lint, typecheck og convex-testene for beriking og jobber kjørt på nytt (38/38); full integrasjons- og e2e-kjøring er ikke gjentatt.
- Første e2e-kjøring avdekket at profilskjemaet beholdt gamle verdier etter at et forslag var godtatt (skjemaet har egen tilstand, beslutning 0007). Siden lastes nå på nytt etter godkjenning.

### Manuell prøve
- Ingen utover e2e. Enhetsregisteret er ikke kalt fra noen test; svarformen følger de syntetiske kontraktsfixturene fra oppgave 06.

### Ikke gjort / begrensninger
- **Ikke verifisert mot ekte Enhetsregisteret** i denne oppgaven (live-kontroll ble gjort i oppgave 06). Rate-grenser og `Retry-After` er ikke undersøkt; header leses ikke.
- **Ingen automatisk utfylling og ingen avvisning av forslag.** Valgt for å aldri overskrive brukerrettelser; kan tas opp igjen når SN-versjon er avklart.
- **SN-versjon oppgis ikke av Brreg**; brukeren velger. Spørsmålet om hvilken versjon Brreg følger er ikke avklart (side hos Brreg sier det ikke).
- **Retry-tidene (30 s, 2 min, 8 min) er ikke prøvd i sanntid**; bare med falske klokker.
- **«Hent for alle»** leser de første 2 000 aktive leverandørene og hopper over de som har feilet.
- **Vurderingsgrunnlag:** risikomodulen finnes ikke, så ingenting merkes «endret».
- **Statusoppdatering** er polling hvert femte sekund.

## Oppgave 14 – versjonerte risikodata og faglig metodekontrakt

Beslutninger og begrunnelser står i `docs/decisions/0012-risikodata.md` og `docs/decisions/risk-method-v0.md`.

### Endret
- **Fire globale tabeller** (uten `organizationId`): `riskDatasetVersions`, `countryRiskEntries`, `industryRiskEntries`, `riskMethodVersions`. RLS-reglene for alle tre kontekstene er utvidet: kunder leser bare aktiverte og pensjonerte versjoner (demo bare lokalt), innholdstabellene leses ikke, og ingenting kan skrives fra tenantfunksjoner.
- **`src/domain/risk/datasets/`** (ren TypeScript): Zod-skjema for land-, bransje- og metodemanifest, semantisk validering (duplikat, tvetydig mapping, datoer, metodens regler), kanonisk SHA-256-checksum og livsløpsregler (hindre for aktivering, `freshness`, synlighet).
- **`convex/risk/`:** `internal.ts` (`importVersion`, `activateVersion`, bare med admin/deploy key), `queries.ts` (`activeVersions`, `getVersion` som `tenantQuery`, bare metadata), `model.ts`, `validators.ts`.
- **Kommandoer:** `pnpm risk-data:validate`, `risk-data:import` og `risk-data:activate` (`scripts/risk-data-*.ts`, kjørt direkte av Node 24). Admin key leses fra en env-fil lokalt, aldri fra appen.
- **`risk-data/demo/`:** tre tydelig syntetiske fixtures (land `XA`–`XC`, bransjekoder i den ubrukte divisjonen `00`, metodedemo). Ingen reelle data.
- **Metodekontrakten** (`risk-method-v0.md`): Kjedeklars screening, krav om faglig gjennomgang før kundebruk, ordinal max med ukjent-regel, prioritetsrekkefølge, og skillet mellom risikofaktorer og kontrollsignaler. Håndheves av valideringen (f.eks. `amountAffectsLevel: false`).
- **Verktøy:** `allowImportingTsExtensions` i begge `tsconfig`-filer, og `.ts`-endelser på importene i `src/domain/risk/datasets/`.
- **Rettet fra oppgave 13:** `tests/integration/enrichment.test.ts` laget tre avvisende løfter før de ble awaitet, som ga «unhandled rejection» og kunne gi utgangskode 1 uten at en test feilet. Nå lages de først når de brukes.

### Akseptkriterier
1. *Ny dataversjon kan importeres og aktiveres uten kodeendring; gammel forblir lesbar:* convex-test og integrasjonstest med de ekte kommandoene. Ny aktivering pensjonerer den gamle, som kan leses av kunder med uendret innhold og metadata.
2. *Produksjonsaktivering av demo, uavklart lisens, manglende godkjenning eller ugyldig mapping avvises:* enhets-, convex- og integrasjonstester per hinder (også manglende gjennomgang, utgått review og endret checksum), og avvist aktivering lar eksisterende aktiv versjon stå.
3. *Utdaterte kilder er en eksplisitt tilstand:* `freshness` er `current`, `review_overdue` eller `unreviewed`. En aktiv versjon som passerer forfallsdatoen forblir lesbar, men vises som `review_overdue`.
4. *Metodekontrakten sier at dette er Kjedeklars screening med krav om faglig gjennomgang:* i `risk-method-v0.md`, og håndhevet: metodefilen må ha `scope: "kjedeklar_screening"` og `requiresProfessionalReview: true`, og produksjonsaktivering krever gjennomgang og godkjenning.

### Tester
- `tests/unit/risk-data.test.ts` (37): repoets filer er gyldige med riktig checksum og er bare demo, duplisert land, manglende kildereferanse, ugyldig ISO (og `XA` bare i demo), uventet kodeverk, tvetydig mapping, eksakt/prefiks, metoderegler, checksum (rekkefølge og endringer), alle hindre for aktivering, grensedagen for review, og kommandoen `risk-data:validate`.
- `tests/convex/risk-data.test.ts` (22): import (gyldig, ugyldig, endret innhold, demo utenfor lokalt miljø, samme versjon to ganger, operatør), aktivering og historikk, hindre, RLS-reglene og utdatert kilde.
- `tests/integration/risk-data.test.ts` (5) mot lokal backend med kommandoene og to innloggede kunder; `tests/integration/tenancy.test.ts` har probe for `importVersion` og `activateVersion` (import-proben sjekker at ingenting ble skrevet).
- Registre: to offentlige queries, to interne mutasjoner (unntatt fra revisjonslogg med begrunnelse), og de fire tabellene som eksplisitt globale i `registry.test.ts`.

### Kjørte kommandoer (14.11.2026, lokalt med Docker)
```text
pnpm risk-data:validate           OK (3 demo-filer)
pnpm convex:deploy:test           OK
pnpm lint / pnpm typecheck        OK
pnpm test:unit                    741/741
pnpm test:integration             187/187
pnpm exec playwright test         18/18 (med Google Chrome, midlertidig konfigurasjon som ikke er sjekket inn)
pnpm build                        OK
```

### Manuell prøve
- Ingen utover de automatiske testene, som kjører de ekte kommandoene mot test-backenden.

### Ikke gjort / begrensninger
- **Ingen reelle risikodata.** Kilder, lisens og mapping fra indikator til nivå er ikke avklart og er ikke fagreviewet. Metodekontrakten er et forslag.
- **Ikke prøvd mot Convex Cloud.** Kommandoene bruker admin key via `ConvexHttpClient` mot selvhostet backend; prosedyre for deploy key mot Cloud er ikke laget.
- **Revisjonslogg:** import og aktivering har ingen `auditEvents` (loggen er per kunde); hvem og når står på versjonsdokumentet, og operatørnavnet er en påstand.
- **Checksum er integritetsvern, ikke signatur;** gjennomgang og godkjenning er opplysninger i filen uten bevis.
- **Størrelse:** høyst 1 000 linjer per versjon, én mutasjon. Ingen CSV.
- **Kunder leser ikke innholdet** i innholdstabellene ennå; oppgave 15 avgjør lesefunksjon.
- E2E er ikke utvidet: oppgaven har ikke noe grensesnitt.

## Oppgave 15 – deterministisk risikomotor

Beslutninger og begrunnelser står i `docs/decisions/0013-risikovurdering.md`.

### Endret
- **`src/domain/risk/engine.ts`** (ren TypeScript): `assess`, `normalizeInput`, `inputHash`. Kjent høy faktor gir høy; ellers vesentlig mangel (fra metodens `unknownPolicy`) gir ukjent; ellers høyeste kjente nivå; uten faktorer ukjent. Beløp og registreringsland er ikke input. Land-, bransje- (eksakt, lengste prefiks, kodeverk må stemme) og produktfaktor, kontrollsignaler, `missingFields`, `staleSources`, `dataQuality`.
- **`riskAssessments`** (ny kundetabell): ny uforanderlig rad per beregning med `inputSnapshot`, `inputHash`, versjonsreferanser, `engineVersion` og resultat. RLS: lesing og opprettelse i egen organisasjon, aldri endring.
- **`convex/risk/assessments.ts`:** `assessPeriod` (200 leverandører per kall, markør), `latest` (med status `current`/`stale` og årsaker) og `history`. Uendrede leverandører får ingen ny rad. Én audit (`risk.assessed`) per kall med lagrede vurderinger.
- **`risk/internal:engineData`** (intern query): innholdet i de aktive versjonene, siden kundefunksjoner ikke kan lese innholdstabellene.
- **Utdatert** regnes ut ved lesing: endret input, metode, landdata, bransjedata, motorversjon eller kildefriskhet.
- **Testfunksjon:** `ops/testing:seedSuppliersForRisk` (bare test-backend) til belastningstesten.
- **Rettet:** `tests/integration/risk-data.test.ts` hadde en test som bare tillot to offentlige risikofunksjoner; oppdatert til de fem.

### Akseptkriterier
1. *Samme input og versjoner gir identisk resultat uten AI eller nettverk:* ren motor, enhetstest av determinisme, rekkefølge og hash.
2. *Høy faktor kan ikke nøytraliseres av lav:* tabelltester og metamorfe egenskaper over et rutenett på 216 input (høy gir alltid høy, selv med ukjent oppstrøms, registerflagg og utgått kilde).
3. *Ukjent/utgått kilde er synlig, og høy bevares ved andre mangler:* tabelltester og convex-test (utgått kilde etter vurdering gir `source_freshness_changed`, og ny vurdering beholder høy).
4. *Ny input eller metode gir ny vurdering og merker gammel som utdatert; historikk bevares:* convex-tester (input, profil, metode, land, bransje, registerstatus) og integrasjonstest mot lokal backend; gamle rader er uendret.

### Tester
- `tests/unit/risk-engine.test.ts` (27): lav/moderat/høy/ukjent, ingen faktorer, høy+ukjent, utgått kilde, uklart produksjonsland, kodeversjon, dekning, kontrollsignaler, determinisme og metamorfe egenskaper (ingen fast-check; eget rutenett).
- `tests/convex/risk-assess.test.ts` (15), `risk-assess-rollback.test.ts` (1): snapshot, versjoner, audit, beløp som aldri påvirker noe, registreringsland, uten innkjøpsdata, arkiverte, registerstatus, utdatert-årsaker, bulk med markør, tenantvern.
- `tests/integration/risk-assess.test.ts` (2) mot lokal backend: 2 000 leverandører, ny kjøring uten ny beregning, annen organisasjon, ny aktiv versjon gir utdatert og ny rad, audit.
- `tenant-tables.ts` (`getOwned`-/RLS-standardtester for `riskAssessments`), registrene (tre offentlige funksjoner, én mutasjon, interne prober).

### Måling (lokal backend, 2 000 leverandører, tests/integration/risk-assess.test.ts)
| Per kall | Kall | Tregeste kall |
|---|---|---|
| 200 | 11 | ca. 0,5 s |
| 2 000 | 2 | ca. 2,1 s (gikk) |

Tidene er veggtid fra testklienten, inkludert nettverk. 200 valgt for margin; ingen jobb eller kø innført. Ikke målt mot Convex Cloud.

### Kjørte kommandoer (14.11.2026, lokalt med Docker)
```text
pnpm convex:deploy:test           OK
pnpm lint / pnpm typecheck        OK
pnpm test:unit                    797/797
pnpm test:integration             196/197 i første fulle kjøring; den ene var en gammel test i risk-data.test.ts (rettet, 6/6 på nytt). Resten av suiten er ikke kjørt på nytt etter rettelsen
pnpm exec playwright test         17/18 i første kjøring; navigation.spec.ts «lasting vises ved trege svar…» feilet med «Route is already handled», og bestod alene (5/5)
pnpm build                        OK
```
E2E er kjørt med lokalt installert Google Chrome via en midlertidig konfigurasjon (ikke sjekket inn).

### Ikke gjort / begrensninger
- **Ingen grensesnitt**, ingen sortert oppfølgingsliste, ingen implementasjon av `priorityOrder`/beløpssortering.
- **Ingen produksjonsdata**; alt er prøvd med syntetiske demo-data. Resultater har ingen faglig mening før data og metode er gjennomgått.
- **Ingen kodeverkoversettelse.** Kodeverk som ikke stemmer med datasettet gir ingen mapping.
- **Produktkategori** er fritekst og krever eksakt likhet (små bokstaver) med datasettet.
- **Flaky e2e:** `navigation.spec.ts` feilet én gang med «Route is already handled» (test av treg lasting; ikke berørt av denne endringen) og bestod ved ny kjøring.
- Bulkgrensene er ikke målt mot Convex Cloud.

## Oppgave 16 – risikoliste, forklaring og kundens vurdering

Beslutninger og begrunnelser står i `docs/decisions/0014-risikoliste-og-kundevurdering.md`.

### Endret
- **`assessmentReviews`** (ny kundetabell, append-only): bekreftelse, overstyring eller tilbaketrekking med begrunnelse, bruker, tidspunkt og opprinnelig nivå. RLS: lese og opprette i egen organisasjon, aldri endre.
- **`convex/risk/reviews.ts`:** `list` (risikoprioritert, filter, paginering, tellinger som skiller screening fra kundens vurdering), `detail` (forklaring, kilder, mangler, historikk) og `record` (begrunnelse, `getOwned`, optimistisk lås med `expectedReviewId`, avvisning ved utdatert grunnlag, audit `risk.reviewed`).
- **`src/domain/risk/review.ts`:** `checkRationale`, `effectiveReview`, `groupOrder`, `prioritySort` (ren logikk).
- **Grensesnitt:** `/risikovurderinger` (liste) og `/risikovurderinger/[supplierId]` (forklaring, skjema, historikk) erstatter plassholderen. Knapp for å kjøre screeningen.
- **Testfunksjon:** `ops/testing:setPeriodCountries` (bare test-backend): demo-kodene XA–XC er ikke ISO-land, så appen tar dem ikke imot.
- **Rettet:** `tests/integration/risk-data.test.ts` forventet bare to risikomutasjoner/-queries; utvidet.

### Akseptkriterier
1. *Forstå hvorfor en regel slo ut og hva som mangler:* detaljvisningen viser regel, kilde, utgave, linje, beskrivelse og mangler (e2e).
2. *Overstyring uten begrunnelse avvises, originalen bevares:* enhets-, convex- og e2e-tester; screeningsradene er uendret.
3. *Liste og tellinger er tenant-/periodeavgrenset og skiller screening fra review:* convex- og integrasjonstester.
4. *Overstyrt lavt nivå skjuler ikke høy screening eller ukjent oppstrøms:* convex-test og e2e; listen sorteres etter screeningen.

### Tester
- `tests/unit/risk-review.test.ts` (20): begrunnelse, effektiv vurdering, sortering over alle kombinasjoner av nivå og beløp.
- `tests/convex/risk-review.test.ts` (19), `risk-review-rollback.test.ts` (1): sortering/tellinger, filter, forklaring, begrunnelse, ugyldige valg, låsing, tilbaketrekking, endret input, ny screening, fremmed vurdering, audit uten fritekst, rollback.
- `tests/integration/risk-review.test.ts` (4) mot lokal backend: samtidige vurderinger (én vinner), input endret etter visning, fremmed vurdering/leverandør/periode, 2 000 leverandører i listen og `truncated` over grensen.
- `tests/e2e/risk.spec.ts` (1): forklaring → avvist kort begrunnelse → overstyring → historikk → endret grunnlag → utdatert → ny screening → ny bekreftelse.
- Tenant-sjekkliste (`getOwned`/RLS), registre for offentlige funksjoner og audit.

### Måling (lokal backend)
Listen med 1 990 leverandører i én spørring: 1,3 s inkludert nettverk. En første variant som kontrollerte grunnlaget for alle leverandører gikk i 1 000 (1,1 s) men feilet i 2 000, og ble bygget om (se 0014).

### Kjørte kommandoer (14.11.2026, lokalt med Docker)
```text
pnpm convex:deploy:test           OK
pnpm lint / pnpm typecheck        OK
pnpm test:unit                    847/847
pnpm test:integration             206/208 i første fulle kjøring: én gammel forventning i risk-data.test.ts (rettet) og tenancy.test.ts «samtidige kall…» (Server Error på en enkel query under last; bestod ved ny kjøring av begge filene, 144/144). Resten er ikke kjørt på nytt
pnpm exec playwright test         18/19 i full kjøring: navigation.spec.ts «lasting vises ved trege svar…» feilet (kjent flaky), bestod alene (5/5)
pnpm build                        OK
```
E2E er kjørt med lokalt installert Google Chrome via en midlertidig konfigurasjon (ikke sjekket inn).

### Ikke gjort / begrunnelser
- **Ingen reelle data eller fagreview;** alt er prøvd med syntetiske demo-data.
- **Listen er ikke målt mot Convex Cloud** og leser opptil 2 000 leverandører; flere gir «ikke komplett».
- **Tenancy-flaken er ikke forklart:** en enkel query ga Server Error under samtidig last én gang.
- **Begrunnelsessjekken er syntaktisk.** Ingen kobling til funn/tiltak, ingen eksport av listen.

## Åpne eksterne avklaringer
- Convex DPA, underleverandører og plassering av backup, logg og support (beslutning 0001). Må lukkes før ekte kundedata.
- Hosting for Next.js og PDF-worker i EU/EØS (oppgave 25).
