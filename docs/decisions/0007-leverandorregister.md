# 0007 – Leverandørregister med manuell registrering

- **Status:** Vedtatt i oppgave 09 (november 2026)
- **Bygger på:** [0002 – Tenantgrensen](0002-tenant-boundary.md), [0004 – Revisjonslogg](0004-revisjonslogg.md), [0006 – Rapportperiode og virksomhetsprofil](0006-rapportperiode-og-virksomhetsprofil.md)
- **Kode:** `src/domain/suppliers/` (ren TypeScript), `convex/suppliers/`, `src/modules/suppliers/`
- **Tester:** `tests/unit/suppliers.test.ts`, `tests/convex/suppliers.test.ts`, `tests/convex/suppliers-rollback.test.ts`, `tests/integration/suppliers.test.ts`, `tests/e2e/suppliers.spec.ts`

## To tabeller
- **`suppliers`** er leverandørens profil og gjelder for alle perioder: navn, norsk org.nr., egen leverandør-ID, registreringsland, kodeverk og bransjekode.
- **`supplierPeriods`** er innkjøpsdata for én leverandør i én rapportperiode: beløp, kategori, beskrivelse, kjente produksjonsland og om leddene bak leverandøren er ukjente. Det finnes høyst én rad per leverandør og periode.
- Lagring av innkjøpsdata rører ikke leverandørdokumentet, og omvendt. Hver tabell har sin egen `rowVersion`.

## Ukjent er en lovlig verdi
- Bare navnet er påkrevd. Felt som mangler i dokumentet, er ukjente; de lagres aldri som tom tekst.
- **Beløp:** `spendOre` er øre i NOK som `int64`. Mangler feltet, er beløpet ukjent. `0n` er et kjent nullbeløp. Grensesnittet viser «Ukjent» og «0 kr» som to forskjellige ting.
- **Produksjonsland:** en liste over land kunden faktisk kjenner til. Tom liste betyr ukjent. Registreringslandet kopieres aldri inn, heller ikke når det er Norge.
- **Oppstrøms:** `upstreamUnknown` er `true` til kunden selv fjerner krysset. Uten lagrede innkjøpsdata vises leddene bak leverandøren som ukjente.
- **Land** er ISO 3166-1 alfa-2 fra en fast liste på 249 koder i `src/domain/suppliers/countries.ts`. Norske navn kommer fra plattformen (`Intl.DisplayNames`) ved visning i Next.js, ikke i Convex.
- **Bransjekode** lagres sammen med kodeverk og versjon i ett felt: `SN2007`, `SN2025`, `NACE2` eller `NACE2.1`. Kode uten kodeverk avvises, og omvendt.

## Beløp
- Skjemaet tolker kroner med den samme funksjonen som pliktvurderingen (`parseKronerToOre`): mellomrom og hardt mellomrom som tusenskille, komma eller punktum som desimaltegn, høyst to desimaler og høyst 15 siffer før desimaltegnet.
- Verdier som «1.234,50», «12 kr» og negative tall avvises i stedet for å gjettes. Kreditnota og negative innkjøp hører til importen (oppgave 10–11).
- Tolkingen skjer i server-actionen, ikke i nettleseren. Convex avviser negative beløp og beløp over 64 bit.

## Unikhet og duplikater
- **Norsk org.nr.** er unikt per organisasjon når det er satt. Det kontrolleres med indeksoppslag (`by_organizationId_and_registryOrgNumber`) i samme mutasjon som oppretter eller endrer, også mot arkiverte leverandører. To samtidige forsøk gir én leverandør og én `SUPPLIER_EXISTS`. Samme nummer i to organisasjoner er to uavhengige dokumenter.
- Indeksen heter `by_organizationId_and_registryOrgNumber`, ikke `by_org_orgnumber` som i oppgaveteksten, for å følge navnemønsteret i resten av skjemaet.
- **Likt navn** stopper ingenting og slås aldri sammen. Detaljsiden viser andre aktive leverandører med samme navn som «Mulig duplikat», og kunden avgjør selv.
- **Egen leverandør-ID** (`externalKey`) er ikke unik ennå. Det må avgjøres før importen bruker den til å matche rader (oppgave 11).

## Redigering og arkivering
- Endring, arkivering og lagring av innkjøpsdata krever versjonen brukeren så (`expectedRowVersion`). Er den utdatert, avvises endringen med `CONFLICT`, og skjemaet beholder det brukeren har skrevet.
- Et skjema sender versjonen verdiene i skjemaet bygger på, og den oppdateres bare av skjemaets egen lagring. Nye props etter `router.refresh()` (f.eks. etter lagring i et annet skjema på siden) endrer den ikke, ellers kunne en utdatert fane overskrive en annens endring uten konflikt.
- Arkivering og gjenoppretting øker ikke `rowVersion`. Status rører ingen profilfelt, og et åpent profilskjema skal ikke få falsk konflikt etter egen arkivering.
- Arkivering setter `status: "archived"` og `archivedAt`. Ingenting slettes: profil, innkjøpsdata og revisjonslogg blir stående, og leverandøren kan gjenopprettes. Det finnes ingen funksjon som sletter leverandører.

## Liste og søk
- Listen er paginert med Convex-paginering over `by_organizationId_and_status_and_nameKey`, 25 per side, sortert på navn. Aktive og arkiverte vises hver for seg.
- `nameKey` er navnet i små bokstaver med enkle mellomrom.
- Søket treffer **starten av navnet** (intervall i indeksen), uten hensyn til store og små bokstaver.

## Revisjonslogg
- `supplier.created`, `supplier.updated`, `supplier.archived`, `supplier.restored` og `supplier_period.saved` skrives i samme mutasjon som endringen.
- Diff for leverandør: navn, org.nr., egen ID, registreringsland, kodeverk, bransjekode og status.
- Diff for innkjøpsdata: beløp (tekst i øre), kategori, produksjonsland og oppstrøms-krysset. Kjøpsbeskrivelsen er fritekst og logges aldri.
- Leverandørnavnet står i loggen. Et enkeltpersonforetak kan ha et personnavn som firmanavn; lagringstid og sletting avklares i oppgave 27.

## Kjente begrensninger
- Søket finner ikke treff midt i navnet og ikke org.nr.
- Forslaget om mulig duplikat gjelder bare helt like navn. «Bygg AS» og «Bygg» regnes som ulike.
- Sorteringen følger tegnkoder, så å kommer før æ og ø.
- Listen viser ikke innkjøpsbeløp, og «Vis flere» bytter side i stedet for å legge til rader.
- Adresse og valuta fra den opprinnelige datamodellen er ikke med: adresse er ikke i oppgaven, og beløpet er alltid NOK.
- Ukjent eller fremmed leverandør-id i adressen gir «Ikke funnet»-siden med HTTP 200, av samme grunn som i beslutning 0006.
