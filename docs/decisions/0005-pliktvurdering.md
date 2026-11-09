# 0005 – Veiledende pliktvurdering (åpenhetsloven §§ 2–3)

- **Status:** Vedtatt i oppgave 07 (november 2026)
- **Kode:** `src/domain/applicability/` (ren TypeScript), `convex/organizations/applicability.ts`
- **Tester:** `tests/unit/applicability.test.ts`, `tests/convex/applicability.test.ts`, `tests/integration/applicability.test.ts`
- **Regelversjon:** `apenhetsloven-3a-2024-11-01-v1`

## Kilde
[Åpenhetsloven (LOV-2021-06-18-99)](https://lovdata.no/dokument/NL/lov/2021-06-18-99), lest på Lovdata 9. november 2026. Gjeldende tekst er endret ved lov 21. juni 2024 nr. 42, i kraft 1. november 2024. Dette er utviklingsføringer, ikke en juridisk vurdering av en bestemt kunde. Kilden skal leses på nytt når reglene endres; ny ordlyd gir ny regelversjon.

**§ 2 (virkeområde):**
- Loven gjelder større virksomheter som er hjemmehørende i Norge og tilbyr varer og tjenester i eller utenfor Norge.
- Den gjelder også større utenlandske virksomheter som tilbyr varer og tjenester i Norge og er skattepliktige til Norge etter intern lovgivning.

**§ 3 bokstav a (større virksomheter)**, med de avgjørende formuleringene:
- foretak «av allmenn interesse etter regnskapsloven § 1-6», eller
- foretak som på balansedagen «overskrider minst to av følgende tre terskler»: salgsinntekt «70 millioner kroner», balansesum «35 millioner kroner», gjennomsnittlig antall ansatte i regnskapsåret «50 årsverk».
- Et morselskap er større virksomhet dersom vilkårene er oppfylt «for mor- og datterselskaper sett som en enhet».
- Når et foretak går over eller under tersklene, får det virkning først for «det andre av to regnskapsår etter hverandre».

## Tolkning i koden
- **«Overskrider»** betyr strengt større. Nøyaktig 70 000 000 kr, 35 000 000 kr eller 50 årsverk er ikke overskredet.
- **Per år:**
  - minst to kjente verdier over terskel gir «overskrider»;
  - minst to kjente verdier på eller under terskel gir «overskrider ikke»;
  - ellers er året uavklart.
- **Endret status:** samme utfall to år på rad gir det utfallet. Er utfallet ulikt de to årene, er status ikke endret ennå, og tidligere status gjelder.
- **Årsverk** er gjennomsnittlige årsverk i regnskapsåret, oppgitt av kunden. Brregs `antallAnsatte` brukes ikke.
- **Beløp** lagres i øre som heltall (`int64`).
- **«Tilbyr varer og tjenester»** forutsettes. Verktøyet spør ikke om det.

## Sannhetstabell
Rekkefølgen er ovenfra og ned; første rad som treffer, avgjør. «Over» betyr at minst to av tre terskler er overskredet det året.

| Hjemmehørende i Norge | Morselskap | Allmenn interesse | År | Forrige år | Dette år | Tidligere status | Resultat |
|---|---|---|---|---|---|---|---|
| nei / vet ikke | – | – | – | – | – | – | Manuell avklaring |
| ja | ja / vet ikke | – | – | – | – | – | Manuell avklaring |
| ja | nei | vet ikke | – | – | – | – | Manuell avklaring |
| ja | nei | ja | – | – | – | – | Sannsynlig omfattet |
| ja | nei | nei | ikke etter hverandre | – | – | – | Manuell avklaring |
| ja | nei | nei | etter hverandre | uavklart | – | – | Manuell avklaring |
| ja | nei | nei | etter hverandre | – | uavklart | – | Manuell avklaring |
| ja | nei | nei | etter hverandre | over | over | – | Sannsynlig omfattet |
| ja | nei | nei | etter hverandre | ikke over | ikke over | – | Sannsynlig ikke omfattet |
| ja | nei | nei | etter hverandre | ulikt | ulikt | ja | Sannsynlig omfattet |
| ja | nei | nei | etter hverandre | ulikt | ulikt | nei | Sannsynlig ikke omfattet |
| ja | nei | nei | etter hverandre | ulikt | ulikt | vet ikke | Manuell avklaring |

Ukjent historikk gir aldri et skråsikkert nei.

## Bruk i produktet
- **Resultatet er alltid veiledende**, med regelversjon, terskler, input og begrunnelse synlig.
- **Hver vurdering er en ny rad i `applicabilityAssessments`.** Gamle vurderinger endres ikke, og RLS nekter endring.
- **Kunden må bekrefte grunnlaget før lagring.** Serveren regner resultatet ut på nytt og stoler ikke på det klienten viste. Vurderingen logges i revisjonsloggen i samme mutasjon.
- **Ingen utestenging:** «sannsynlig ikke omfattet» stenger ingen funksjoner, og kunden kan bruke verktøyet frivillig.

## Utenfor automatikken (manuell avklaring)
- **Konsern:** tersklene gjelder mor og datter samlet. Konsolideringsregler og hvilke tall som skal brukes, vurderes manuelt.
- **Utenlandske virksomheter:** skatteplikt og tilbud i Norge etter § 2 annet ledd.
- **Svalbard, Jan Mayen og bilandene.**
- **Usikkerhet om allmenn interesse.**
- **Overgangstilfeller med ukjent historikk**, inkludert nystiftede foretak uten to regnskapsår.
