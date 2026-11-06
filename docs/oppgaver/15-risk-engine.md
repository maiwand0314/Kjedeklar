# Oppgave 15: Deterministisk risikomotor

**Avhengighet:** 14. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 15: Deterministisk risikomotor.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Beregn forklarbar leverandørscreening og lagre reproduserbare vurderinger.

Berørte filer/moduler
src/domain/risk/ (ren motor), convex/risk/ (lagring av riskAssessments), convex/schema.ts, tests/unit/risk-engine*, tests/convex/risk*, tests/integration/risk*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Implementer ren funksjon i `src/domain/risk/` uten Convex- eller Next.js-avhengigheter, av normalisert input, godkjente dataversjoner og metodeversjon. Returner screeningLevel, dataQuality, missingFields, triggeredRules med input/kildereferanser og kontrollsignaler. Kjent høy faktor gir høy; ellers vesentlig datamangel gir ukjent; ellers høyeste kjente nivå. Registreringsland må ikke erstatte ukjent produksjonsland. Beløp skal ikke være argument til beregning av nivå. Lagre uforanderlig inputSnapshot/inputHash og versjonsreferanser i nye `riskAssessments`-dokumenter via `convex/risk/`. Bruk bulkhandling med fast grense for pilotens 2 000 leverandører; mål om lagringen må deles i flere mutasjoner eller jobber innenfor Convex sine grenser (sjekk installert dokumentasjon) før du legger til mer kølogikk.

Akseptkriterier
1. Samme input og versjoner gir identisk resultat uten AI eller nettverkskall.
2. En høy bransje/produkt-/landfaktor kan ikke nøytraliseres av en lav faktor.
3. Ukjent/utgått kilde er synlig, og en kjent høy faktor bevares ved andre mangler.
4. Ny leverandørinput/metode gir ny vurdering og merker gammel som utdatert; historikk bevares.

Tester og verifisering
Tabelltester av lav/moderat/høy/ukjent, ingen faktorer, høy+ukjent, utgått kilde, uklart produksjonsland, kodeversjonsmismatch og administrative signaler. Egenskapstest: endring av innkjøpsbeløp påvirker aldri nivå. Integrasjon mot lokal backend for snapshots, tenantvern (`getOwned`) og audit. Bruk syntetiske forventninger, ikke oppdiktede landfakta.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

