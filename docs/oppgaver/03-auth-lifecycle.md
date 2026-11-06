# Oppgave 03: Invitasjon, verifisering og kontogjenoppretting

**Avhengighet:** 02. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 03: Invitasjon, verifisering og kontogjenoppretting.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gjør pilotens kontolivssyklus brukbar uten åpen selvregistrering.

Berørte filer/moduler
src/server/auth/, src/server/email/, src/modules/organizations/, scripts/provision-organization.ts, drizzle/, tests/integration/auth*, tests/e2e/auth*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Implementer kontrollert opprettelse av workspace/første admin via operatørkommando og invitasjon. Bare en admin i aktuell tenant kan invitere flere administratorer. Bruk Better Auths støttede mekanismer for emailverifisering, passordreset og sesjoner. Invitasjoner er engangs, utløper, lagres sikkert og krever riktig verifisert e-post. Sett opp Mailpit lokalt og et SMTP-interface; ingen produksjonsleverandør aktiveres her. Legg ratebegrensning på innlogging/reset som virker på tvers av prosessrestart eller bruker en dokumentert felles lagring; unngå account enumeration. Bruk sikre cookies og frameworkets origin/CSRF-mekanismer. Org.nr. er ingen eierskapsverifisering.

Akseptkriterier
1. Invite → verifisering → velg passord → login fungerer i Mailpit.
2. Feil e-post, utløpt eller brukt invitasjon gir ingen Membership.
3. Reset flyt virker, gammel lenke er ubrukelig og relevante sesjoner kan tilbakekalles.
4. Vanlig brukerinput kan ikke sette adminrolle eller velge fremmed tenant; dev-seed/provisionering kan ikke utilsiktet kjøre mot produksjon.

Tester og verifisering
Integrasjon: gjenbruk/utløp/feil mottaker, to samtidige akseptforsøk, ugyldig origin og rategrense. E2E: aksept og passordreset via lokal e-post. Kontroller at logg ikke inneholder token eller passord.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

