# Oppgave 28: Første faglig gjennomgåtte risikodataversjon

**Avhengighet:** 27. **Anslått aktiv tid:** 2–4 per avgrenset gjennomgang timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 28: Første faglig gjennomgåtte risikodataversjon.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Erstatt demo med en liten dokumentert produksjonsdataversjon innenfor avklart pilotdekning.

Berørte filer/moduler
risk-data/production/, docs/decisions/risk-sources.md, docs/decisions/risk-method-v0.md, tests/fixtures/risk-data-approved/
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Avgrens første kilderunde til land/bransjer de planlagte pilotkundene faktisk trenger; f.eks. maks fem land og tre bransje-/produktkategorier denne kvelden. Sjekk faktisk kilde, utgave, rett til kommersiell bruk, transformasjon og begrensninger. Claude kan strukturere og validere dokumenterte data, men kan ikke tildele seg faglig godkjenning eller finne på risikoverdier/reviewernavn. Importer godkjent versjon bare når menneskelig fagreview og lisensavklaring foreligger. Ellers behold ukjent og lever en presis mangelliste. Repeter som nye små dataversjoner ved større dekningsbehov; ikke behandle hele verdens mapping som én kveld.

Akseptkriterier
1. Hver aktiv datapost har etterprøvbar kilde, kodeverk/utgave, lisensstatus og ekte reviewspor.
2. Demo kan ikke brukes på pilotkundedata; manglende dekning vises ukjent.
3. Kilder/mapping og metode er skilt, versjonert og mulig å gjenskape.
4. Grensesnitt og rapport viser begrensninger uten å fremstille indikatoren som bevis mot en leverandør.

Tester og verifisering
Kjør risk-data:validate og import/aktivering i staging via interne funksjoner kjørt av operatør, sammenlign utvalgte poster manuelt mot primærkilden, test hull/utgått kilde og gjenskap en historisk vurdering. Ingen testforventninger oppdateres bare fordi ny motor gir et nytt tall. Hvis godkjenning eller kildebruk mangler, avslutt med eksplisitt blokkert aktivering fremfor falsk grønn status.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

