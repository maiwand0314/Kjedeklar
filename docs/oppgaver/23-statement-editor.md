# Oppgave 23: Redigering, versjoner og intern gjennomgang

**Avhengighet:** 22. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 23: Redigering, versjoner og intern gjennomgang.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
La kunden ferdigstille ordlyden uten å miste historikk eller forveksle review med signering.

Berørte filer/moduler
src/modules/statements/components/editor/, convex/statements/revisions.ts, convex/statements/reviews.ts, convex/schema.ts, tests/convex/statement-revisions*, tests/integration/statement-revisions*, tests/e2e/statement-editor*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Bygg enkel seksjonseditor med tekst/avgrenset Markdown og sikker rendering, ikke et stort dokumentbehandlingssystem. Lagring oppretter ny immutable revisjon. Vis versjonsliste og sammenligning av relevante endringer. Optimistisk låsing (rowVersion på statements sjekket i mutasjonen) beskytter samtidige redigeringer. Intern gjennomgang gjelder nøyaktig revisjon og kildehash. Endret tekst eller grunnlag markerer gjennomgang utdatert. Påminn om ekstern signering/publisering; ikke bygg styrekontoer eller signaturfelter som ser verifiserte ut.

Akseptkriterier
1. Kunden kan redigere, lagre ny versjon og åpne tidligere versjon.
2. Stale save gir konflikt med mulighet til å beholde egen tekst.
3. Review krever readiness-avklaring og eksplisitt brukerbekreftelse.
4. Status er Utkast eller Gjennomgått internt, aldri Signert/Publisert.

Tester og verifisering
Integrasjon: samtidige save, review av feil revisjon, endret grunnlag etter review og fremmed revisjon. E2E: rediger → ny versjon → gjennomgå → endre → review blir utdatert. Test XSS i Markdown/lenker.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

