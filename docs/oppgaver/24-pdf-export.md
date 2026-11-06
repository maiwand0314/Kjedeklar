# Oppgave 24: PDF-eksport av eksakt revisjon

**Avhengighet:** 23. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 24: PDF-eksport av eksakt revisjon.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Eksporter en lesbar norsk PDF som kan sendes til ekstern signering.

Berørte filer/moduler
src/modules/statements/pdf/, src/server/jobs/handlers/pdf.ts, src/app/api/statements/, src/server/storage/, tests/integration/pdf*, tests/fixtures/pdf/
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Render lokal HTML/CSS med Chromium i worker, A4, lokalt fontsett, sidetall, periode, virksomhet og korrekt merking. Utkast er alltid merket Utkast – ikke signert; gjennomgått revisjon kan eksporteres Til ekstern signering – ikke signert. Ingen faktisk underskrift eller publisering. Render uten eksterne nettverkskall og uten brukerdefinert HTML. Lag PdfExport med hash, status og privat storage key; gi autorisert no-store-nedlasting for eksakt revisjon. Utdatert kildegrunnlag må vises, ikke skjules av gammel review.

Akseptkriterier
1. PDF samsvarer med valgte revisjon, snapshot og merking.
2. Æ/ø/å, lange avsnitt, sideskift og tomme felt vises pent; ingen avkuttet tekst.
3. Eksport er idempotent per revisjon/merke og kan ikke lastes ned av fremmed tenant.
4. Privat lagring har størrelsesgrense og feil gir ryddbar status uten offentlig fil.

Tester og verifisering
Integrasjon: tekstuttrekk fra PDF for kritiske felter/status, fremmed export-ID, path traversal og avvist ekstern URL. Kjør manuell/renderbasert visuell QA av kort og lang syntetisk rapport; legg ikke kunderapporter i testartefakter. Test workerrestart uten dobbelt resultat.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

