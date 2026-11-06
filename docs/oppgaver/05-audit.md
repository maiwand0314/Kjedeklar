# Oppgave 05: Transaksjonell revisjonslogg

**Avhengighet:** 04. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 05: Transaksjonell revisjonslogg.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Etabler en gjenbrukbar revisjonslogg før forretningsfunksjonene får mutasjoner.

Berørte filer/moduler
convex/schema.ts, convex/lib/audit.ts, convex/audit/, convex/organizations/, src/modules/audit/components/, tests/convex/audit*, tests/integration/audit*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag `auditEvents`, eksplisitt safe-diff og en audithjelper i `convex/lib/audit.ts` som tar mutasjonskonteksten fra `tenantMutation` eller en intern mutasjon, slik at audit alltid skrives i samme mutasjon som endringen. Koble den til endring av et reelt organisasjonsfelt og medlemskap/invitasjonshendelser uten token. Legg visning i Innstillinger med filtrering/paginering via `tenantQuery` og indeks som starter med `organizationId`. Tid settes på serveren (`Date.now()` i mutasjonen). Ingen offentlig eller intern funksjon oppdaterer eller sletter `auditEvents`, og RLS-hjelperen nekter endring av tabellen fra tenantfunksjoner. Dokumenter ærlig at deploy/admin key og Convex-dashboardet kan omgå dette, og beskriv en separat kontrollert vedlikeholds-/sletteprosess, ikke en kundeknapp for å endre historikk.

Akseptkriterier
1. Endring og audit er atomiske; feil i audit gir ingen endring.
2. Aktør, tenant, objektreferanse, hendelse, tidspunkt og safe diff lagres.
3. Fremmed kunde kan ikke se audit, og ingen appfunksjon kan omskrive den.
4. Passord, tokens og fritekst med unødvendige personopplysninger inngår ikke i diff.

Tester og verifisering
convex-test og integrasjon mot lokal backend: kastet feil i samme mutasjon etter audit-skriving ruller tilbake både domeneendring og audit; forsøk på å endre eller slette `auditEvents` via RLS-hjelperen avvises, og ingen eksportert funksjon gir slik mulighet; to tenants isoleres; tillatt diff inneholder bare avtalte felter. Manuell gjennomgang av en logget endring.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

