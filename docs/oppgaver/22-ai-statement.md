# Oppgave 22: AI-assistert redegjørelsesutkast

**Avhengighet:** 21. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 22: AI-assistert redegjørelsesutkast.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gi valgfri skrivehjelp basert utelukkende på bekreftet strukturert grunnlag.

Berørte filer/moduler
src/modules/statements/components/ai-draft/, convex/ai/prompts/statement.ts, convex/jobs/handlers/statement.ts, convex/statements/aiDraft.ts, tests/unit/statement-ai*, tests/convex/statement-ai*, tests/integration/statement-ai*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Kjør som jobb (jobs-tabell + scheduler/workpool fra oppgave 12) i Convex Node-action («use node») via AI-adapteren fra oppgave 18; modellen har aldri databasetilgang. Send minimert source snapshot med referanser til tillatte fakta, ikke rå kundeeksport. Be om strukturerte seksjoner og kilde-ID-er. Valider output, referanser og beskyttede faktafelt; bruk deterministiske blokker for kritiske tall/status som AI ikke kan endre. Uunderbygget eller feilaktig forslag avvises eller faller tilbake til mal; ikke stol på at en LLM kan kvalitetssikre seg selv. Godkjent output lagres som ny utkastversjon via intern mutasjon som kontrollerer tenant og grunnlag på nytt, med audit; kunden må gjennomgå den. Ved jobbfeil beholdes siste tekst.

Akseptkriterier
1. Ingen utsagn om utførte tiltak eller resultater oppstår uten tilsvarende data.
2. Ukjente referanser, endrede kritiske tall eller status gir avvisning.
3. AI- og malutkast har lik dokumentstruktur og samme krav til brukerreview.
4. Modell/prompt/grunnlag er sporbar internt; ingen automatisk godkjenning eller publisering.

Tester og verifisering
Fake-fixtures: oppdiktede tiltak, ukjente source-ID-er, endret leverandørtall, fritekstinjeksjon og timeout. Kontroller at avvist output ikke blir current revision. Integrasjon: tenantbudsjett, riktig snapshot, duplikatjobb og audit.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

