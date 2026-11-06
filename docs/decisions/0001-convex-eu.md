# 0001 – Convex Cloud i EU som backend

- **Status:** Vedtatt 6. november 2026
- **Erstatter:** Opprinnelig forslag med PostgreSQL 18, Drizzle, SQL-RLS, egne DB-roller og Job-tabell med leasing
- **Berører:** CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, alle oppgaveprompter

## Beslutning
Kjedeklar bruker Convex som database og backend: skjema, queries, mutasjoner, actions, scheduler og fillagring. Next.js (App Router) er grensesnittet og en tynn serverinngang for innlogging og binære nedlastinger. Better Auth kjører i Convex via komponenten `@convex-dev/better-auth`.

- **Staging og produksjon:** Convex Cloud, region `aws-eu-west-1` (Irland). Regionen kan ikke endres for en eksisterende deployment, så staging/prod opprettes i EU fra start (oppgave 25).
- **Lokal utvikling og CI:** Convex sin åpne backend (`ghcr.io/get-convex/convex-backend`) i Docker Compose, låst til en eksakt versjon. Ingen konto og ingen kundedata.
- **Senere mulighet:** Selvhostet Convex på EU/EØS-VPS. Flytting skjer med eksport/import via Convex CLI. Koden skal derfor ikke avhenge av funksjoner som bare finnes i Convex Cloud uten at det er dokumentert her.

## Begrunnelse
Teamet har valgt Convex. Én TypeScript-kodebase for data og backendlogikk, transaksjonelle mutasjoner, innebygd scheduler og typede funksjoner gir lite driftsarbeid for to deltidsutviklere. EU-regionen dekker kravet om kundeinnhold i EU, forutsatt at punktene under «Åpne avklaringer» blir bekreftet.

## Konsekvenser for sikkerhetsmodellen
Convex har ikke radpolicyer i databasen, databaseroller eller fremmednøkler. Det som tidligere var SQL-RLS og DB-roller, erstattes slik:

| Tidligere | Convex |
|---|---|
| `withTenant` + `set_config('app.organization_id')` | `tenantQuery`/`tenantMutation`/`tenantAction` i `convex/lib/tenant.ts`: verifisert bruker → aktivt medlemskap → rolle → `ctx.tenant` |
| RLS med USING/WITH CHECK | Innpakket `ctx.db` (RLS-hjelper fra `convex-helpers`) som avviser lesing og skriving av dokumenter med annen `organizationId`. Ekstra vern, ikke eneste vern |
| Migratorrolle | Convex deploy key / admin key. Brukes bare i CI-deploy og av operatør, aldri i Next.js, nettleser eller PDF-worker |
| Smal auth/membership-rolle | Better Auth-komponentens egne tabeller i eget navnerom. Medlemskap opprettes bare via interne funksjoner (bootstrap/invitasjon) |
| Runtime-rolle uten DDL | Offentlige funksjoner laget med tenant-byggeklossene. ESLint forbyr rå `query`/`mutation`/`action` utenfor `convex/lib/` |
| Sammensatte FK-er `(organization_id, id)` | `getOwned(ctx, table, id)` laster og kontrollerer `organizationId` for hver referanse før bruk eller lagring |
| UNIQUE-constraints | Indeksoppslag i samme mutasjon. Convex-mutasjoner er serialiserbare (OCC), så samtidige konflikter gir retry, ikke duplikat |
| Job-tabell med SKIP LOCKED og egen worker | Convex scheduler + `@convex-dev/workpool`, `jobs`-tabell med `organizationId` for status og idempotens |
| PDF i worker | Fortsatt egen Node-worker (`pnpm worker`) fordi Convex-actions ikke kan kjøre Chromium. Workeren har en egen smal hemmelighet, ikke deploy key |
| Privat serverdisk for PDF | Convex file storage i EU. Ingen `storage.getUrl`-lenker til kunder; nedlasting via autorisert endepunkt |

**Ærlig begrensning:** En lekket deploy/admin key, en feil i en intern funksjon eller tilgang til Convex-dashboardet kan omgå tenant-skillet. Vernet er byggeklossene, lint-regelen, RLS-hjelperen og negative tester. Dette skal ikke beskrives som databasehåndhevet isolasjon.

## Konsekvenser for test
- Ren domenelogikk: Vitest uten Convex eller Next.js.
- Convex-funksjoner: `convex-test` (rask, men en etterligning av backenden).
- Integrasjonstester: mot en egen lokal Convex-backend for test med ekte Better Auth-sesjoner. Tenant-isolasjon skal bevises her, ikke bare i `convex-test`.
- E2E: Playwright mot Next.js og lokal backend.

## Versjoner ved beslutning (sjekkes og låses i oppgave 01)
Hentet fra npm 6. november 2026: `convex` 1.49.0, `@convex-dev/better-auth` 0.13.0 (krever `better-auth` >=1.7.16 <1.8.0), `better-auth` 1.7.18, `convex-helpers` 0.1.134, `convex-test` 0.0.67, `@convex-dev/workpool` 0.4.15, `next` 16.4.5, `react` 19.3.1. Pakker under 1.0 låses eksakt og oppgraderes kontrollert. Oppgave 01 velger endelige versjoner og dokumenterer dem.

## Åpne avklaringer før ekte kundedata
1. Convex sin databehandleravtale (DPA), underleverandørliste og overføringsgrunnlag. Convex Inc. er et amerikansk selskap; regionnavnet alene er ingen garanti.
2. Hvor backup, logger, metrikker og eventuell loggstrømming behandles, og om supporttilgang kan skje fra utenfor EU/EØS.
3. Hvem i teamet som har tilgang til Convex-dashboardet og deploy keys, og hvordan tilgangen fjernes.
4. Hosting for Next.js og PDF-worker i EU/EØS (avgjøres i oppgave 25).
5. Pris: EU-regionen faktureres med 1,3× standardpris (Convex-dokumentasjon, november 2026).

Kilder: [Convex regions](https://docs.convex.dev/production/regions), [Convex EU-region](https://ship.convex.dev/changelog/eu-region-hosting-dublin), [Better Auth + Convex](https://www.better-auth.com/docs/integrations/convex), [Convex local deployments](https://docs.convex.dev/cli/local-deployments), [convex-backend (åpen kildekode)](https://github.com/get-convex/convex-backend).
