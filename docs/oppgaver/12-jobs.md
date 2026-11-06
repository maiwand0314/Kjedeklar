# Oppgave 12: Varige bakgrunnsjobber

**Avhengighet:** 11. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 12: Varige bakgrunnsjobber.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag en liten robust jobbmekanisme for Brreg-batch, AI og PDF med Convex scheduler og `@convex-dev/workpool`.

Berørte filer/moduler
convex/jobs/, convex/convex.config.ts (workpool-komponent), convex/schema.ts, tests/convex/jobs*, tests/integration/jobs*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Implementer `jobs`-tabell (organizationId, type, inputRef, idempotencyKey, status, attempts, maxAttempts, runAfter, errorCode) og planlegg arbeid via `@convex-dev/workpool`. Ikke bygg generelt automasjonssystem, egen kø eller egen workerprosess; PDF-workeren kommer i oppgave 24. En `tenantMutation` oppretter jobben idempotent på (organizationId, type, idempotencyKey) med indeksoppslag i samme mutasjon og planlegger en intern handler. Handler velges fra en allowlist per type, og input valideres med validator/Zod. Handleren tar tenant fra den lagrede jobben, ikke fra ubetrodd payload, og kontrollerer inputRef med `getOwned`. Begrensede forsøk med backoff (workpool sine retry-innstillinger eller egen runAfter; sjekk installert dokumentasjon) og terminal feilstatus etter maks forsøk. Eksterne kall og langkjørende arbeid skjer i actions, ikke i mutasjoner. Resultater skrives via intern mutasjon som kontrollerer tenant og jobbstatus på nytt og er idempotente, siden actions ikke er exactly-once. Status leses bare via `tenantQuery`. Bruk kontrollert testhandler.

Akseptkriterier
1. Dobbel innsending gir én jobb, og samme jobb kjøres ikke dobbelt eller skriver resultat to ganger.
2. Feilet/avbrutt action retries til maks forsøk og får terminal feilstatus.
3. En jobb kan ikke skrive til feil tenant eller velge egen vilkårlig handler.
4. Interne jobbfunksjoner kan ikke kalles fra klient; status kan leses bare av rett kunde.

Tester og verifisering
convex-test med fake timers: dobbel innsending, feil/retry med backoff, idempotent resultat, fremmed objektreferanse, ukjent handler og terminal feil. Integrasjon mot lokal backend: status isoleres mellom tenants, og interne funksjoner kan ikke kalles fra klient. Bruk fake timers/korte testgrenser fremfor lange sleeps. Bekreft at Next.js ikke bruker deploy/admin key.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

