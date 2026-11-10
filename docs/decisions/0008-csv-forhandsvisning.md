# 0008 – CSV-opplasting og forhåndsvisning

- **Status:** Vedtatt i oppgave 10 (november 2026)
- **Bygger på:** [0002 – Tenantgrensen](0002-tenant-boundary.md), [0007 – Leverandørregister](0007-leverandorregister.md)
- **Kode:** `src/domain/import/` (ren TypeScript), `convex/suppliers/import/`, `src/modules/suppliers/import-actions.ts`, `src/modules/suppliers/components/import/`
- **Tester:** `tests/unit/csv-*.test.ts`, `tests/convex/csv-preview.test.ts`, `tests/integration/csv-preview.test.ts`, `tests/e2e/import.spec.ts`, fixtures i `tests/fixtures/csv/`
- **Mal:** `public/maler/leverandorer-mal.csv` (syntetisk)

## Hva forhåndsvisningen gjør
Brukeren laster opp en CSV-fil og ser hvordan den blir lest: hvilken kolonne som brukes til hvilket felt, normalisert verdi ved siden av teksten i filen, feil og avklaringer per rad, dubletter i filen og forslag til matching mot leverandører som finnes fra før. **Ingenting endres.** Selve importen kommer i oppgave 11.

## Flyt
1. Nettleseren avviser filer over 2 MiB før opplasting.
2. Filen sendes som skjemadata til en server-action, som kontrollerer størrelsen før den leser filen, og sender bytes videre til `suppliers/import/actions:preview` (`tenantAction`).
3. Actionen verifiserer medlemskap, kontrollerer 2 MiB og 2 000 rader på nytt, leser og normaliserer filen i minnet, henter organisasjonens leverandører og returnerer forhåndsvisningen.
4. Hvert endret valg (skilletegn, kolonner, desimaltegn, kodeverk) sender filen på nytt. Nettleseren holder filen; serveren husker ingenting mellom kallene.

Den samme rene koden i `src/domain/import/` kjører i enhetstestene og i Convex. Integrasjonstesten viser at den virker i Convex sin kjøretid.

## Råfilen lagres aldri
- Actionen har ingen tabell, ingen fillagring, ingen planlagt jobb og ingen logging. `tests/unit/csv-no-storage.test.ts` feiler hvis koden på veien fra opplasting til svar får noe av dette.
- `tests/convex/csv-preview.test.ts` sammenligner alle tabeller, `_storage` og planlagte funksjoner før og etter.
- Svaret inneholder teksten i filen for de valgte feltene (avkortet til 200 tegn per felt), og går bare tilbake til brukeren som lastet opp.
- Server-actions har fått grensen `3mb` i `next.config.ts` (standard er 1 MB). Den gjelder alle server-actions. Den egentlige grensen håndheves i Convex.

## Lesing av filen
- **Bibliotek:** `papaparse` 5.7.0 (låst versjon, ingen avhengigheter). Valgt fordi det er ren JavaScript som kjører både i Node og i Convex sin kjøretid.
- **Tegnsett:** bare UTF-8, med eller uten BOM. Filer som ikke er gyldig UTF-8 (for eksempel eldre «CSV (semikolondelt)» fra Excel) avvises med forklaring i stedet for å gi ødelagte æ, ø og å.
- **Skilletegn:** semikolon eller komma. Det leses fra overskriftsraden (flest forekomster utenfor anførselstegn, semikolon ved likt), og brukeren kan overstyre.
- **Første rad er overskrifter.** Tomme linjer hoppes over. Radnummeret er det et regneark viser (overskriften er rad 1), også når et felt inneholder linjeskift.
- **Hele filen avvises** når den er for stor, ikke er UTF-8, er tom, bare har overskrift, har flere enn 2 000 rader eller flere enn 50 kolonner.

## Kolonner
- Felt: navn (påkrevd), organisasjonsnummer, egen leverandør-ID, registreringsland, innkjøp i perioden, bransjekode, kategori og beskrivelse.
- Kolonnene foreslås fra norske og engelske overskrifter. Forslaget er bare et utgangspunkt; brukeren ser og kan endre alle valg.
- Uten navnekolonne vises ingen rader. En kolonne kan bare brukes til ett felt.
- Bransjekode krever at brukeren velger kodeverk for hele filen. Malen har derfor ikke bransjekode.
- «Land» i filen er **registreringsland**. Produksjonsland kan ikke importeres fra fil ennå.

## Normalisering: ingenting gjettes
En verdi som ikke kan tolkes sikkert, får ingen normalisert verdi og en synlig melding. To nivåer:

| Nivå | Betyr | Eksempler |
|---|---|---|
| Feil | Verdien kan ikke brukes slik den står | Navn mangler, ugyldig org.nr., beløp i annen valuta, beløp som ikke kan leses, for lang tekst, feil bruk av anførselstegn |
| Må avklares | Brukeren må ta stilling til noe | Tvetydig beløp, negativt beløp, ukjent land, dublett i filen, navn som ligner, treff på arkivert leverandør, motstridende treff |

- **Org.nr.:** mellomrom, punktum og «NO … MVA» fjernes. Kontrollsifferet må stemme.
- **Land:** ISO-kode eller norsk eller engelsk navn fra en fast tabell (`src/domain/suppliers/country-names.ts`), pluss noen få vanlige skrivemåter. Tomt er ukjent. Tekst som ikke kjennes igjen («Kinna», «Korea») er en avklaring, ikke et gjett.
- **Beløp** tolkes til øre som `bigint`, uten flyttall:
  - mellomrom (også harde) som tusenskille, «kr»/«NOK» og «,-» godtas;
  - «1.234,56» og «1,234.56» er entydige og godtas;
  - «1.234» og «12,345» kan være tusenskille eller desimaltegn. De blir **tvetydige**, og brukeren velger desimaltegn for hele filen;
  - negative beløp (også «(1 250,50)» og «1 250-») leses, men må avklares. Kreditnota får aldri redusere risiko stille;
  - annen valuta, vitenskapelig notasjon, formler og flere enn to desimaler er feil;
  - tomt beløp er ukjent, ikke null.
- **Dubletter i filen:** samme org.nr. eller samme leverandør-ID meldes med radnummer. Likt navn (uten selskapsform og tegnsetting) er en mulig dublett, men meldes ikke når radene har hvert sitt gyldige org.nr.

## Forslag til matching
- **Org.nr. eller leverandør-ID** som finnes fra før er et sikkert treff («finnes fra før»).
- **Likt navn** uten felles identifikator er bare et forslag som må avklares. Ingenting slås sammen automatisk.
- **Konflikt:** org.nr. og ID peker på ulike leverandører, ID-en tilhører en leverandør med et annet org.nr., eller flere leverandører har samme ID.
- Matching skjer bare mot leverandører i den verifiserte organisasjonen. De hentes side for side av en intern query som får `organizationId` fra tenantkonteksten, og sammenlignes i minnet.
- Forslagene er rådgivende. Oppgave 11 må kontrollere på nytt i samme mutasjon som lagrer.

## Ubetrodd tekst
- Alt fra filen er tekst. Grensesnittet viser det bare gjennom React sine tekstnoder; ingen HTML settes inn.
- Navn som starter med `=`, `+`, `-` eller `@` får en avklaring, men endres ikke. Vern mot formelinjeksjon hører til eksport, som ikke finnes ennå.
- En formel i et beløpsfelt regnes aldri ut; den er et ugyldig beløp.

## Kjente begrensninger
- **`externalKey` er fortsatt ikke unik** per organisasjon. Forhåndsvisningen tåler det (flere treff blir konflikt), men oppgave 11 må avgjøre regelen før den lagrer.
- Bare UTF-8. Windows-1252 og UTF-16 må lagres på nytt som UTF-8.
- Filer uten overskriftsrad støttes ikke.
- Tre-bokstavers landkoder (NOR, CHN) kjennes ikke igjen.
- Navnelikhet ser bare på hele navnet uten selskapsform. «Oslo Bygg» og «Oslo Byggevarer» regnes som ulike, og skrivefeil fanges ikke.
- Alle organisasjonens leverandører hentes for hver forhåndsvisning. Det holder for MVP-størrelser; ved titusenvis av leverandører bør det byttes til indeksoppslag per rad.
- Forhåndsvisningen er ikke knyttet til en rapportperiode. Det skjer når importen bygges.
- Tabellen viser 50 rader per side. På smale skjermer ruller verdikolonnene vannrett, mens forslag og avklaringer holder seg synlige.
