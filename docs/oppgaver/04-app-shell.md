# Oppgave 04: Norsk appskall og navigasjon

**Avhengighet:** 03. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 04: Norsk appskall og navigasjon.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Bygg et rolig profesjonelt, norsk grensesnitt med tydelig valgt virksomhet og senere rapportperiode.

Berørte filer/moduler
src/app/(app)/, src/components/ui/, src/modules/organizations/components/, tests/e2e/navigation*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag responsiv sidebar/header og sider for Oversikt, Virksomheten, Leverandører, Risikovurderinger, Funn og tiltak, Redegjørelse og Innstillinger. Ubygde deler har ærlige tomtilstander, ingen fiktive kundetall. Vis organisasjon og trygg bytting bare mellom egne medlemskap. Etabler typografi, spacing, tabell-/skjemaprimitiver, lys/mørk modus og loading/error/empty-states. Bruk lokal font. Unngå å bygge et generelt designsystem utover dette.

Akseptkriterier
1. Norsk bokmål i all synlig tekst og feilmeldinger.
2. Navigasjonen fungerer på mobil og desktop; tastaturfokus og skjemalabels er synlige.
3. Organisasjonsbytte rydder tidligere viste kundedata; ingen flash med forrige kunde.
4. Ingen eksterne font-/analyticskall og ingen demoinnhold som ser ekte ut.

Tester og verifisering
Playwright: naviger med tastatur, vis mobilbredde, bytt organisasjon og test loading/avslag. Enkel tilgjengelighetssjekk av sentrale skjema/navigation; visuell manuell kontroll i begge tema. Ikke skriv snapshot av hele DOM.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

