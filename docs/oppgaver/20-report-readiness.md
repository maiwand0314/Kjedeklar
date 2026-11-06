# Oppgave 20: Kontroll av rapportgrunnlag og hull

**Avhengighet:** 19. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 20: Kontroll av rapportgrunnlag og hull.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Samle et sammenhengende grunnlag og vis hva kunden må avklare før gjennomgang.

Berørte filer/moduler
src/domain/statements/readiness/, convex/statements/sourceSnapshot.ts, src/modules/statements/components/readiness/, tests/unit/statement-readiness*, tests/convex/statement-source*, tests/integration/statement-source*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag source snapshot i én Convex-query/-mutasjon for valgt periode, slik at alt leses konsistent: virksomhetsprofil, leverandørtall, gjeldende vurderinger/review, dataversjoner, mangler, funn, tiltak og resultater. Bygg readiness-sjekkliste mot innholdsområdene i §5 som ren logikk i src/domain/statements/. Et tomt funnfelt betyr ikke ingen funn; krev kundens uttrykkelige beskrivelse av hva som er undersøkt/avdekket. Skill datadekning fra juridisk etterlevelse. Vurderinger/overstyringer som er utdaterte gir synlig avklaring. Ingen AI- eller PDF-generering her.

Akseptkriterier
1. Tall og tekstreferanser kommer fra én konsistent lesing i samme Convex-funksjon og samme tenant/periode.
2. Manglende profil, uavklart risiko og fravær av tiltak/resultat vises med lenke til riktig skjema.
3. Utkast kan lages med hull, men kan ikke merkes gjennomgått uten avklaringskontroll.
4. Kunden ser at intern sjekkliste ikke er juridisk godkjenning.

Tester og verifisering
Readiness-matrise for tom kunde, kun score, egen virksomhet uten leverandører, utdatert vurdering, uttalt ingen identifiserte funn og manglende tiltak. Integrasjon: snapshot teller korrekt ved samtidige endringer og inneholder ingen fremmede kundedata.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

