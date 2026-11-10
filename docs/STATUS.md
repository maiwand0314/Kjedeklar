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

## Åpne eksterne avklaringer
- Convex DPA, underleverandører og plassering av backup, logg og support (beslutning 0001). Må lukkes før ekte kundedata.
- Hosting for Next.js og PDF-worker i EU/EØS (oppgave 25).
