# Oppgave 15: Deterministisk risikomotor

**Avhengighet:** 14. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 15: Deterministisk risikomotor.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Beregn forklarbar leverandørscreening og lagre reproduserbare vurderinger.

Berørte filer/moduler
src/modules/risk/engine/, src/modules/risk/service.ts, src/server/db/schema/risk-assessment.ts, drizzle/, tests/unit/risk-engine*, tests/integration/risk*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Implementer ren funksjon av normalisert input, godkjente dataversjoner og metodeversjon. Returner screening_level, data_quality, missing_fields, triggered_rules med input/kildereferanser og kontrollsignaler. Kjent høy faktor gir høy; ellers vesentlig datamangel gir ukjent; ellers høyeste kjente nivå. Registreringsland må ikke erstatte ukjent produksjonsland. Beløp skal ikke være argument til beregning av nivå. Lagre immutable input_snapshot/hash og versjonsreferanser. Bruk bulkhandling med fast grense for pilotens 2 000 leverandører; mål om den trenger oppdeling i jobber før du legger til mer kølogikk.

Akseptkriterier
1. Samme input og versjoner gir identisk resultat uten AI eller nettverkskall.
2. En høy bransje/produkt-/landfaktor kan ikke nøytraliseres av en lav faktor.
3. Ukjent/utgått kilde er synlig, og en kjent høy faktor bevares ved andre mangler.
4. Ny leverandørinput/metode gir ny vurdering og merker gammel som utdatert; historikk bevares.

Tester og verifisering
Tabelltester av lav/moderat/høy/ukjent, ingen faktorer, høy+ukjent, utgått kilde, uklart produksjonsland, kodeversjonsmismatch og administrative signaler. Egenskapstest: endring av innkjøpsbeløp påvirker aldri nivå. Integrasjon for snapshots, RLS og audit. Bruk syntetiske forventninger, ikke oppdiktede landfakta.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

