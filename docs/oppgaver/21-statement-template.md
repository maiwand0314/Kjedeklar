# Oppgave 21: Malbasert redegjørelse uten AI

**Avhengighet:** 20. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 21: Malbasert redegjørelse uten AI.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Generer et nyttig strukturert utkast som fungerer uten ekstern modell.

Berørte filer/moduler
src/modules/statements/templates/, src/modules/statements/service.ts, src/server/db/schema/statement.ts, drizzle/, tests/unit/statement-template*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag norsk versjonert mal for organisering/virksomhet/rutiner, metode og omfang, avdekkede faktiske konsekvenser/vesentlig risiko, tiltak/forventede eller observerte resultater og kjente begrensninger. Bruk source snapshot og eksplisitte plassholdere for mangler. Ikke fyll inn policyer, tilsynsbesøk eller positive garantier som ikke finnes. Lag Statement og immutable StatementRevision med templateversjon, input-/contenthash og kildekoblinger. Intern detaljvisning kan vise kilde-ID-er; offentlig tekst skal ikke røpe kontaktpersoner eller rå leverandørliste.

Akseptkriterier
1. Generering virker helt uten AI-nøkkel.
2. Det fremgår hva som faktisk er dokumentert og hva som mangler.
3. Rapporten har periode, virksomhet og merket status Utkast – ikke signert.
4. Ny generering oppretter ny revisjon og overskriver ikke tidligere tekst.

Tester og verifisering
Innholdstester for komplett syntetisk grunnlag og ufullstendig grunnlag. Kontroller planlagt kontra gjennomført og forventet kontra observert. Test escaping og at ingen automatisk liste over kontaktpersoner/raw supplierdata følger med. Integrasjon: revisionsnummer, snapshots, RLS og audit.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

