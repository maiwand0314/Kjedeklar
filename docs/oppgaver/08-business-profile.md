# Oppgave 08: Rapportperiode og virksomhetsprofil

**Avhengighet:** 07. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 08: Rapportperiode og virksomhetsprofil.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Opprett årets dokumentasjonsgrunnlag for egen virksomhet, rutiner og ansvar.

Berørte filer/moduler
convex/schema.ts, convex/organizations/ (reportingPeriods, businessProfileRevisions), src/modules/organizations/components/, tests/convex/profile*, tests/integration/profile*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag `reportingPeriods` med eksplisitte datoer (`YYYY-MM-DD`-strenger) og publiseringsfrist, samt versjonert `businessProfileRevisions`. Skjema for organisering, drift/produkter, geografisk virksomhet, ansvar, retningslinjer, rutiner, interessentdialog og eventuell gjenopprettingsprosess. Skill ikke etablert/ukjent fra utfylt. Ikke påstå at kunden har en policy bare fordi feltet finnes. Kalenderår foreslås, avvikende perioder tillates. Ingen automatisk årshjul eller e-postvarsler.

Akseptkriterier
1. Kunden kan opprette og velge periode med start/slutt og eksplisitt frist.
2. Profilendringer lagres som historikk med audit og bekreftet status.
3. Usvarte spørsmål forblir synlige hull.
4. Valgt periode følger navigasjon og kan ikke referere til en annen tenant.

Tester og verifisering
Enhet: datoer, ugyldig intervall, avvikende regnskapsår. Integrasjon: ny profilversjon bevarer gammel, fremmed periode avvises av `getOwned`, audit ved endring. E2E-smoke av skjema og lagringsfeil.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

