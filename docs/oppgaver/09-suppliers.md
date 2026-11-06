# Oppgave 09: Leverandørregister med manuell registrering

**Avhengighet:** 08. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 09: Leverandørregister med manuell registrering.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag den minste nyttige leverandørlisten og detaljsiden før CSV bygges.

Berørte filer/moduler
src/modules/suppliers/, src/server/db/schema/supplier.ts, drizzle/, tests/integration/suppliers*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Implementer Supplier og SupplierPeriod, manuell opprettelse/redigering/arkivering og paginert søk. Felter: navn, stabil ID/org.nr. hvis kjent, registreringsland, kodeverk+bransjekode, kjøpsbeskrivelse/kategori, kjente produksjonsland og ukjent oppstrøms, årets innkjøpsbeløp i NOK. Ukjent er lovlig der datagrunnlaget mangler. Ikke bygg risiko ennå. Dedup av org.nr. innen tenant; navnelikhet er forslag, ikke automatisk sammenslåing. Optimistisk låsing ved redigering.

Akseptkriterier
1. Leverandørprofil er adskilt fra årets innkjøpsdata.
2. Beløp lagres eksakt i øre og vises norsk; ukjent beløp er forskjellig fra null.
3. Norsk registrering gjør ikke produksjonslandet kjent.
4. Arkivering bevarer historikk; alle endringer får audit.

Tester og verifisering
Integrasjon: samme org.nr. tillatt i ulike tenants, avvist dobbelt innen tenant; fremmed periode-/supplier-FK avvises; concurrency gir konflikt fremfor datatap; audit. Enhetstest av norsk desimalparsing og store beløp.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

