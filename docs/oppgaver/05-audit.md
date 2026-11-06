# Oppgave 05: Transaksjonell revisjonslogg

**Avhengighet:** 04. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 05: Transaksjonell revisjonslogg.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Etabler en gjenbrukbar revisjonslogg før forretningsfunksjonene får mutasjoner.

Berørte filer/moduler
src/modules/audit/, src/server/db/schema/audit.ts, drizzle/, src/modules/organizations/service.ts, tests/integration/audit*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag AuditEvent, eksplisitt safe-diff og auditservice som krever eksisterende tenant-transaksjon. Koble den til endring av et reelt organisasjonsfelt og medlemskap/invitasjonshendelser uten token. Legg visning i Innstillinger med filtrering/paginering. Tid kommer fra server/DB. Runtime får INSERT og autorisert SELECT, ikke UPDATE/DELETE/TRUNCATE. Dokumenter separat kontrollert vedlikeholds-/sletteprosess, ikke en kundeknapp for å endre historikk.

Akseptkriterier
1. Endring og audit er atomiske; feil i audit gir ingen endring.
2. Aktør, tenant, objektreferanse, hendelse, tidspunkt og safe diff lagres.
3. Fremmed kunde kan ikke se audit og runtime kan ikke omskrive den.
4. Passord, tokens og fritekst med unødvendige personopplysninger inngår ikke i diff.

Tester og verifisering
Integrasjon: fremprovosert auditfeil ruller tilbake domeneendring; direkte UPDATE/DELETE av audit feiler; to tenants isoleres; tillatt diff inneholder bare avtalte felter. Manuell gjennomgang av en logget endring.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

