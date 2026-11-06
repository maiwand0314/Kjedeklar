# Oppgave 03: Invitasjon, verifisering og kontogjenoppretting

**Avhengighet:** 02. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 03: Invitasjon, verifisering og kontogjenoppretting.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gjør pilotens kontolivssyklus brukbar uten åpen selvregistrering.

Berørte filer/moduler
convex/auth.ts, convex/auth.config.ts, convex/http.ts, src/lib/auth-client.ts, convex/email/, convex/organizations/, convex/ops/, src/modules/organizations/components/, convex/schema.ts, tests/integration/auth*, tests/e2e/auth*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Implementer kontrollert opprettelse av workspace/første admin via intern Convex-funksjon kjørt av operatør (`npx convex run ops/...`) og invitasjon. Bare en admin i aktuell tenant kan invitere flere administratorer. Bruk Better Auths støttede mekanismer via `@convex-dev/better-auth` for emailverifisering, passordreset og sesjoner. Invitasjoner er engangs, utløper, lagres sikkert (bare tokenHash) og krever riktig verifisert e-post; aksept oppretter medlemskap i én mutasjon. Sett opp Mailpit lokalt og et SMTP-interface med Nodemailer i en Convex Node-action; ingen produksjonsleverandør aktiveres her. Legg ratebegrensning på innlogging/reset med Better Auths innebygde mekanisme eller `@convex-dev/rate-limiter` (sjekk installert dokumentasjon for hva som lagres i Convex og virker på tvers av restart); unngå account enumeration. Bruk sikre cookies og frameworkets origin/CSRF-mekanismer. Org.nr. er ingen eierskapsverifisering.

Akseptkriterier
1. Invite → verifisering → velg passord → login fungerer i Mailpit.
2. Feil e-post, utløpt eller brukt invitasjon gir ingen Membership.
3. Reset flyt virker, gammel lenke er ubrukelig og relevante sesjoner kan tilbakekalles.
4. Vanlig brukerinput kan ikke sette adminrolle eller velge fremmed tenant; dev-seed/provisionering er interne funksjoner som ikke kan kalles fra klient og ikke utilsiktet kjøre mot produksjon.

Tester og verifisering
Integrasjon: gjenbruk/utløp/feil mottaker, to samtidige akseptforsøk, ugyldig origin og rategrense. E2E: aksept og passordreset via lokal e-post. Kontroller at logg ikke inneholder token eller passord.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

