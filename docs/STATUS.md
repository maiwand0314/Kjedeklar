# Status

Startpakke opprettet 6. november 2026. Dokumentasjonen ble samme dag skrevet om fra PostgreSQL/Drizzle til Convex Cloud i EU (se docs/decisions/0001-convex-eu.md).

| Oppgave | Status | Verifisering | Begrensning |
|---|---|---|---|
| 01 | Implementert, verifisert lokalt og i CI (PR #1, review-endringer rettet) | Lint, typecheck, 35 enhets-/convex-test-tester, 9 integrasjonstester mot lokal test-backend, 3 Playwright-tester og build er grønne fra ren start. CI var grønn på første versjon av PR-en | Kun lokal backend. Ingen Convex Cloud-deployment |
| 02 | Implementert. Integrasjon verifisert lokalt med Docker; e2e ikke kjørt lokalt ennå | Lokalt: lint, typecheck, 69 enhets-/convex-test-tester og build. CI (PR #2): 69 enhetstester og 19 integrasjonstester mot lokal backend, `convex/_generated` er uendret. E2E: 3 av 4 grønne i første kjøring, 1 rettet | Integrasjon og e2e er ikke kjørt lokalt (Docker mangler) |

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
- E2E er ikke kjørt lokalt ennå (Playwright-Chromium er ikke installert på maskinen). Integrasjon er kjørt lokalt med Docker.
- Probe-testen for `ops/seed:seedDev` er svak: funksjonen har i tillegg miljøsperre, så den ville feilet på test-backenden selv om den var offentlig.
- Fra klient gir kall til interne funksjoner og komponentfunksjoner en generell feil (`REDACT_LOGS_TO_CLIENT`). Testene kontrollerer avslag og effekt, ikke feilteksten.
- Det finnes ingen offentlige mutasjoner ennå, så negative skrive- og slettetester mot backend venter til første kundetabell. Registeret og `tenant-tables.ts` kjører dem automatisk når den kommer.
- Isolasjonen er i applikasjonslaget. Deploy/admin key, interne funksjoner og dashboard kan omgå den (se beslutning 0002).
- Til oppgave 25: samtidighetsgrensen gjelder bare lokale backender. Convex Cloud har egne grenser; ytelse under last må vurderes der.
- Til oppgave 03: Better Auth finner ikke klient-IP i Convex sine HTTP-actions og faller tilbake til én delt teller per sti. Innloggingsbegrensningen (3 per 10 s) er derfor trolig felles for alle brukere, ikke per IP. Dette må avklares og settes opp (`advanced.ipAddress`) før pilot.

## Åpne eksterne avklaringer
- Convex DPA, underleverandører og plassering av backup, logg og support (beslutning 0001). Må lukkes før ekte kundedata.
- Hosting for Next.js og PDF-worker i EU/EØS (oppgave 25).
