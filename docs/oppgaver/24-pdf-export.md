# Oppgave 24: PDF-eksport av eksakt revisjon

**Avhengighet:** 23. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 24: PDF-eksport av eksakt revisjon.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Eksporter en lesbar norsk PDF som kan sendes til ekstern signering.

Berørte filer/moduler
worker/, package.json (`pnpm worker`), convex/http.ts, convex/statements/pdf.ts, convex/schema.ts, src/app/api/statements/, src/modules/statements/components/pdf/, tests/convex/pdf*, tests/integration/pdf*, tests/fixtures/pdf/
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Convex-actions kan ikke kjøre Chromium. Opprett `pnpm worker` og en egen Node-worker i worker/ som rendrer lokal HTML/CSS med Playwright/Chromium, A4, lokalt fontsett, sidetall, periode, virksomhet og korrekt merking. Utkast er alltid merket Utkast – ikke signert; gjennomgått revisjon kan eksporteres Til ekstern signering – ikke signert. Ingen faktisk underskrift eller publisering. Render uten eksterne nettverkskall og uten brukerdefinert HTML. En tenantmutasjon oppretter PDF-jobben i jobs-tabellen fra oppgave 12. Workeren autentiserer med PDF_WORKER_SECRET mot smale HTTP-endepunkter i convex/http.ts (hent tildelt jobb og renderingsgrunnlag, lever resultat), har aldri deploy/admin key og får bare data for jobben den er tildelt; utløpt tildeling gjør jobben tilgjengelig igjen. Lag pdfExports med sha256, status og storageId i Convex file storage. Gi ingen storage.getUrl-lenker til klient; nedlasting går via Next.js route handler eller HTTP-action som sjekker medlemskap og rapporttilknytning for eksakt revisjon og svarer med Cache-Control: no-store. Utdatert kildegrunnlag må vises, ikke skjules av gammel review.

Akseptkriterier
1. PDF samsvarer med valgte revisjon, snapshot og merking.
2. Æ/ø/å, lange avsnitt, sideskift og tomme felt vises pent; ingen avkuttet tekst.
3. Eksport er idempotent per revisjon/merke og kan ikke lastes ned av fremmed tenant.
4. Lagring i Convex file storage har størrelsesgrense og feil gir ryddbar status uten offentlig URL.

Tester og verifisering
Integrasjon: tekstuttrekk fra PDF for kritiske felter/status, fremmed export-ID, path traversal i nedlastingsruten, avvist ekstern URL, manglende/feil PDF_WORKER_SECRET, worker som ber om grunnlag for en jobb den ikke er tildelt, og utløpt tildeling. Kjør manuell/renderbasert visuell QA av kort og lang syntetisk rapport; legg ikke kunderapporter i testartefakter. Test workerrestart uten dobbelt resultat.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

