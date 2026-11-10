# Kjedeklar

Norsk SaaS for arbeidet med åpenhetsloven. Next.js (App Router) er grensesnittet og Convex er backend. Arkitektur og regler står i [CLAUDE.md](CLAUDE.md), [docs/ARKITEKTUR.md](docs/ARKITEKTUR.md) og [docs/decisions/0001-convex-eu.md](docs/decisions/0001-convex-eu.md). Status står i [docs/STATUS.md](docs/STATUS.md).

Dette er en lokal grunnmur (oppgave 01). Den inneholder bare syntetiske data og har ingen produksjonsdeploy.

## Krav
- Node.js 24 LTS og pnpm 10 (`corepack enable` gir riktig pnpm fra `packageManager`)
- Docker Desktop eller Docker Engine med Compose

Du trenger ingen Convex-konto for lokal utvikling. Lokalt kjører Convex sin åpne backend i Docker.

## Kom i gang fra ren klon
```bash
pnpm install --frozen-lockfile
docker compose up -d convex mailpit
pnpm convex:deploy:local
pnpm seed:dev
pnpm dev
```
Åpne http://localhost:3000 og logg inn som en av de syntetiske brukerne:
- `anna.admin@nordlys.example` (Nordlys Testvarer AS)
- `bjorn.admin@fjordlys.example` (Fjordlys Syntetisk AS)

Passordet ble generert lokalt og står som `SEED_USER_PASSWORD` i `.env.convex-dev.local`.

Hva `pnpm convex:deploy:local` gjør (`scripts/local-convex.mjs`):
1. Genererer admin key for den lokale backenden med `docker compose exec convex ./generate_admin_key.sh` og skriver den til `.env.convex-dev.local`. Filen leses bare av Convex CLI.
2. Lager `.env.local` med offentlige Next.js-variabler hvis den mangler.
3. Setter `BETTER_AUTH_SECRET` (tilfeldig), `SITE_URL`, `KJEDEKLAR_ENV=development` og `SEED_USER_PASSWORD` på deploymenten.
4. Pusher skjema og funksjoner (`convex dev --once`).

Next.js leser aldri admin key. Alle `.env*`-filer unntatt `.env.example` er ignorert av git.

Nyttige adresser lokalt:
- Mailpit: http://localhost:8025 (all lokal e-post: invitasjoner, reset, bekreftelse)
- Convex dev-backend: http://127.0.0.1:3210, med HTTP-/auth-ruter på 3211

## Kontoer, invitasjon og passord (oppgave 03)
Det finnes ingen åpen registrering. En ny kunde opprettes av en operatør, som først har kontrollert at mottakeren tilhører virksomheten:
```bash
pnpm exec convex run ops/workspaces:provision '{"organizationName":"Eksempel AS","adminEmail":"admin@eksempel.example"}' --env-file .env.convex-dev.local
```
Invitasjonen havner i Mailpit. Lenken (`/invitasjon#token=…`) lar mottakeren velge passord eller godta med en eksisterende konto. Etterpå kan en admin invitere flere administratorer fra organisasjonssiden. «Glemt passord?» på innloggingssiden sender en reset-lenke. Nytt passord logger ut alle sesjoner.

Engangstoken står bare i URL-fragmentet og sendes i POST-body, aldri i URL-er som når en server. Ratebegrensningen gjelder per klient-IP via Next.js-proxyen. Se [beslutning 0003](docs/decisions/0003-kontolivssyklus.md).

## Kommandoer
| Kommando | Hva |
|---|---|
| `pnpm dev` | Next.js + `convex dev` (watch) mot lokal dev-backend |
| `pnpm convex:setup:local` | Bare admin key og miljøvariabler, uten push |
| `pnpm convex:deploy:local` | Oppsett og push til dev-backend |
| `pnpm seed:dev` | Syntetiske organisasjoner og brukere. Nekter å kjøre hvis ikke `KJEDEKLAR_ENV=development` og lokal URL |
| `pnpm lint` | ESLint, inkludert forbud mot rå `query`/`mutation`/`action` i `convex/` |
| `pnpm typecheck` | `next typegen` + TypeScript for app og Convex |
| `pnpm test:unit` | Vitest: ren logikk og `convex-test` |
| `pnpm test:integration` | Deployer til separat test-backend og kjører tester mot den |
| `pnpm test:e2e` | Playwright mot Next.js (port 3100) og test-backend |
| `pnpm build` | Produksjonsbygg av Next.js |

## Separat test-backend
Integrasjons- og e2e-tester bruker en egen Convex-backend, `convex-test` i `compose.yml`. Den lytter på 3220/3221 og har data i tmpfs:
```bash
docker compose up -d convex-test
pnpm test:integration
pnpm exec playwright install chromium   # første gang
pnpm test:e2e
```
`test:integration` kjører `node scripts/local-convex.mjs test deploy` først. Testfixtures (`ops/testing:createTenantFixture`) bruker en unik suffix per kjøring og nekter å kjøre hvis ikke `KJEDEKLAR_ENV=test` og lokal URL. En `docker compose restart convex-test` gir en tom backend.

## Struktur
```text
convex/               # skjema, auth og funksjoner
  lib/tenant.ts       # tenantQuery / tenantMutation / userQuery / getOwned
  organizations/      # offentlige queries
  ops/                # interne funksjoner: bootstrap, seed, testfixtures
src/app/              # Next.js-ruter: /logg-inn, /, /o/[organizationId], /api/auth/*
src/lib/              # Better Auth-klient/-server, env-validering
src/modules/auth/     # innloggings- og utloggingskomponenter
tests/{unit,convex,integration,e2e,helpers}/
```

## Versjoner (låst 6. november 2026)
| Pakke | Versjon |
|---|---|
| next | 16.4.5 |
| react / react-dom | 19.3.0 |
| convex | 1.49.0 |
| better-auth | 1.7.18 |
| @convex-dev/better-auth | 0.13.0 (under 1.0, låst eksakt) |
| convex-helpers | 0.1.134 |
| convex-test | 0.0.67 |
| vitest | 5.1.0 |
| @playwright/test | 1.65.0 |
| zod | 4.6.7 |
| nodemailer | 10.3.1 |
| typescript | 5.9.3 |
| papaparse | 5.7.0 (lagt til 10. november 2026 for CSV-import, se beslutning 0008) |

Docker-images er låst til revisjon og digest i `compose.yml`:
- `ghcr.io/convex/convex-backend:1447815c…` (commit fra 22. oktober 2026). Convex publiserer self-hosted bare som rullerende revisjoner. Vi velger derfor bevisst en revisjon som er minst to uker gammel, og oppgraderer kontrollert ved å bytte tag og digest.
- `axllent/mailpit:v1.32.0`

GitHub Actions er låst til commit-SHA.

## Viktige valg i grunnmuren
- Åpen registrering er av (`disableSignUp`). Brukere og medlemskap opprettes bare via invitasjon eller interne funksjoner.
- Organisasjons-id i URL er bare en kandidat. Convex verifiserer sesjon, aktivt medlemskap og rolle. Fremmed, ukjent og inaktiv organisasjon gir samme «Ikke funnet».
- `ctx.db` i tenantfunksjoner er pakket inn med RLS-hjelperen fra convex-helpers (default-deny). Tenantfunksjoner kan ikke endre `organizations` eller `memberships`.
- Next.js Cache Components er ikke slått på. Alle svar får `Cache-Control: private, no-store`.
- Ingen ekstern fonttjeneste. Telemetri fra lokal Convex-backend er slått av (`DISABLE_BEACON`).
- Better Auths ratebegrensning er på per klient-IP. Klient-IP godtas bare fra Next.js-proxyen med `AUTH_PROXY_SECRET` (beslutning 0003).

Convex har ikke radpolicyer i databasen. Admin/deploy key, interne funksjoner og dashboardtilgang går utenom tenantvernet (se beslutning 0001).
