# 0004 – Revisjonslogg

- **Status:** Vedtatt i oppgave 05 (november 2026)
- **Bygger på:** [0002 – Tenantgrensen](0002-tenant-boundary.md), [0003 – Kontolivssyklus](0003-kontolivssyklus.md)
- **Kode:** `convex/lib/audit.ts`, `convex/lib/auditTypes.ts`, `convex/audit/queries.ts`, `convex/schema.ts` (`auditEvents`)
- **Bevis:** `tests/convex/audit.test.ts`, `tests/unit/audit-append-only.test.ts`, `tests/integration/audit.test.ts`

## Beslutning
- **Atomisk:** Hver forretningsendring skriver en `auditEvents`-rad med `writeAudit(ctx, …)` i samme Convex-mutasjon og med samme `ctx.db`. Kaster mutasjonen, enten i endringen, i loggingen eller etterpå, rulles både endringen og loggen tilbake. Det finnes ingen egen logg-transaksjon og ingen asynkron logging.
- **Felter:** organisasjon (tenant), aktør (`user` med Better Auth-id, eller `system` for operatørfunksjoner), hendelse, objekttype og -id, tidspunkt (`Date.now()` i mutasjonen, UTC-millisekunder), `requestId` og trygg diff. `reason` er med når det kreves.
- **Trygg diff:** `safeDiff` tar bare felter fra `AUDIT_DIFF_FIELDS`:

| Objekttype | Felter |
|---|---|
| organization | `name`, `status`, `orgNumber`, `legalForm`, `industryCode` |
| membership | `role`, `status` |
| invitation | `status`, `expiresAt` |
| applicability | `result`, `ruleVersion` |
| reportingPeriod | `startDate`, `endDate`, `publicationDueDate`, `status` |
| businessProfile | `revision`, `confirmed` og status per tema (`described`/`not_established`/`unknown`), aldri svarteksten |

  Aldri passord, token, tokenhash, e-postadresser eller fritekst. Objekter og lister utelates. En invitasjon identifiseres med id, ikke e-post.
- **Logget nå:**

| Hendelse | Utløses av | Aktør |
|---|---|---|
| `organization.renamed` | admin endrer navn | bruker |
| `organization.provisioned` | operatør-bootstrap | system |
| `organization.registry_confirmed` | admin bekrefter Brreg-opplysninger (oppgave 06) | bruker |
| `applicability.assessed` | admin lagrer pliktvurdering (oppgave 07) | bruker |
| `reporting_period.created` | admin oppretter rapportperiode (oppgave 08) | bruker |
| `business_profile.saved` | admin lagrer ny versjon av virksomhetsprofilen (oppgave 08) | bruker |
| `invitation.created` / `invitation.renewed` / `invitation.revoked` | admin | bruker |
| `invitation.created` | operatør-bootstrap | system |
| `invitation.accepted` og `membership.created` / `membership.status_changed` | aksept | aksepterende bruker |
| `membership.created` / `membership.status_changed` | interne `ops/organizations`-funksjoner | system |

  Selve e-postsendingen (`attachToken`) logges ikke, fordi den bare håndterer token.
- **Visning:** Innstillinger → Revisjonslogg (`audit/queries:list`, `tenantQuery`):
  - nyeste først, 25 per side, med «Vis eldre»;
  - filter på objekttype;
  - indekser som starter med `organizationId`;
  - aktør vises med navn, ikke e-post.

## Append-only i appen
- RLS-reglene nekter endring av `auditEvents` i alle byggeklosser: tenant, bruker og invitasjon. Tenantfunksjoner kan bare legge til i egen organisasjon. Invitasjonsaksept kan bare legge til i invitasjonens organisasjon og kan ikke lese loggen.
- En statisk test (`tests/unit/audit-append-only.test.ts`) feiler hvis noen Convex-fil gjør `patch`/`replace`/`delete` på `auditEvents`, eller setter inn rader utenfor `convex/lib/audit.ts`. Den krever også at alle `db.patch`/`db.replace`/`db.delete` i `convex/` navngir tabellen. Formen uten tabellnavn (`db.delete(id)`) ville ellers kunne slette en logglinje uten at testen ser det.
- Registeret over offentlige funksjoner har bare en lesefunksjon for loggen. Det finnes ingen kundeknapp for å endre eller slette historikk.
- **Nye mutasjoner må logge:** `tests/helpers/audited-mutations.ts` klassifiserer hver mutasjon som `logged` eller `exempt` med begrunnelse. `tests/unit/audit-registry.test.ts` feiler for en mutasjon som ikke er klassifisert, og for en `logged`-mutasjon i en fil som ikke skriver revisjonslogg.

## Hva dette ikke beskytter mot
Loggen er append-only i applikasjonen, ikke uforanderlig i absolutt forstand. Den kan endres eller slettes av:
- noen med **deploy key eller admin key**, som kan kjøre vilkårlige funksjoner og importere data;
- **Convex-dashboardet**, som gir direkte redigering av tabeller;
- en ny **intern funksjon** som noen skriver. Den statiske testen og review skal fange det, men de er ikke et formelt bevis.

Begrens og roter derfor nøkler og dashboardtilgang (beslutning 0001). For et sterkere bevis kan loggen senere eksporteres periodisk til lagring som ikke kan overskrives (for eksempel object lock i EU). Det er ikke bygget.

## Kontrollert vedlikehold og sletting
Endring eller sletting av revisjonslogg er ingen kundefunksjon. Det skjer bare gjennom en dokumentert operatørprosess:
1. **Grunnlag:** Det må finnes et skriftlig grunnlag, for eksempel en avtalt lagringstid som er utløpt, en sletteforespørsel etter personvernregelverket eller retting av en feil. Det godkjennes av en annen person enn den som utfører.
2. **Eksport:** Berørte rader eksporteres før endringen (Convex-eksport), og eksporten lagres kryptert i EU/EØS.
3. **Utførelse:** Operatøren bruker en egen intern vedlikeholdsfunksjon skrevet for den konkrete saken, med `organizationId`, avgrensning og begrunnelse som argumenter. Funksjonen kjøres med deploy key og fjernes etter bruk. Den statiske testen må da midlertidig unntas i en egen, reviewet endring.
4. **Spor:** Dato, utførende, godkjenner, grunnlag og antall rader føres i en driftslogg utenfor appen.

Lagringstid, pseudonymisering og kundeeksport avklares i oppgave 27. Inntil da slettes ingen revisjonslogg.

## Kjente begrensninger
- `requestId` er en UUID per hendelse. Convex gir ikke funksjoner en id per forespørsel, så hendelser fra samme kall kan ikke kobles sammen.
- Aktørens navn hentes fra Better Auth ved visning. Endrer brukeren navn, vises det nye navnet; bruker-id i loggen er uendret.
