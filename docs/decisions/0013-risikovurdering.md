# 0013 – Deterministisk risikomotor og lagrede vurderinger

- **Status:** Vedtatt i oppgave 15 (november 2026)
- **Bygger på:** [0012 – Versjonerte risikodata](0012-risikodata.md), [risk-method-v0](risk-method-v0.md), [0007 – Leverandørregister](0007-leverandorregister.md), [0011 – Brreg-beriking](0011-brreg-beriking.md)
- **Kode:** `src/domain/risk/engine.ts` (ren motor), `convex/risk/assessments.ts` (lagring og lesing), `convex/risk/model.ts`, `convex/risk/internal.ts` (`engineData`)
- **Tester:** `tests/unit/risk-engine.test.ts`, `tests/convex/risk-assess.test.ts`, `tests/convex/risk-assess-rollback.test.ts`, `tests/integration/risk-assess.test.ts`

Dette er Kjedeklars screening: prioriteringsstøtte, ikke en juridisk vurdering og ikke bevis mot en leverandør. Den krever faglig gjennomgang av metode og data før kundebruk (se risk-method-v0).

## Motoren
`assess(input, data)` er en ren funksjon: ingen Convex, Next.js, AI, nettverk eller klokke (kildenes `freshness` regnes ut av kalleren). Samme input og versjoner gir identisk resultat, også med land i annen rekkefølge.

**Input (`EngineInput`)** er normalisert: næringskode med kodeverk, kjente produksjonsland (sortert, uten duplikater), om leddene bak leverandøren er ukjente, kjøpskategori (små bokstaver) og siste hentede registerstatus (konkurs, avvikling, tvangsavvikling, slettet; `null` = ukjent). **Beløp og registreringsland er ikke input**, og kommer derfor aldri inn i snapshot eller hash. Beløp kan altså ikke påvirke nivå, og et registreringsland kan ikke erstatte ukjent produksjonsland.

**Nivå** (metodens regler, i rekkefølge):
1. Kjent høy faktor gir `high`, uansett mangler og lavere faktorer.
2. Ellers gir en vesentlig mangel `unknown`. Hvilke mangler som er vesentlige (`productionCountry`, `industryCode`, `productCategory`) står i metodens `unknownPolicy.materialGaps`, ikke i koden.
3. Ellers høyeste kjente nivå.
4. Uten noen kjent faktor er nivået `unknown`, aldri lavt.

**Faktorer** hentes bare for dimensjoner metoden har en regel for (`risk_factor`):
- *Land:* ett treff per kjent produksjonsland. Tom liste er mangel. Land som ikke finnes i datasettet er en dekningsmangel (`not_covered`), ikke lav risiko. Manglende datasett er `source_unavailable`.
- *Bransje:* eksakt kode først, ellers lengste prefiks. Kodeverket til leverandøren må være det samme som datasettets (`SN2007` ≠ `SN2025` ≠ `NACE2`); ellers ingen mapping og mangelen `code_system_mismatch`. Ingen oversettelse mellom kodeverk. Kode uten mapping er `not_covered`.
- *Produkt:* leverandørperiodens kjøpskategori (normalisert) mot `productCategory` i bransjedatasettet. Bransjekoden brukes aldri som produkt.
- Hver regel lagres med `ruleId`, input (landkode, kode, kategori) og kildereferanse (datasettets versjon, hvilken linje som traff, og linjens `sourceReference`).

**Kontrollsignaler** (metodens `control_signal`): registerstatus og datamangel gir oppfølging, aldri et nivå. Registerstatus er et administrativt signal, ikke bevis på brudd.

**Datakvalitet** er adskilt fra nivå: `insufficient` når nivået er ukjent, `incomplete` når nivået er kjent men noe mangler (inkludert ukjent oppstrøms og kilder som ikke er gjennomgått), ellers `complete`. En utgått eller ugjennomgått kilde (`staleSources`) fjerner ikke kjente faktorer; den er synlig og hindrer `complete`.

## Lagring
`riskAssessments` er en ny rad per beregning og endres aldri (RLS nekter endring; ingen funksjon sletter). Raden har `inputSnapshot` og `inputHash` (SHA-256 av kanonisk JSON), referanser til metode- og datasettversjonene, `engineVersion`, resultatet, tidspunkt (server) og bruker. En vurdering kan gjenskapes ved å kjøre motoren på snapshotet med de refererte versjonene (som forblir lesbare etter pensjonering). Leverandør uten innkjøpsdata for perioden vurderes med ukjent oppstrøms og ingen land, og får ikke `supplierPeriodId`.

## «Utdatert» regnes ut ved lesing
Gamle rader merkes ikke; `risk/assessments:latest` sammenligner siste vurdering med gjeldende grunnlag og gir `status: "stale"` med årsaker:

| Årsak | Betyr |
|---|---|
| `input_changed` | Leverandørprofil, periodens innkjøpsdata (land, oppstrøms, kategori) eller registerstatus har endret seg (hash) |
| `method_changed` | Aktiv metodeversjon er en annen |
| `country_data_changed`, `industry_data_changed` | Aktivt datasett er et annet |
| `engine_changed` | `ENGINE_VERSION` er endret |
| `source_freshness_changed` | En kilde har passert forfallsdatoen, eller er gjennomgått på nytt, etter vurderingen |

Dette er også vurderingsgrunnlaget som oppgave 13 sa skulle merkes endret når risikomodulen fantes: endret registerstatus og nytt snapshot gir `input_changed`.

En utdatert vurdering gjelder fortsatt slik den ble regnet. `assessPeriod` lager en ny rad ved siden av den; uendrede leverandører får ingen ny rad (`unchanged`).

## Kjøring i bulk
`risk/assessments:assessPeriod({ reportingPeriodId, cursor })` (`tenantMutation`) vurderer én side (200) av organisasjonens aktive leverandører og gir `nextCursor` til siden er ferdig. Målt mot lokal backend med 2 000 leverandører: 200 per kall gav tregeste side ca. 0,5 s inkludert nettverk (elleve kall); 2 000 i ett kall gikk også, men tok over 2 s. Derfor 200 og ingen egen jobb eller kø. Grensene er ikke målt mot Convex Cloud. Kalleren (grensesnittet, senere) kjører kall etter kall til `nextCursor` er `null`. Et avbrudd midt i taper ingenting: ferdige sider er lagret, og neste kjøring hopper over uendrede leverandører.

Én revisjonshendelse per kall med lagrede vurderinger (`risk.assessed` på rapportperioden, med antall nye og uendrede), skrevet i samme mutasjon. Kaster loggingen, lagres ingen vurderinger fra kallet. Ingen aktiv metodeversjon gir `RISK_METHOD_MISSING`. Mangler land- eller bransjedatasett, blir det synlige mangler, ikke feil.

## Tilgang
Kundefunksjonene kan ikke lese innholdstabellene (rls.ts). Motoren får innholdet via `risk/internal:engineData`, en intern query som mutasjonen kaller (probe i integrasjonstestene). Alle tre kundefunksjoner (`assessPeriod`, `latest`, `history`) laster leverandør og periode med `getOwned`; en annen organisasjons id gir `NOT_FOUND`.

## Kjente begrensninger
- **Grensesnitt og prioritert liste** kom i oppgave 16 (se [0014](0014-risikoliste-og-kundevurdering.md)). Beløp er fortsatt utenfor motoren; listen bruker det bare til sortering innenfor nivå.
- **Ingen dataversjoner i produksjon.** Alt er prøvd med syntetiske demo-data. Uten aktive produksjonsdata gir motoren synlige mangler og `unknown`.
- **Ingen kodeverkoversettelse** (SN2007 → SN2025/NACE).
- **Kjøpskategori er fritekst** i dag; treff krever eksakt likhet (etter små bokstaver og trimming) med datasettets kategori.
- **Fritekst og kontaktpersoner** er ikke input. Bare registerstatus fra snapshotet leses.
- **Grensene for bulk** er målt mot lokal backend, ikke Convex Cloud.
- Historikk vises med høyst 20 rader per leverandør og periode.
