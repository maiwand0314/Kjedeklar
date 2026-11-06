# Faglige avklaringer, kilder og grenser

Kontrollert mot nedenstående offentlige kilder 6. november 2026. Dette er utviklingsføringer og identifiserte avklaringer, ikke en juridisk vurdering av en bestemt kunde. Lenker og kildeutgaver skal sjekkes på nytt når reglene implementeres eller endres.

## Virkeområde
Tersklene i konseptet er et utgangspunkt: mer enn 70 millioner i salgsinntekt, 35 millioner i balansesum og 50 gjennomsnittlige årsverk, minst to av tre. Loven omfatter også foretak av allmenn interesse og har egne hensyn for konsern, to sammenhengende regnskapsår og norske/utenlandske virksomheters tilknytning. Ikke hardkod en full juridisk ja/nei-motor basert på ett Brreg-felt. For MVP avgrenses den veiledende automatiseringen til ordinære norske foretak med tilstrekkelig manuell input; øvrige tilfeller får manuell avklaring. Ved usikker tidligere status/tidsvirkning brukes også manuell avklaring.

Kilde: [Åpenhetsloven §§ 2–3, gjeldende lovtekst](https://lovdata.no/dokument/NL/lov/2021-06-18-99). Gjør grensetester på nøyaktig lik terskel og rett over. Kontroller ordlyd og tidsvirkning mot kilden når testmatrisen skrives.

## Hva verktøyet må hjelpe kunden å dokumentere
Aktsomhetsarbeidet omfatter også egen virksomhet og forretningsforbindelser, løpende oppfølging og håndtering av faktiske og potensielle konsekvenser. Land-/bransjescreening er ett grunnlag, ikke gjennomførte aktsomhetsvurderinger alene. Derfor har MVP en liten manuell del for egen virksomhet, funn, tiltak, oppfølging og forventede/faktiske resultater.

Redegjørelsen må beskrive virksomheten og arbeidet, avdekkede konsekvenser/vesentlig risiko og tiltak/resultater. Den må oppdateres ved vesentlige endringer i tillegg til årlig frist. Signering følger regnskapsloven § 3-5; hvem som signerer må vurderes ut fra virksomheten, ikke antas å være én styrebruker. En intern «godkjenn»-knapp eller skrevet navn er ikke gjennomført signering. Kunden eksporterer til ekstern signering og publiserer på eget nettsted i MVP.

Kilder: [Åpenhetsloven §§ 4–5](https://lovdata.no/dokument/NL/lov/2021-06-18-99), [Forbrukertilsynets veiledning om offentliggjøring](https://www.forbrukertilsynet.no/wp-content/uploads/2023/11/offentliggjoring-av-redegjorelse-etter-apenhetsloven-1.pdf). Sjekk aktuell veiledning før pilot; gammel PDF er ikke en erstatning for oppdatert lovtekst.

## Informasjonskrav etter MVP
Normalfristen er senest tre uker og svaret skal gis innen rimelig tid. Loven åpner for inntil to måneder når mengde/type informasjon gjør treukersfristen uforholdsmessig byrdefull, med skriftlig beskjed om forlengelse innen tre uker. Dette skal ikke modelleres som en automatisk generell utsettelse senere. Kunden må håndtere krav utenfor MVP uansett hvilken skriftlig kanal de kommer gjennom.

Kilde: [Åpenhetsloven § 7](https://lovdata.no/lov/2021-06-18-99/%C2%A77).

## Brreg og kodeverk
Enhetsregisteret brukes til org.nr., navn, organisasjonsform, adresse, bransje og tilgjengelig registerstatus. Velg bare nødvendige felter. API-dokumentasjonen er kontrakten, også for manglende felt og endringer. Årsverk og salgsinntekt/balanse for pliktvurderingen bekreftes manuelt i MVP; ikke utvid til en ny regnskapsintegrasjon.

Næringskode må ha kodeverk og versjon. Ikke anta at alle historiske CSV-er og dagens Brreg bruker identiske koder eller at hovednæringen er varen kunden kjøper. Bevar opprinnelig kode, registrer standard og bruk tydelig mapping med kilde. Ukjent kode gir datamangel.

Kilder: [Enhetsregisterets API](https://data.brreg.no/enhetsregisteret/api/dokumentasjon/no/index.html), [Brreg om næringskoder](https://www.brreg.no/bedrift/naeringskoder/).

## Land- og bransjerisiko er et eget fagprodukt
ITUC og Walk Free beskriver ulike fenomener og metoder. Ikke slå sammen indeksenes råtall som om de hadde samme skala. De er indikatorer på risikokontekst, ikke bevis mot en navngitt leverandør. Metoden for å gå fra indikator til Kjedeklars prioriteringsnivå må dokumenteres og gjennomgås av et menneske med relevant fagkompetanse.

Før hver kilde tas i bruk: avklar kommersiell gjenbruk og eventuell redistribusjon/lisens, utgave, landdekning, kodeverk, begrensninger og oppdateringsrutine. At en PDF er offentlig tilgjengelig betyr ikke at et SaaS-produkt fritt kan kopiere hele datasettet. Det er ikke etablert noe faktisk land-/bransjedatasett i denne pakken. Claude skal ikke finne på et norsk eller utenlandsk risikonivå for å fylle et hull.

Kilder til videre vurdering: [ITUC Global Rights Index](https://www.ituc-csi.org/global-rights-index-2025), [Walk Free – metode](https://www.walkfree.org/global-slavery-index/methodology/methodology-content/), [Walk Free – Global Slavery Index](https://www.walkfree.org/global-slavery-index/). Lenke til en kjent utgave er ikke en påstand om at dette er nyeste utgave ved implementasjon.

Nystiftelse og konkurs er administrative signaler. De skal ikke automatisk merkes «menneskerettighetsbrudd». Sanksjonsscreening utsettes til en egen integrasjon med kilde-, matching- og feiltreffshåndtering. MVP skal aldri vise «sanksjoner sjekket» uten en slik integrasjon.

## EU/EØS og eksterne tjenester
EU/EØS er deres produktkrav for kundeinnhold, ikke en universell GDPR-regel. Et databehandlerforhold må dessuten avklares gjennom roller, avtaler, underleverandører, tilgang og faktisk behandling. Reguler kundens ansvar og beslutningsstøtte tydelig i vilkårene, men ikke lov at en ansvarsfraskrivelse fjerner egne leverandørplikter.

[Datatilsynets omtale av artikkel 28 og databehandleravtaler](https://www.datatilsynet.no/personvern-pa-ulike-omrader/skole-barn-unge/bruk-av-google-chromebook-og-g-suite-for-education-og-andre-skytjenester-i-grunnskolen/google-som-databehandler/) beskriver grunnprinsippet om garantier og avtale; skoleeksemplet er ikke en sektorregel som skal kopieres inn i Kjedeklars vilkår.

Hetzner har dokumenterte lokasjoner i Tyskland/Finland, men velg faktisk lokasjon og undersøk backup-, logg- og supportoppsett. Kilder: [lokasjoner](https://docs.hetzner.com/cloud/general/locations/), [backup-lokasjon](https://docs.hetzner.com/cloud/servers/backups-snapshots/faq/).

Azure OpenAI er en kandidat, ikke forhåndsgodkjent: [deploytyper og inferensområde](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/deployment-types). Global er ikke avgrenset til EU; Data Zone og regionale typer har andre grenser. Bekreft modelltilgjengelighet, kontoavtaler, misbruksmonitorering og eventuell supportbehandling før ekte data. Ingen automatisk fallback. Dersom hele EU/EØS-kravet ikke kan underbygges, bruk manuell malgenerering og hold AI av.

Scaleway TEM er SMTP-kandidat; les [gjeldende tjenestedokumentasjon](https://www.scaleway.com/en/docs/transactional-email/) og kontrakt før valg. EU-lokasjon for selve SMTP-tjenesten sier ikke hvor kundens mottakers e-postsystem behandler meldingen. Avklar kravet for mottakerstyrt e-post, send minimalt innhold og ikke e-post leverandørdata i MVP.

Kode og syntetiske tester kan ligge i GitHub/Claude Code; kundedata og produksjonshemmeligheter skal ikke inn i kodeagent, git eller CI. Hvis kravet også gjelder kildekode og utviklingsmetadata må utviklerplattformene vurderes separat før de tas i bruk.

## Tekniske primærkilder
- [Next.js installasjon og krav](https://nextjs.org/docs/app/getting-started/installation)
- [Better Auth installasjon og Drizzle-adapter](https://better-auth.com/docs/installation)
- [Drizzle-migrasjoner](https://orm.drizzle.team/docs/migrations)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html): eier/superuser/BYPASSRLS kan omgå vanlige policyer; FORCE, roller og runtime-tester er derfor del av arkitekturen.

## Avklaringer som ikke kan løses ved å generere kode
1. Virksomhetens fullmakt/tilhørighet ved pilotopprettelse og kundens bekreftelse av pliktgrunnlag.
2. Faglig godkjenning og lisens for reelle risikodata og metode. Begrens første pilot til dokumentert dekning; øvrige tilfeller må være synlig ukjent.
3. Avtalte leverandører med faktiske dataflyter, kundedokumenter, lagringstider og slettingsprosess.
4. Hvem hos kunden som gjennomgår, signerer og publiserer dokumentet eksternt.

Før disse er avklart kan dere bygge og demonstrere hele systemet med syntetiske data. Ikke merk dem ferdige bare fordi Claude har skrevet et dokumentutkast.
