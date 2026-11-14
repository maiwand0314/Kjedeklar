# 0011 – Brreg-beriking av leverandører

- **Status:** Vedtatt i oppgave 13 (november 2026)
- **Bygger på:** [0007 – Leverandørregister](0007-leverandorregister.md), [0010 – Varige bakgrunnsjobber](0010-bakgrunnsjobber.md), [0004 – Revisjonslogg](0004-revisjonslogg.md)
- **Kode:** `convex/suppliers/enrichment.ts` (tenantfunksjoner), `convex/suppliers/enrichmentJob.ts` (jobbtypen `brreg.enrich`), `convex/integrations/brreg/client.ts` (adapteren fra oppgave 06), `src/domain/suppliers/registry.ts` (status og forslag), `src/modules/suppliers/components/registry-*.tsx`
- **Tester:** `tests/convex/enrichment.test.ts`, `tests/convex/enrichment-rollback.test.ts`, `tests/unit/supplier-registry.test.ts`, `tests/integration/enrichment.test.ts`, `tests/e2e/enrichment.spec.ts`

## Hva som skjer
Brukeren ber om oppslag for én leverandør («Hent fra Enhetsregisteret») eller for alle som ikke er hentet ennå (høyst 50 om gangen). Hver leverandør får én jobb av typen `brreg.enrich`, opprettet med `enqueueJob` fra tenantmutasjonen `suppliers/enrichment:request`. Køen (fem samtidige) kjører jobben: actionen slår opp org.nr. med adapteren, og resultatet valideres med Zod før det skrives. Importen og resten av appen kan brukes mens det pågår; siden oppdaterer seg selv hvert femte sekund så lenge noe hentes.

Det finnes ingen automatisk beriking etter import: brukeren starter den selv.

## Det generelle jobbendepunktet er begrenset
`jobs/mutations:enqueue` kan nå bare opprette testtyper (`testOnly`). `brreg.enrich` finnes bare via `enrichment:request`, så kontrollene der (leverandøren må eies av organisasjonen og ha org.nr., idempotensnøkkel fra løpenummer) kan ikke omgås. Det er testet både i convex-test og mot lokal backend.

## Registerverdier er forslag, aldri stille overskriving
- Jobben skriver **bare** et `registrySnapshots`-dokument (status `fetched`, med `supplierId`) og statusen på leverandøren. Den endrer aldri navn, registreringsland eller næringskode, og den øker ikke `rowVersion`.
- Forskjellene mellom leverandøren og siste snapshot beregnes ved visning (`registrySuggestions`) og vises som forslag: navn (sammenlignet uten hensyn til store/små bokstaver), registreringsland «NO» og næringskode. Også tomme felt er forslag. Utenlandske foretak registrert i Norge (NUF) får ikke «NO» foreslått.
- Brukeren godtar ett forslag om gangen (`enrichment:applySuggestion`). Mutasjonen sjekker `rowVersion` og at forslaget fortsatt er det brukeren så (`expectedValue`), validerer profilen på nytt og skriver `supplier.updated` med begrunnelse.
- **Redigering mens jobben kjører** er trygt av samme grunn: jobben berører ikke profilen, og forslagene beregnes mot profilen slik den er når de vises.
- **Endrer org.nr.** mens jobben kjører: svaret skrives ikke (statusen peker på nummeret forespørselen gjaldt), og leverandøren står som «ikke hentet».
- Valgt bort: automatisk utfylling av ukjente felt. Brreg oppgir ikke SN-versjon, og et registreringsland utledet fra org.nr. er en tolkning. Når versjonsspørsmålet er avklart, kan utfylling av tomme felt vurderes som en egen beslutning.

## Næringskode, kodeverk og hentetid
- Brreg oppgir ikke SN-versjon (oppgave 06). Derfor lagres koden i snapshotet uten versjon (`SN`), og **brukeren velger kodeverk (SN 2007 eller SN 2025)** når koden godtas. Knappen er avslått til valget er gjort.
- Når koden godtas, lagrer leverandøren `industryCodeSource` (snapshot og hentetid) ved siden av kode og kodeverk. En kode endret for hånd mister kilden. Grensesnittet viser «tatt fra Enhetsregisteret, hentet …».
- **Manglende næringskode** gir ikke forslag og ikke noen verdi: feltet forblir ukjent, og registeravviket «Næringskode mangler i registeret» vises. Risikomodulen skal behandle ukjent bransje som datamangel, aldri lavt nivå.
- Verdiene kommer fra `fetchEnhet` og `BRREG_MAPPING_VERSION` (`brreg-enhet-v1`), som lagres på hvert snapshot.

## Registreringsstatus er ikke risiko
Konkurs, avvikling og sletting vises som tekst fra snapshotet («kontrollsignal, ikke en vurdering») og påvirker ikke noe nivå. Det finnes ingen kobling til risikomodulen.

## Status per leverandør
`suppliers.registryEnrichment` (`sequence`, `jobId`, `orgNumber`, `state`, `requestedAt`, `finishedAt?`, `snapshotId?`, `fetchedAt?`, `errorCode?`) rører ikke `rowVersion`: status er ikke en profilendring (som arkivering, beslutning 0007).

| Status | Betyr |
|---|---|
| Ikke relevant | Leverandøren har ikke norsk org.nr. Settes ikke; vises ut fra manglende org.nr. Utenlandske og manuelle leverandører fungerer som før |
| Ikke hentet | Ingen henting for gjeldende org.nr. |
| Henter | Jobben står i kø eller kjører (også mellom forsøk) |
| Hentet | Snapshot lagret |
| Ikke funnet / Fjernet | Registeret svarte 404 eller 400 / 410. Endelig svar, ikke en feil |
| Feilet | Forsøkene er brukt opp, eller feilen er ikke verdt å prøve på nytt |

Siste vellykkede snapshot og hentetid beholdes når en senere henting feiler. Er en henting «Henter» i mer enn 30 minutter regnes den som tapt, og kan bes om på nytt.

## Retry og grenser
- Adapteren kalles med én henting og 8 sekunders timeout per forsøk (`retries: 0`); køen står for nye forsøk. Jobbtypen har fire forsøk med ventetid 30 s, 2 min og 8 min (`initialBackoffMs` 30 000, `base` 4). Tilfeldig spredning fra workpool kommer i tillegg.
- Forbigående: `BRREG_TIMEOUT`, `BRREG_RATE_LIMITED` (429), `BRREG_UNAVAILABLE` (5xx og nettfeil). Ikke på nytt: `BRREG_CONTRACT_CHANGED` (svaret matcher ikke kontrakten) og `NO_ORG_NUMBER`.
- Etter siste forsøk settes jobben til `failed` og leverandøren til «Feilet» (jobbtypens `onFailed`-hook, kalt fra `finish` i samme mutasjon). Ingenting forsøkes etterpå; bruker kan be om ny henting.
- `Retry-After` fra Brreg leses ikke.

## Idempotens og dobbel innsending
Jobbens idempotensnøkkel er `leverandør:løpenummer`. En forespørsel mens en henting pågår, gir den samme jobben. Samtidige forespørsler får samme nøkkel (løpenummeret leses fra samme dokument) og dermed én jobb og ett oppslag. Etter at en jobb er ferdig gir en ny forespørsel nytt løpenummer og en ny jobb.

## Tenantvern
- Alle nye offentlige funksjoner er `tenantQuery`/`tenantMutation`; leverandør og snapshot lastes med `getOwned`. Fremmed leverandør gir `NOT_FOUND`.
- Jobben får bare jobb-id. Org.nr. leses av `orgNumberFor` (intern query) med organisasjonen fra den lagrede jobben, og `begin`/`complete` kontrollerer `inputRef` på nytt. En jobb som peker på en annen organisasjons leverandør, stoppes med `INPUT_NOT_FOUND` uten oppslag.
- Snapshot og status skrives bare i `apply` / `onFailed`, i samme mutasjon som setter jobbstatus og audit. Et svar fra en jobb som ikke lenger er leverandørens gjeldende, skrives ikke.

## Revisjonslogg
| Hendelse | Når | Aktør |
|---|---|---|
| `supplier.registry_requested` | Henting bes om | bruker |
| `supplier.registry_fetched` | Svar skrevet, eller henting feilet (feilkode som begrunnelse) | system |
| `supplier.updated` | Forslag godtatt (begrunnelse «Registerforslag godtatt: felt») | bruker |
| `job.created`, `job.succeeded`, `job.failed` | Som i 0010 | |

Diff: status og snapshot-id (`registryState`, `registrySnapshotId`) og de vanlige leverandørfeltene. Registersvaret selv står i snapshotet, ikke i loggen.

## Vurderingsgrunnlag
Risikomodulen finnes ikke ennå. Når den kommer, er kjente signaler for «grunnlaget er endret»: `rowVersion` på leverandøren (bumpes når et forslag godtas), og `registryEnrichment.snapshotId`/`fetchedAt` (nytt snapshot, f.eks. endret registerstatus). Ingenting merkes utdatert i dag.

## Test av Brreg
- convex-test og enhetstester bruker en falsk `fetch` (`tests/helpers/fake-brreg.ts`).
- Mot lokal backend leser adapteren `BRREG_ENHET_URL` bare når `KJEDEKLAR_ENV=test` og deploymenten er lokal. `scripts/local-convex.mjs` setter den på test-backenden til `host.docker.internal:38100`, hvor integrasjons- og e2e-testene kjører en liten falsk Brreg-tjeneste (`compose.yml`: `extra_hosts` på `convex-test`). Utenfor lokal test brukes alltid Enhetsregisteret.
- Ekte Enhetsregisteret er ikke kalt i testene.

## Kjente begrensninger
- Registerverdier fylles aldri ut automatisk, og forslag kan ikke avvises (de står til de godtas eller profilen er lik).
- Bare hovedkoden `naeringskode1` hentes. SN-versjonen må velges av brukeren.
- «Hent for alle» leser de første 2 000 aktive leverandørene og tar 50 om gangen. Leverandører som har feilet, hentes ikke på nytt av «alle».
- Statusen oppdateres ved å laste siden på nytt hvert femte sekund; ingen sanntidsabonnement.
- Jobber vises fortsatt ikke i grensesnittet utover status per leverandør.
