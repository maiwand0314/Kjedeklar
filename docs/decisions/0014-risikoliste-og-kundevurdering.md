# 0014 – Risikoliste, forklaring og kundens vurdering

- **Status:** Vedtatt i oppgave 16 (november 2026)
- **Bygger på:** [0013 – Risikomotor og lagrede vurderinger](0013-risikovurdering.md), [risk-method-v0](risk-method-v0.md), [0004 – Revisjonslogg](0004-revisjonslogg.md)
- **Kode:** `src/domain/risk/review.ts` (ren logikk), `src/domain/risk/labels.ts`, `convex/risk/reviews.ts`, `src/modules/risk/`, rutene under `src/app/(app)/o/[organizationId]/risikovurderinger/`
- **Tester:** `tests/unit/risk-review.test.ts`, `tests/convex/risk-review.test.ts`, `tests/convex/risk-review-rollback.test.ts`, `tests/integration/risk-review.test.ts`, `tests/e2e/risk.spec.ts`

## To nivåer, alltid side om side
**Screeningen** er motorens resultat (`riskAssessments`) og endres aldri her. **Kundens vurdering** er et eget valg ved siden av: en bekreftelse, en overstyring eller en tilbaketrekking, lagret som en ny rad i `assessmentReviews`. Grensesnittet viser begge samtidig, og en overstyring skjuler verken opprinnelig nivå, datamangler, kontrollsignaler eller ukjent oppstrøms: de står i samme visning.

Screeningen er prioriteringsstøtte. En bekreftelse eller overstyring er kundens interne vurdering, ikke en bekreftet vurdering av rettigheter eller konsekvenser, og blir aldri automatisk et funn (det kommer i oppgave 17).

## `assessmentReviews`
Append-only: ny rad per beslutning, aldri endret eller slettet (RLS nekter endring fra tenantfunksjoner). Felt: `assessmentId` (screeningen som ble vurdert), `supplierId` og `reportingPeriodId` (kopiert fra den, for indeksen), `decision` (`confirm`/`override`/`revoke`), `originalLevel` (screeningnivået da kunden valgte), `chosenLevel` (bare ved overstyring), `previousReviewId`, `rationale`, `evidenceNote?`, `actorId`, `reviewedAt` (server). Indeks: organisasjon, periode, leverandør, `reviewedAt`.

**Gjeldende vurdering** er den siste raden for leverandøren i perioden. Historikken er alle radene (visningen viser de siste 20).

## Regler i `risk/reviews:record`
- **Begrunnelse kreves for alle tre valg** og må være en forklaring: minst 20 tegn og fire ord, minst tre ulike ord, høyst 2 000 tegn (`checkRationale`). Kontrollen stopper det åpenbart tomme («ok ok ok»). Den kan ikke avgjøre om innholdet er riktig; det er kundens ansvar. Feilkode `RATIONALE_INVALID`. Samme regel i skjemaet (rask tilbakemelding) og i Convex (autoritativ).
- **Overstyring** velger `low`, `moderate` eller `high` og må være forskjellig fra screeningen (er den lik, er det en bekreftelse). «Ukjent» er ikke et valg: det er mangel på vurdering. Bekreftelse og tilbaketrekking velger ikke nivå.
- **Referanser:** leverandør, periode og vurdering lastes med `getOwned`. En vurdering som hører til en annen leverandør eller periode (også i samme organisasjon) gir samme `NOT_FOUND`.
- **Optimistisk låsing:** kallet oppgir `expectedReviewId`, vurderingen brukeren så som gjeldende (eller `null`). Er den en annen i mutasjonen, avvises kallet (`CONFLICT`). To samtidige kall mot samme gjeldende vurdering gir én vinner, og den andre får `CONFLICT`; ingen stille siste-skriver-vinner. Samme `CONFLICT` hvis vurderingen er byttet ut av en nyere screening siden visningen.
- **Utdatert grunnlag:** bekreftelse og overstyring avvises med `REVIEW_STALE` når screeningen er utdatert (endret leverandør, innkjøpsdata, registerstatus, metode eller data; se 0013). Tilbaketrekking er alltid mulig mot en gjeldende vurdering, siden den bare fjerner kundens vurdering.
- Raden og revisjonshendelsen `risk.reviewed` skrives i samme mutasjon. Kaster loggingen, lagres ingen vurdering (egen rollback-test).

## Kundens vurdering blir utdatert, ikke omskrevet
Effektiv vurdering (`effectiveReview`) regnes ut ved lesing:

| Tilstand | Når | Kundens nivå |
|---|---|---|
| `none` | ingen vurdering lagret | – |
| `confirmed` | siste valg er bekreftelse, og den gjelder siste, gjeldende screening | screeningens nivå |
| `overridden` | siste valg er overstyring, og den gjelder siste, gjeldende screening | valgt nivå |
| `revoked` | siste valg er tilbaketrekking | – |
| `outdated` | vurderingen gjelder en eldre screening, eller screeningen er utdatert | – (krever ny bekreftelse) |

En utdatert vurdering vises fortsatt i historikken med begrunnelsen, men gjelder ikke. Innkjøpsbeløp endrer ingenting av dette.

## Listen
`risk/reviews:list` (`tenantQuery`): risikoprioritert rekkefølge og tellinger for en periode i egen organisasjon.
- **Rekkefølge:** nivå først i metodens `priorityOrder` (standard: høy, ukjent, moderat, lav) med «ikke vurdert» rett etter «ukjent»; deretter innkjøpsbeløp fallende innenfor samme nivå. Kjent beløp (også 0) kommer før ukjent beløp, som vises som «Beløp ukjent». Beløpet kan aldri flytte en leverandør til et annet nivå (enhetstest over alle kombinasjoner, og e2e der lav har det klart største beløpet).
- **Sorteres etter screeningen**, ikke kundens vurdering: en overstyring til lavt nivå flytter ikke en høy screening ned i listen.
- **Egne grupper:** «Ukjent – krever oppfølging» og «Ikke vurdert – kjør screening» har egne overskrifter. Ingenting er lav ved mangel.
- **Tellinger** gjelder alle aktive leverandører i perioden uavhengig av filter, og skiller screening (høy/ukjent/ikke vurdert/moderat/lav) fra kundens vurdering (ikke gjennomgått/bekreftet/overstyrt/trukket tilbake/utdatert).
- **Filter:** nivå, kundens vurdering og starten av navnet. **Paginering:** 50 per side (høyst 100 per kall), `offset`.
- **Arbeid per kall:** listen sorteres på tvers av alle aktive leverandører, så den leser dem alle (høyst `LIST_SUPPLIER_LIMIT` = 2 000, importgrensen). For hver leverandør leses leverandøren, siste screening og periodens innkjøpsdata. Bare leverandører med en kundevurdering og radene på siden får full kontroll av om grunnlaget er endret, og kundens vurderinger leses samlet. Målt mot lokal backend: 1 990 leverandører i en spørring tok 1,3 s inkludert nettverk. En tidligere variant som kontrollerte grunnlaget for hver leverandør, gikk i 1 000 (1,1 s) men feilet i 2 000. Over grensen settes `truncated`, og siden sier at listen ikke er komplett. Siden hentes på serveren per sidevisning, ikke som abonnement.
- **«Utdatert»-flagget** per rad vises for radene på siden og for leverandører med en kundevurdering. Tellingen «utdatert» gjelder derfor kundens vurderinger, ikke alle screeninger.

## Forklaring (`risk/reviews:detail`)
Én leverandør i én periode: screening og kundens vurdering side om side, regler som slo ut (regel-id, faktor, input, nivå, kilde med datasettversjon og linje, og beskrivelsen fra metodeversjonen som ble brukt), mangler med forklaring, kontrollsignaler, kilder som ikke er fullt gjennomgått, årsaker hvis screeningen er utdatert, og historikken med bruker og tidspunkt. Brukernavn slås opp ved visning; loggen og raden lagrer bare id.

## Revisjonslogg
`risk.reviewed` (entitet `assessmentReview`): valg, opprinnelig nivå, valgt nivå og screeningens id, med forrige vurdering som «før». Begrunnelsen og henvisningen står på vurderingen, ikke i loggen (samme regel som virksomhetsprofilen: fritekst logges ikke).

## Kjente begrensninger
- **Ingen sanntidsoppdatering:** siden hentes på serveren, og en annen brukers lagring vises først ved oppdatering. Låsingen gjør at ingen overskriver uten å vite det.
- **Begrunnelsessjekken er syntaktisk.** Den stopper tomme og gjentatte tekster, ikke dårlige.
- **Listen leser opptil 2 000 leverandører per kall** og er målt bare mot lokal backend, ikke Convex Cloud.
- **Ingen eksport** av listen og ingen kobling til funn og tiltak (oppgave 17).
- **Kundevurdering finnes bare per leverandør i en periode.** Ingen flervalg og ingen kommentartråd.
- **Ingen rolle utover admin** (MVP).
