# Oppgave 06: Brreg-oppslag for egen virksomhet

**Avhengighet:** 05. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 06: Brreg-oppslag for egen virksomhet.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Hent nødvendige virksomhetsopplysninger på org.nr. og la kunden bekrefte dem.

Berørte filer/moduler
src/server/integrations/brreg/, src/modules/organizations/, tests/fixtures/brreg/, tests/unit/brreg*, tests/integration/organization*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Implementer server-side adapter til dokumentert Enhetsregister-endepunkt med org.nr.-validering, timeout, begrenset retry og Zod for valgte felt. Hent bare navn, org.nr., organisasjonsform, adresse, bransjekode og relevant status. Lag bekreftelsessteg og minimal RegistrySnapshot med kildetid. Organisasjonsnummer kan ikke brukes til å ta over eller slå sammen workspace. Ikke hent personroller eller forsøk å utlede årsverk/salgsinntekt fra antallAnsatte.

Akseptkriterier
1. Gyldig oppslag vises før kunden lagrer; kilde og hentetid er synlige.
2. 404, ugyldig org.nr., timeout, manglende bransje og API-endring gir forståelige feil/datamangler.
3. Brukerens tidligere bekreftede verdier overskrives ikke stille.
4. Endring og audit lagres atomisk; orgbytte gir ikke tilgang til en annen tenant.

Tester og verifisering
Adaptertester med realistiske syntetiske kontraktfixtures, 404/429/timeout/manglende felt. Integrasjon: bekreftet lagring og audit, uautorisert endring av fremmed org avvises. Live-oppslag er valgfri manuell kontroll, ikke en ustabil CI-avhengighet.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

