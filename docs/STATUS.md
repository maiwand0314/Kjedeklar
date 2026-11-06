# Status

Startpakke opprettet 6. november 2026. Dokumentasjonen ble samme dag skrevet om fra PostgreSQL/Drizzle til Convex Cloud i EU (se docs/decisions/0001-convex-eu.md).

| Oppgave | Status | Verifisering | Begrensning |
|---|---|---|---|
| 01 | Implementert og verifisert lokalt (branch `feature/01-foundation`) | Lint, typecheck, 24 enhets-/convex-test-tester, 9 integrasjonstester mot lokal test-backend, 3 Playwright-tester og build er grønne fra ren start (6.11.2026) | Kun lokal backend. CI-workflow er skrevet, men har ikke kjørt på GitHub før branchen pushes. Ingen Convex Cloud-deployment |

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
pnpm test:unit                                          24/24 bestått
pnpm test:integration                                   9/9 bestått
pnpm test:e2e                                           3/3 bestått
pnpm build                                              OK
```
Ekstra kontroller:
- Mutasjonskontroll: når sjekken av aktivt medlemskap eller innpakningen av `ctx.db` ble fjernet midlertidig, feilet testene som forventet.
- Et bevisst brudd på ESLint-regelen ga feil.
- `curl` mot `/api/auth/sign-up/email` ga 400.

### Manuell prøve
Login → beskyttet side → fremmed org («Ikke funnet») → utlogging er kjørt automatisk i Playwright. Ingen menneskelig prøve i nettleser er gjort ennå. Slik prøver du selv: følg «Kom i gang» i README og logg inn med passordet i `.env.convex-dev.local`.

### Ikke verifisert / begrensninger
- CI har ikke kjørt på GitHub ennå.
- Convex Cloud (EU) er ikke satt opp. Det skjer i oppgave 25 og krever konto.
- `@convex-dev/better-auth` er under 1.0. Self-hosted Convex-image er en rullerende revisjon som er bevisst valgt og låst.
- Ratebegrensning er på, men ikke eksplisitt testet. Det hører til oppgave 03. Integrasjonstesten venter og prøver på nytt ved 429.
- Feilmeldinger fra backend til klient er redigert bort (`REDACT_LOGS_TO_CLIENT`). Kall til interne funksjoner fra klient gir derfor en generell «Server Error», ikke en egen kode.
- Revisjonslogg (oppgave 05), invitasjon/reset (03) og full isolasjonsherding med negativ lint-test (02) er ikke gjort.

## Åpne eksterne avklaringer
- Convex DPA, underleverandører og plassering av backup, logg og support (beslutning 0001). Må lukkes før ekte kundedata.
- Hosting for Next.js og PDF-worker i EU/EØS (oppgave 25).
