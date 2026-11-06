# Oppgave 09: Leverandørregister med manuell registrering

**Avhengighet:** 08. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 09: Leverandørregister med manuell registrering.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag den minste nyttige leverandørlisten og detaljsiden før CSV bygges.

Berørte filer/moduler
convex/schema.ts, convex/suppliers/, src/domain/ (norsk beløpsparsing), src/modules/suppliers/components/, tests/unit/, tests/convex/suppliers*, tests/integration/suppliers*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Implementer `suppliers` og `supplierPeriods`, manuell opprettelse/redigering/arkivering og paginert søk med Convex-paginering over indeks som starter med `organizationId`. Felter: navn, stabil ID/org.nr. hvis kjent, registreringsland, kodeverk+bransjekode, kjøpsbeskrivelse/kategori, kjente produksjonsland og ukjent oppstrøms, årets innkjøpsbeløp i NOK (`spendOre` som `v.int64()`). Ukjent er lovlig der datagrunnlaget mangler. Ikke bygg risiko ennå. Dedup av org.nr. innen tenant med indeksoppslag (`by_org_orgnumber`) i samme mutasjon; navnelikhet er forslag, ikke automatisk sammenslåing. Optimistisk låsing med `rowVersion` ved redigering.

Akseptkriterier
1. Leverandørprofil er adskilt fra årets innkjøpsdata.
2. Beløp lagres eksakt i øre og vises norsk; ukjent beløp er forskjellig fra null.
3. Norsk registrering gjør ikke produksjonslandet kjent.
4. Arkivering bevarer historikk; alle endringer får audit.

Tester og verifisering
Integrasjon: samme org.nr. tillatt i ulike tenants, avvist dobbelt innen tenant; fremmed periode-/supplier-referanse avvises av `getOwned`; utdatert `rowVersion` gir konflikt fremfor datatap; audit. Enhetstest av norsk desimalparsing og store beløp.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

