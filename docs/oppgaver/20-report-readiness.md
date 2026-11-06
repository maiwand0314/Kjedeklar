# Oppgave 20: Kontroll av rapportgrunnlag og hull

**Avhengighet:** 19. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 20: Kontroll av rapportgrunnlag og hull.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Samle et sammenhengende grunnlag og vis hva kunden må avklare før gjennomgang.

Berørte filer/moduler
src/modules/statements/readiness/, src/modules/statements/source-snapshot.ts, tests/unit/statement-readiness*, tests/integration/statement-source*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag server-side source snapshot for valgt periode: virksomhetsprofil, leverandørtall, gjeldende vurderinger/review, dataversjoner, mangler, funn, tiltak og resultater. Bygg readiness-sjekkliste mot innholdsområdene i §5. Et tomt funnfelt betyr ikke ingen funn; krev kundens uttrykkelige beskrivelse av hva som er undersøkt/avdekket. Skill datadekning fra juridisk etterlevelse. Vurderinger/overstyringer som er utdaterte gir synlig avklaring. Ingen AI- eller PDF-generering her.

Akseptkriterier
1. Tall og tekstreferanser kommer fra én konsistent DB-snapshot og samme tenant/periode.
2. Manglende profil, uavklart risiko og fravær av tiltak/resultat vises med lenke til riktig skjema.
3. Utkast kan lages med hull, men kan ikke merkes gjennomgått uten avklaringskontroll.
4. Kunden ser at intern sjekkliste ikke er juridisk godkjenning.

Tester og verifisering
Readiness-matrise for tom kunde, kun score, egen virksomhet uten leverandører, utdatert vurdering, uttalt ingen identifiserte funn og manglende tiltak. Integrasjon: snapshot teller korrekt ved samtidige endringer og inneholder ingen fremmede kundedata.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

