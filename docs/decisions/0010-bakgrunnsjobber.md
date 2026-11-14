# 0010 – Varige bakgrunnsjobber

- **Status:** Vedtatt i oppgave 12 (november 2026)
- **Bygger på:** [0002 – Tenantgrensen](0002-tenant-boundary.md), [0004 – Revisjonslogg](0004-revisjonslogg.md)
- **Kode:** `convex/jobs/`, `convex/convex.config.ts` (komponenten `jobWorkpool`)
- **Tester:** `tests/convex/jobs.test.ts`, `tests/convex/jobs-rollback.test.ts`, `tests/integration/jobs.test.ts`, `tests/unit/next-no-admin-key.test.ts`

## Hva mekanismen er
En liten jobbmekanisme for arbeid som ikke kan gjøres i én mutasjon: Brreg-oppslag i bolk (oppgave 13), AI (oppgave 19) og PDF (oppgave 24). Den består av `jobs`-tabellen, en liste over tillatte jobbtyper og køen `@convex-dev/workpool` 0.4.15 (låst versjon; 0.4.16 var én dag gammel da den ble valgt bort).

Det er ikke et generelt automasjonssystem. Det finnes ingen egen kø og ingen egen workerprosess. Jobbtyper: `brreg.enrich` (oppgave 13, se [0011](0011-brreg-beriking.md)) og en kontrollert testtype.

## Livsløp
1. **Opprettelse:** en tenantmutasjon kaller `enqueueJob` (`convex/jobs/model.ts`). Det generelle endepunktet `jobs/mutations:enqueue` kan bare opprette testtyper; jobber for produksjon opprettes av egne tenantmutasjoner. Den slår opp typen i listen over tillatte handlere, laster `inputRef` med `getOwned`, og slår opp (organisasjon, type, `idempotencyKey`) i indeksen. Finnes jobben, returneres den uten ny kjøring. Ellers settes jobben inn, legges i køen og logges, alt i samme transaksjon.
2. **Forsøk:** køen kaller den interne actionen `jobs/run:run` med bare jobb-id-en.
   - `begin` (intern mutasjon) laster jobben, kontrollerer typen og referansen på nytt, øker `attempts` og setter status `running`.
   - Handleren gjør arbeidet i actionen.
   - `complete` (intern mutasjon) validerer resultatet, skriver det og setter `succeeded`.
3. **Feil:** `attemptFailed` registrerer feilkode og tidligste neste forsøk, og feilen kastes videre så køen prøver igjen.
4. **Sluttstatus:** `completed` kalles av køen når den er ferdig med jobben, også når den har gitt opp, og setter `failed` hvis jobben ikke alt har sluttstatus. Settes `failed`, kaller sluttstatusen jobbtypens valgfrie `onFailed`-hook i samme mutasjon, så typens egne data kan vise feilen.

Status er `queued`, `running`, `succeeded` eller `failed`.

## Sikkerhetsgrenser
- **Tillatte handlere:** `convex/jobs/handlers.ts` er eneste kilde til hvilke typer som finnes. En ukjent type avvises ved opprettelse (`INVALID_INPUT`), også innebygde navn som `constructor`. En lagret jobb med ukjent type får sluttstatus `UNKNOWN_HANDLER` uten at noe kjøres.
- **Tenant fra den lagrede jobben:** køen får bare jobb-id-en. Organisasjon, type og referanse leses fra jobbdokumentet i en intern mutasjon, aldri fra argumenter.
- **`inputRef` med `getOwned`:** ved opprettelse, ved start av hvert forsøk og før resultatet skrives. En referanse som er slettet eller tilhører en annen organisasjon, gir sluttstatus `INPUT_NOT_FOUND`.
- **Interne funksjoner:** `begin`, `attemptFailed`, `complete`, `completed` og `run` er interne og kan ikke kalles fra klienter. Integrasjonstesten har én probe per funksjon.
- **RLS:** tenantfunksjoner kan lese og opprette jobber i egen organisasjon, men aldri endre dem. Status endres bare av de interne funksjonene.
- **Status** leses bare med `jobs/queries:get` og `:list` (`tenantQuery`).
- **Ingen admin key i Next.js:** `tests/unit/next-no-admin-key.test.ts` kontrollerer statisk at koden Next.js bygger, ikke leser deploy key, admin key eller env-filene til Convex CLI, og ikke importerer interne funksjoner.

## Idempotens
- **Dobbel innsending** gir én jobb. Indeksoppslaget og innsettingen er i samme transaksjon, så to samtidige kall gir også én jobb.
- **Samme nøkkel for et annet dokument** avvises (`CONFLICT`). Det er en forveksling, ikke et nytt forsøk.
- **Actions er ikke «nøyaktig én gang».** De kan kjøre flere ganger, og et svar kan komme sent. Derfor:
  - ingen intern funksjon endrer en jobb som har sluttstatus;
  - resultatet skrives høyst én gang, i samme mutasjon som setter `succeeded`;
  - et gammelt forsøk som melder feil etter at et nyere har startet, overskriver ikke.
- **Handlere må selv være idempotente mot omverdenen.** Mekanismen hindrer dobbel skriving i databasen, ikke at et eksternt kall gjøres to ganger.

## Forsøk og ventetid
- Hver jobbtype oppgir `maxAttempts`, `initialBackoffMs` og `base`. Workpool står for ventetiden (med tilfeldig spredning) og for parallellgrensen (fem samtidige).
- `attempts` teller forsøk som faktisk har startet. `runAfter` er tidligste neste forsøk slik jobben selv regner det; køens faktiske tidspunkt kan være noe senere.
- En handler kan kaste `JobError(kode)` for en kjent feil, og `JobError(kode, false)` for en feil som ikke skal prøves på nytt.
- Etter siste mislykkede forsøk får jobben `failed` med feilkoden fra forsøket. Som ekstra sikring starter ikke `begin` et forsøk utover `maxAttempts`.

## Feilkoder
`errorCode` er en kort kode, aldri en feilmelding. Uventede feil blir `UNEXPECTED`, og bare koden kastes videre til køen, så feilmeldinger med innhold ikke havner i jobben, revisjonsloggen eller køens logg.

| Kode | Betyr |
|---|---|
| handlerens egen kode | Kjent feil fra jobbtypen |
| `UNEXPECTED` | Uventet feil i handleren |
| `INVALID_OUTPUT` | Resultatet hadde feil form og ble ikke skrevet |
| `INPUT_NOT_FOUND` | Referansen finnes ikke lenger i jobbens organisasjon |
| `UNKNOWN_HANDLER` | Typen finnes ikke i listen over tillatte handlere |
| `MAX_ATTEMPTS` | Forsøkene var brukt opp før et nytt startet |
| `ACTION_FAILED` | Actionen ble avbrutt uten å melde en kode |
| `RESULT_MISSING` | Actionen ble ferdig uten å skrive resultat |
| `CANCELED` | Jobben ble avbrutt i køen |

## Testtypen
`test.probe` (`convex/jobs/testHandler.ts`) er den eneste typen foreløpig. Referansen er en leverandør, og leverandørens egen ID styrer om forsøkene feiler. Typen kan bare opprettes når `KJEDEKLAR_ENV` er `test` på en lokal backend; ellers svarer opprettelsen som for en ukjent type. Grensene er korte (tre forsøk, 100 ms ventetid), så integrasjonstesten ser alle forsøkene uten lange pauser.

## Revisjonslogg
| Hendelse | Når | Aktør |
|---|---|---|
| `job.created` | Jobben opprettes | bruker |
| `job.succeeded` | Resultatet er skrevet | system |
| `job.failed` | Sluttstatus etter siste forsøk eller en stoppende feil | system |

Diff: type, status, forsøk, maks forsøk og feilkode. Hvert enkelt forsøk logges ikke.

## Kjente begrensninger
- Bare én jobbtype for produksjon (`brreg.enrich`). Flere kommer med oppgavene som trenger dem.
- Ingen visning av jobber i grensesnittet; bare spørringene finnes.
- Jobber kan ikke avbrytes eller startes på nytt av brukeren.
- `leaseUntil` og `lockedBy` fra den opprinnelige datamodellen er ikke med. De hører til PDF-workeren (oppgave 24).
- Workpool logger funksjonsnavn og id-er på nivå `WARN`. Loggplassering hos Convex er en del av avklaringene i beslutning 0001.
- Workpool er under 1.0. Oppgradering gjøres kontrollert med ny låst versjon.
