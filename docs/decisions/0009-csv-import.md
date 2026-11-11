# 0009 – Bekreftet, idempotent CSV-import

- **Status:** Vedtatt i oppgave 11 (november 2026)
- **Bygger på:** [0002 – Tenantgrensen](0002-tenant-boundary.md), [0004 – Revisjonslogg](0004-revisjonslogg.md), [0007 – Leverandørregister](0007-leverandorregister.md), [0008 – CSV-forhåndsvisning](0008-csv-forhandsvisning.md)
- **Kode:** `src/domain/import/plan.ts` (ren TypeScript), `convex/suppliers/import/{prepare,store,batches}.ts`, `src/modules/suppliers/import-batch-actions.ts`, `src/modules/suppliers/components/import/`
- **Tester:** `tests/unit/import-plan.test.ts`, `tests/convex/import.test.ts`, `tests/convex/import-rollback.test.ts`, `tests/integration/import.test.ts`, `tests/e2e/import-commit.spec.ts`

## Flyt
1. **Forhåndsvisning** (oppgave 10) lagrer ingenting.
2. **Klargjør import:** filen sendes på nytt til `suppliers/import/prepare:prepare` (`tenantAction`) sammen med valgene og rapportperioden. Convex leser og normaliserer filen på nytt, slår sammen rader for samme leverandør og lagrer et **importgrunnlag**: én `importBatches`-rad og én `importRows`-rad per leverandør. Ingen leverandørdata endres.
3. **Valg:** brukeren tar stilling til oppføringene, samlet per type eller én og én.
4. **Bekreftelse** (`startCommit`) fryser valgene.
5. **Gjennomføring** (`commitChunk`) behandler 100 oppføringer per transaksjon til alt er gjort.

## Råfilen lagres aldri
- Bare prepare-actionen tar imot bytes. Mutasjonene som lagrer, får normaliserte verdier, radnummer, meldinger og hasher.
- Teksten fra cellene i filen (`source` i forhåndsvisningen) lagres ikke. Kolonner som ikke er valgt, finnes ikke i grunnlaget.
- `fileHash` (SHA-256 av bytene) og `normalizedHash` (SHA-256 av de normaliserte oppføringene og valgene) lagres. Filnavnet lagres, avkortet til 200 tegn.
- Bevis: `tests/convex/import.test.ts` leter etter en markør fra en ikke-valgt kolonne og etter råformater i alle tabeller og i fillagringen. `tests/unit/csv-no-storage.test.ts` kontrollerer koden statisk.

## Én oppføring per leverandør
- Rader med samme organisasjonsnummer eller samme leverandør-ID er samme leverandør og slås sammen. En rad uten org.nr. hører til leverandøren med samme ID.
- **Beløpet er summen av radene** med kjent beløp. Har ingen rad beløp, er beløpet ukjent. For øvrige felt brukes første verdi som finnes, i filens rekkefølge.
- En sammenslått oppføring får en avklaring som sier hvilke rader den bygger på. Brukeren må dermed uttrykkelig godta summen.
- **Navn alene slår aldri sammen rader.**
- Rader med feil slås ikke inn i summen. De står som egne oppføringer.
- Peker en gruppe på mer enn ett org.nr. eller mer enn én ID, er det en motstrid i filen, og radene blir feil som må rettes eller utelates.
- En kreditnota trekkes fra summen (med avklaring). Blir summen negativ, er oppføringen en feil.

## Typer og valg
| Type | Hva det er | Valg |
|---|---|---|
| Ny | Ingen treff og ingen avklaringer | Opprettes uten eget valg. Kan utelates |
| Ny med avklaringer | Ingen treff, men noe er uklart | Opprett eller utelat |
| Finnes fra før | Sikkert treff på org.nr. eller leverandør-ID | Oppdater eller hopp over |
| Uklart treff | Navnet ligner, eller treffene peker i ulike retninger | Oppdater en av de foreslåtte, opprett ny (bare ved navnetreff) eller utelat |
| Feil | Kan ikke importeres | Bare utelat, uttrykkelig |

- **Fellesvalg** per type lagres på batchen. Et eget valg på en oppføring går foran.
- Importen kan ikke bekreftes mens en oppføring mangler valg (`IMPORT_UNDECIDED`).
- «Oppdater» kan bare gjelde en leverandør grunnlaget selv foreslo, og den lastes med `getOwned` når valget settes og når det gjennomføres.

## Hva «oppdater» gjør
- Periodens **innkjøpsbeløp erstattes** med beløpet fra filen. Det legges aldri til det som står fra før.
- Kategori og beskrivelse erstattes når filen har dem. Felt filen ikke har, røres ikke; et tomt beløp i filen sletter ikke et kjent beløp.
- Kjente produksjonsland og oppstrøms-krysset røres ikke.
- **Leverandørens profil endres ikke**: navn, org.nr., ID, land og bransjekode står som de er. Navnet i filen overskriver aldri navnet brukeren har.
- Uten nye verdier er resultatet «uendret».

## Hva «opprett» gjør
- Leverandøren opprettes med profilen fra filen, etter de samme reglene som manuell registrering (`checkedProfile`).
- Har filen beløp, kategori eller beskrivelse, lagres innkjøpsdata for perioden, med produksjonsland ukjent og oppstrøms ukjent.

## Idempotens
- **Samme fil, valg og periode gir samme utkast.** `idempotencyKey` er periode-id og `normalizedHash`. Finnes et gyldig utkast eller en import som pågår med samme nøkkel, returneres den. Dobbeltklikk på «Klargjør import» gir ett grunnlag.
- **Bekreftelse kan gjentas.** Er grunnlaget alt bekreftet, endrer et nytt kall ingenting.
- **Gjennomføring kan gjentas.** Batchen har en peker til første ubehandlede oppføring. Den leses og flyttes i samme transaksjon som oppføringene behandles, så to samtidige kall aldri behandler samme oppføring. Etter fullført import svarer `commitChunk` bare med resultatet.
- **Samme fil importert på nytt** gir et nytt grunnlag som sier at innholdet er importert før. Alle oppføringer treffer da leverandører som finnes, og krever uttrykkelige valg. Beløp erstattes, så ingenting dobles.
- **Leverandør-ID er nå unik per organisasjon** når den er satt (indeks `by_organizationId_and_externalKey`, feilkode `SUPPLIER_KEY_EXISTS`). Det gjelder også manuell registrering. Uten dette kunne to leverandører med samme ID gjøre matchingen tvetydig.

## Utløp og endringer etter grunnlaget
- Et utkast må bekreftes innen **24 timer** (`IMPORT_EXPIRED`). Fristen er romslig fordi gjennomgang av en stor fil tar tid; det som beskytter mot foreldede opplysninger, er versjonskontrollen under.
- Et utkast kan ikke bekreftes når en annen import til samme periode pågår, eller er fullført etter at utkastet ble laget (`IMPORT_STALE`). Forslagene i utkastet bygger da på leverandørene slik de var før, og en rad med bare navn ville blitt opprettet på nytt. Samme fil lastet opp igjen gir et nytt grunnlag, ikke det utdaterte utkastet.
- Grunnlaget lagrer `mappingVersion`. Et grunnlag laget med eldre regler kan ikke bekreftes.
- Batchen har `rowVersion`, som øker ved hvert valg. Bekreftelsen må oppgi versjonen brukeren så (`CONFLICT` ellers).
- For hver mulig leverandør lagres **versjonen av profilen og av periodens innkjøpsdata** slik de var da grunnlaget ble laget. Er noen av dem endret når oppføringen gjennomføres, får oppføringen resultatet **«ikke importert»**, og ingenting overskrives.
- Er en leverandør med samme org.nr. eller ID opprettet i mellomtiden, får oppføringen samme resultat.
- De andre oppføringene gjennomføres. Resultatet viser antallet, og brukeren laster opp filen på nytt for å gå gjennom dem med oppdaterte opplysninger.

## Transaksjonsgrenser
Convex sine grenser per transaksjon ([dokumentasjonen](https://docs.convex.dev/production/state/limits), lest 10. november 2026; den installerte pakken har ikke tallene): 16 000 dokumenter skrevet, 16 MiB skrevet, 32 000 dokumenter lest, **4 096 indeksoppslag**, og ett sekund kjøretid for egen kode.

- 2 000 oppføringer i én transaksjon ville kommet nær grensen for indeksoppslag. Derfor:
  - grunnlaget lagres med **200 oppføringer per intern mutasjon**;
  - importen gjennomføres med **100 oppføringer per transaksjon**. Hver oppføring bruker under ti oppslag.
- Grunnlaget har status `preparing` til alle oppføringene er lagret. Et halvferdig grunnlag finnes ikke for brukeren og kan ikke bekreftes.
- Gjennomføringen drives av nettleseren, som kaller til importen er ferdig. Det finnes ingen bakgrunnsjobb ennå (oppgave 12).
- **Avbrudd:** feiler et stykke, rulles det tilbake i sin helhet. Batchen står som «bekreftet, ikke fullført» med antall behandlet, vises slik i listen over importer, og kan fortsettes derfra.
- **To faner samtidig:** Convex lar én transaksjon vinne. Den andre får en samtidighetsfeil, og grensesnittet venter og prøver igjen. Integrasjonstesten gjennomfører 2 000 oppføringer fra to klienter samtidig uten dubletter.

## Revisjonslogg
Importen logges **per batch**, ikke per leverandør:

| Hendelse | Når | Innhold |
|---|---|---|
| `import.created` | Grunnlaget er ferdig lagret | Status, antall rader og antall leverandører |
| `import.confirmed` | Brukeren bekrefter | Status og fellesvalgene som gjaldt |
| `import.applied` | Hvert gjennomført stykke | Status, antall behandlet, opprettet, oppdatert, uendret, utelatt og ikke importert |

- **Endringsreferansene** står på `importRows`: resultat, leverandøren som ble opprettet eller oppdatert, og tidligere beløp ved oppdatering. Radene beholdes etter importen.
- Filinnhold, leverandørnavn og beløp fra filen står ikke i revisjonsloggen.
- **Konsekvens:** en leverandør opprettet ved import står ikke som egen hendelse under «Leverandører» i revisjonsloggen. Den finnes via importen.
- Valg i et utkast (`setPolicy`, `decide`) logges ikke enkeltvis; de endrer ingen leverandørdata, og fellesvalgene som gjaldt, logges ved bekreftelsen.

## Kjente begrensninger
- Rader med feil kan ikke rettes i appen. De rettes i filen og lastes opp på nytt, eller utelates.
- Egne valg per oppføring logges ikke enkeltvis; resultatet per oppføring står på importraden.
- En oppføring kan bare oppdatere en leverandør grunnlaget foreslo. Brukeren kan ikke peke på en vilkårlig leverandør.
- To oppføringer mot samme leverandør: den første oppdaterer, den andre blir «ikke importert».
- Arkivering av en leverandør etter at grunnlaget ble laget, oppdages ikke (arkivering øker ikke profilversjonen).
- Avbrytes importen, må noen åpne den og velge «Fortsett importen». Den fortsetter ikke av seg selv.
- Importgrunnlag og importrader slettes ikke. Lagringstid avklares i oppgave 27.
- Antall oppføringer uten valg telles ved å lese oppføringene (høyst 2 000).
