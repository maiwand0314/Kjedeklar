# Status

Startpakke opprettet 6. november 2026. Dokumentasjonen ble samme dag skrevet om fra PostgreSQL/Drizzle til Convex Cloud i EU (se docs/decisions/0001-convex-eu.md).

| Oppgave | Status | Verifisering | Begrensning |
|---|---|---|---|
| 01 | Implementert, verifisert lokalt og i CI (PR #1, review-endringer rettet) | Lint, typecheck, 35 enhets-/convex-test-tester, 9 integrasjonstester mot lokal test-backend, 3 Playwright-tester og build er grønne fra ren start. CI var grønn på første versjon av PR-en | Kun lokal backend. Ingen Convex Cloud-deployment |
| 02 | Implementert, verifisert lokalt og i CI, merget (PR #2) | Lokalt med Docker på 363fff4 (review 7.11): lint, typecheck, 69 enhets-/convex-test-tester, 21 integrasjonstester (to kjøringer), 4 e2e-tester (to kjøringer) og build. `convex/_generated` stemmer med ekte codegen. CI grønn på 363fff4 og på main etter merge | Innloggingsbegrensningen er felles for alle brukere (ingen klient-IP); løses i oppgave 03 |
| 03 | Implementert og verifisert lokalt (branch `feature/03-auth-lifecycle`) | Fra ren start: lint, typecheck, 117 enhets-/convex-test-tester, 50 integrasjonstester mot lokal backend og Mailpit (fire kjøringer, tre på rad grønne etter siste rettelse), 6 e2e-tester (seks kjøringer) og build | Bare Mailpit, ingen produksjonsleverandør. Klient-IP i produksjon krever at reverse proxy overskriver headeren (oppgave 25) |
| 04 | Implementert, verifisert lokalt, review-merknader rettet (PR #4) | Lokalt med Docker etter review: lint, typecheck, 120 enhets-/convex-test-tester (tre kjøringer), 50 integrasjonstester, 11 e2e-tester (to kjøringer) og build. Visuell kontroll av skjermbilder i lys og mørk modus | Lys/mørk følger systemvalget; ingen egen bryter. Ingen klientside Convex-provider ennå (sidene rendres på serveren) |
| 05 | Implementert og verifisert lokalt (branch `feature/05-audit`) | Lint, typecheck, 146 enhets-/convex-test-tester, 59 integrasjonstester (to kjøringer), 12 e2e-tester (to kjøringer) og build | Append-only bare i appen; deploy key og dashboard kan omgå (beslutning 0004). Lagringstid/sletting avklares i oppgave 27 |

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

## Åpne eksterne avklaringer
- Convex DPA, underleverandører og plassering av backup, logg og support (beslutning 0001). Må lukkes før ekte kundedata.
- Hosting for Next.js og PDF-worker i EU/EØS (oppgave 25).
