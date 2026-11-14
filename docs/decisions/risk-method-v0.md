# Risikometode v0 – metodekontrakt

- **Status:** Kontrakt vedtatt i oppgave 14 (november 2026). Selve motoren kommer i oppgave 15.
- **Bygger på:** [0012 – Versjonerte risikodata](0012-risikodata.md), `docs/ARKITEKTUR.md` («Risikometode v0»), `docs/FAGLIGE_AVKLARINGER.md`
- **Kode:** `src/domain/risk/datasets/schema.ts` (metodeskjemaet), `risk-data/demo/method-demo-1.json`

## Hva dette er, og hva det ikke er
Dette er **Kjedeklars egen screening**: en forklarbar prioritering av hvilke leverandører kunden bør se nærmere på først. Den er ikke en offisiell algoritme fra åpenhetsloven, ikke en juridisk vurdering, ikke en statistisk sannsynlighet og ikke bevis mot en navngitt leverandør. Land- og bransjedata er indikatorer på risikokontekst.

**Metoden og dataene krever faglig gjennomgang før kundebruk.** Systemet håndhever det: en metodeversjon og en dataversjon i miljøet `production` kan ikke aktiveres uten registrert gjennomgang (reviewer og dato), godkjenning og en forfallsdato som ikke er passert, og dataversjoner krever dessuten avklart lisens. Metodefilen må selv si `scope: "kjedeklar_screening"` og `requiresProfessionalReview: true`; en fil som sier noe annet, avvises ved validering.

Screeningen erstatter ikke kundens egen vurdering av berørte rettigheter, alvorlighet (omfang, utbredelse, mulighet for gjenoppretting), sannsynlighet, faktiske konsekvenser og oppfølging. Et screeningnivå blir aldri automatisk et bekreftet funn.

## Nivåer og samling (ordinal max)
Hver risikofaktor gir `low`, `moderate` eller `high`, eller mangler. Reglene i rekkefølge:
1. **Kjent høy faktor gir høy.** Ingen lavere faktor og ingen datamangel kan nøytralisere den (`knownHighWins`).
2. **Ellers gir en vesentlig datamangel ukjent** (`unknownPolicy.materialGaps`, f.eks. ukjent produksjonsland eller ukjent næringskode). Ukjent er ikke lav og vises i egen oppfølgingsliste.
3. **Ellers høyeste kjente nivå** (`ordinal_max`).

Ordinal betyr at nivåene ordnes, men ikke regnes sammen: det finnes ingen poengsum, og ingen vilkårlig 0–100-skala.

## Prioriteringsrekkefølge
`priorityOrder` er rekkefølgen leverandører listes i: `high`, deretter `unknown`, `moderate` og `low`. Validatoren krever at `high` står først og at `unknown` står før `low`, så en leverandør aldri faller bak lav risiko på grunn av et manglende felt. Innkjøpsbeløp sorterer bare **innenfor samme nivå** (`amountSortsWithinLevel: true`) og kan aldri heve eller senke nivået (`amountAffectsLevel: false`; en fil som sier noe annet, avvises).

## Risikofaktorer og kontrollsignaler
- **Risikofaktor** (`kind: "risk_factor"`): land, bransje og produktkategori. Kan gi `low`, `moderate` eller `high`.
- **Kontrollsignal** (`kind: "control_signal"`): administrative opplysninger som konkurs, avvikling, nystiftelse eller datamangel. Oppretter oppfølging separat og gir **aldri** et kjent nivå. De er ikke bevis på menneskerettighetsbrudd. Validatoren avviser et kontrollsignal som bruker faktoren land, bransje eller produkt.

Sanksjonsstatus finnes ikke i metoden; den krever en egen integrasjon.

## Hva som ikke er i metoden
- **Ingen landnivåer eller bransjenivåer.** De ligger i dataversjonene (`countryRiskEntries`, `industryRiskEntries`), med kilde, utgave, lisens og transformasjonsregel. Ingen ekte land eller bransjer har fått et nivå i denne pakken. Overgangen fra en kildes indikator til et Kjedeklar-nivå må dokumenteres per linje (`transformationNote`) og gjennomgås av et menneske med relevant fagkompetanse.
- **Registreringsland er ikke produksjonsland.** Metoden bruker kjente produksjons- og arbeidsland; norsk adresse sier ingenting om norsk produksjon.
- **Bransjekode er ikke produkt.** Leverandørens næring sier ikke hva kunden kjøper; produktkategori er en egen faktor.

## Versjonering
Metoden er en selvstendig versjon (`riskMethodVersions`), uavhengig av kildeutgavene. Hver vurdering (oppgave 15) skal oppgi metodeversjon og dataversjoner. Endring i metode eller data gir en ny versjon; en eksisterende versjon endres aldri. Den forrige aktive versjonen pensjoneres, men kan fortsatt leses, så eldre vurderinger kan gjenskapes.

## Datakvalitet
Hver dataversjon har en eksplisitt tilstand beregnet av forfallsdatoen for gjennomgangen: `current`, `review_overdue` (kilden er utdatert) eller `unreviewed`. En utdatert kilde forblir lesbar, men er merket, og vurderinger som bygger på den skal vise det. Manglende dekning (land eller koder som ikke finnes i datasettet) er ukjent, ikke lav.
