# Oppgave 08: Rapportperiode og virksomhetsprofil

**Avhengighet:** 07. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 08: Rapportperiode og virksomhetsprofil.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Opprett årets dokumentasjonsgrunnlag for egen virksomhet, rutiner og ansvar.

Berørte filer/moduler
src/modules/organizations/profile/, src/server/db/schema/reporting-period.ts, drizzle/, tests/integration/profile*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag ReportingPeriod med eksplisitte datoer og publiseringsfrist, samt versjonert BusinessProfileRevision. Skjema for organisering, drift/produkter, geografisk virksomhet, ansvar, retningslinjer, rutiner, interessentdialog og eventuell gjenopprettingsprosess. Skill ikke etablert/ukjent fra utfylt. Ikke påstå at kunden har en policy bare fordi feltet finnes. Kalenderår foreslås, avvikende perioder tillates. Ingen automatisk årshjul eller e-postvarsler.

Akseptkriterier
1. Kunden kan opprette og velge periode med start/slutt og eksplisitt frist.
2. Profilendringer lagres som historikk med audit og bekreftet status.
3. Usvarte spørsmål forblir synlige hull.
4. Valgt periode følger navigasjon og kan ikke referere til en annen tenant.

Tester og verifisering
Enhet: datoer, ugyldig intervall, avvikende regnskapsår. Integrasjon: ny profilversjon bevarer gammel, fremmed periode avvises med tenant-FK, audit ved endring. E2E-smoke av skjema og lagringsfeil.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

