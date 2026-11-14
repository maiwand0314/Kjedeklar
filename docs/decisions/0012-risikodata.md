# 0012 – Versjonerte risikodata og godkjenningsflyt

- **Status:** Vedtatt i oppgave 14 (november 2026)
- **Bygger på:** [0002 – Tenantgrensen](0002-tenant-boundary.md), [0004 – Revisjonslogg](0004-revisjonslogg.md), [risk-method-v0](risk-method-v0.md)
- **Kode:** `src/domain/risk/datasets/` (Zod-skjema, validering, checksum, livsløp), `convex/risk/`, `scripts/risk-data-*.ts`, `risk-data/`
- **Tester:** `tests/unit/risk-data.test.ts`, `tests/convex/risk-data.test.ts`, `tests/integration/risk-data.test.ts`, probene i `tests/integration/tenancy.test.ts`

## Hva som er bygget
Dataformatet og flyten for land-, bransje- og metodedata, **før** risikomotoren (oppgave 15). Ingen faktiske risikodata er opprettet: bare tre tydelig syntetiske demo-fixtures under `risk-data/demo/`.

## Tabeller (globale, uten `organizationId`)
| Tabell | Innhold |
|---|---|
| `riskDatasetVersions` | Land- eller bransjeversjon: kilde (tittel, URL, utgave, hentedato), lisensstatus, kodeverk (bransje), gjennomgang (reviewer, dato, forfall), godkjenning, miljø, checksum, status, hvem og når |
| `countryRiskEntries` | `iso2`, kildens opprinnelige indikator (tekst, tolkes aldri), Kjedeklars nivå, transformasjonsregel, kildereferanse |
| `industryRiskEntries` | `codeExact`, `codePrefix` eller `productCategory` (nøyaktig én), nivå, kildereferanse, begrunnelse |
| `riskMethodVersions` | Metodekontrakten (se [risk-method-v0](risk-method-v0.md)) |

De er faggrunnlag, ikke kundedata. Kodeverket (SN2007, SN2025, NACE2, NACE2.1) står på bransjeversjonen og gjelder alle kodene i den. Hver tabell og indeks er en egen oppføring i `GLOBAL_TABLES` i `tests/convex/registry.test.ts`, som også kontrollerer at de aldri får `organizationId`.

## Format
En JSON-fil per versjon (`risk-data/<mappe>/<navn>.json`) med metadata og innhold, validert av Zod (`schema.ts`) og semantiske regler (`validate.ts`):
- **Land:** ISO-kode fra listen over 249 koder; duplikat avvises. Demo kan i tillegg bruke de brukertildelte kodene `XA`–`XZ`, så et syntetisk nivå aldri settes på et ekte land.
- **Bransje:** to linjer med samme nøkkel (kode, prefiks eller produktkategori) er tvetydige og avvises, også med ulikt nivå. Eksakt kode har prioritet foran prefiks, og lengste prefiks vinner, så ulike prefikser og eksakt kode kan lovlig overlappe.
- **Alle:** kildereferanse og transformasjonsregel er påkrevd per linje. Uventede felt og ukjente kodeverk avvises. Kilde-URL må være https, og datoer må være ekte datoer.
- **Størrelse:** høyst 1 000 linjer per versjon. Importen skjer i én mutasjon.
- CSV støttes ikke.

## Checksum
SHA-256 av kanonisk JSON (sorterte nøkler, linjene sortert) av hele filen unntatt `checksum`, inkludert review og godkjenning. Endres innhold, kilde eller godkjenning, må checksummen lages på nytt (`pnpm risk-data:validate -- --file <fil> --print-checksum`). Den beskytter mot utilsiktet endring, mellom filen, importen og lagret innhold; den er ikke en signatur, og noen med tilgang til filen kan regne en ny.

## Livsløp og godkjenning
`imported` → `active` → `retired`. Innholdet endres aldri etter import; bare status og tidsstempler.

1. **Valider:** `pnpm risk-data:validate` (hele `risk-data/`) eller `-- --file <fil>`. Rører ingen backend.
2. **Importer:** `pnpm risk-data:import -- --file <fil> --operator "Navn"`. Validerer på nytt, regner ut checksum på nytt og lagrer som `imported`. Samme (type, versjon) kan aldri importeres to ganger.
3. **Aktiver:** `pnpm risk-data:activate -- --kind <country|industry|method> --version <versjon> --operator "Navn"`. Kontrollerer alt på nytt mot det som er lagret. Forrige aktive versjon av samme type og miljø pensjoneres i samme transaksjon.

**Hindre for aktivering** (alle rapporteres samlet, og ingenting endres): versjonen er ikke `imported` (`NOT_IMPORTED`), checksum stemmer ikke (`CHECKSUM_MISMATCH`), mappingen er ugyldig eller antall linjer avviker (`INVALID_MAPPING`). For `demo`: kjøres ikke i et lokalt miljø (`DEMO_NOT_ALLOWED`). For `production`: lisens ikke `cleared` (`LICENSE_NOT_CLEARED`), ingen gjennomgang (`NOT_REVIEWED`), ingen godkjenning (`NOT_APPROVED`), forfallsdato passert (`REVIEW_OVERDUE`). Forfallsdagen selv er fortsatt gyldig; dato regnes i UTC.

Gjennomgang og godkjenning er opplysninger i filen (hvem og når), ikke et system for signering. At de står der, er ikke et bevis på at noen har gjort jobben; den menneskelige gjennomgangen er en forutsetning utenfor systemet.

## Hvem kan skrive
- Det finnes **ingen offentlig skrivefunksjon**. `risk/internal:importVersion` og `risk/internal:activateVersion` er interne og kan bare kalles med deploy/admin key. Kommandoene leser admin key fra en env-fil lokalt hos operatør (`CONVEX_SELF_HOSTED_URL` og `CONVEX_SELF_HOSTED_ADMIN_KEY`); den når aldri Next.js, nettleseren eller loggen. Integrasjonstestene har en probe per intern funksjon, og en test sjekker at de eneste offentlige risikofunksjonene er to queries.
- Demo-data kan bare importeres og aktiveres når `KJEDEKLAR_ENV` er `development` eller `test` på en lokal backend (`assertLocalEnv`), og kunder leser dem aldri utenfor lokale miljøer, selv om en demoversjon skulle stå som aktiv.
- **Revisjonslogg:** `auditEvents` er per kunde og har ikke noe sted for globale endringer. Hvem og når står derfor på versjonsdokumentet (`importedBy`/`importedAt`, `activatedBy`/`activatedAt`, `retiredAt`). Operatørnavnet er en påstand fra kommandoen; admin key har ingen identitet. Begge funksjonene er unntatt i `tests/helpers/audited-mutations.ts` med denne begrunnelsen.

## Hva kunder kan lese
`risk/queries:activeVersions` og `:getVersion` (`tenantQuery`) gir metadata og datakvalitet (kilde, utgave, hentedato, lisens, kodeverk, review-datoer, `freshness`, antall linjer) for aktiverte og pensjonerte versjoner. Aldri uaktiverte, og aldri selve innholdet. RLS-reglene gir samme avgrensning på den innpakkede `ctx.db`; innholdstabellene kan ikke leses av tenantfunksjoner. Motoren (oppgave 15, beslutning 0013) får innholdet via den interne queryen `risk/internal:engineData`.

## Verktøy
Skriptene er `.ts`-filer som Node 24 kjører direkte (innebygd fjerning av typer), uten ekstra pakke. Derfor har filene under `src/domain/risk/datasets/` (og `suppliers/countries`) importer med `.ts`-endelse, og begge `tsconfig`-filene har `allowImportingTsExtensions`. Kommandoene bruker `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`, siden `package.json` ikke er `"type": "module"`.

## Kjente begrensninger
- **Ikke prøvd mot Convex Cloud.** Kommandoene bruker admin key via `ConvexHttpClient` mot selvhostet backend; prosedyren for Convex Cloud (deploy key) er ikke laget eller testet.
- **Ingen reelle data og ingen fagreview.** Kilder, lisenser og mapping fra indikator til nivå er ikke avklart (se `docs/FAGLIGE_AVKLARINGER.md`).
- **Ingen kommando for å pensjonere uten å erstatte**, og ingen for å angre en aktivering. Rull fram med en ny versjon.
- **Dekning måles ikke ennå** (antall land og koder står som `entryCount`).
- **Produktkategori** er et nøkkelfelt uten mapping mot kjøpskategorien i `supplierPeriods` (fritekst). Motoren (oppgave 15) avgjør bruken.
- Importen er ikke gjenopptakbar: en mutasjon, høyst 1 000 linjer.
