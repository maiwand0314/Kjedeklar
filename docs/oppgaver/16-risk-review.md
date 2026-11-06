# Oppgave 16: Risikoliste, forklaring og manuell overstyring

**Avhengighet:** 15. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 16: Risikoliste, forklaring og manuell overstyring.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gjør risikoresultatene nyttige og la kunden dokumentere egne beslutninger.

Berørte filer/moduler
src/modules/risk/components/, convex/risk/reviews.ts, convex/schema.ts, tests/convex/risk-review*, tests/integration/risk-review*, tests/e2e/risk*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag filterbar/paginert liste og detaljvisning med faktorer, kildeutgaver, datamangler og opprinnelig nivå. Egen synlig oppfølgingsgruppe for ukjent; innen samme nivå sorteres beløp fallende, nullbeløp eksplisitt. Bekreftelse/overstyring lagres som nytt assessmentReviews-dokument med begrunnelse, bruker og tidspunkt i en tenantmutasjon med audit. Vis screening og effektiv kundevurdering samtidig. Nye input gjør review utdatert og krever ny bekreftelse. Bruk optimistisk låsing (rowVersion/forventet gjeldende review sjekket i mutasjonen) og ingen stille siste-skriver-vinner.

Akseptkriterier
1. Brukeren kan forstå hvorfor en konkret regel slo ut og hvilke data som mangler.
2. Overstyring uten meningsfull begrunnelse avvises; originalberegningen bevares.
3. Liste og tellinger er tenant-/periodeavgrenset og skiller screening fra review.
4. Et overstyrt lavt nivå skjuler ikke opprinnelig høy screening eller ukjent oppstrøms.

Tester og verifisering
Integrasjon: manglende begrunnelse, samtidige review, input endret siden visning, fremmed assessment (getOwned) og auditrollback. E2E: forklaring → begrunnet overstyring → historikk. Sorteringstest beviser at stort beløp aldri flytter lav foran høy i en risikoprioritert liste.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

