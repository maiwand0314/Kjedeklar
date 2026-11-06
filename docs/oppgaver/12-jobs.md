# Oppgave 12: Varige bakgrunnsjobber

**Avhengighet:** 11. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 12: Varige bakgrunnsjobber.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag en liten robust PostgreSQL-kø for Brreg-batch, AI og PDF.

Berørte filer/moduler
src/server/jobs/, src/worker.ts, src/server/db/schema/job.ts, drizzle/, tests/integration/jobs*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Implementer Job-tabell og én workerprosess med atomisk claim via SKIP LOCKED, lease, begrensede forsøk, backoff, status og idempotency key. Ikke bygg generelt automasjonssystem. Lag et smalt DB-grensesnitt som kun kan claime nødvendige jobbmetadata på tvers av tenants; runtime får ikke fri SELECT av alle payloads. Arbeid og resultater kjøres med eksplisitt tenantkontekst fra lagret jobb, ikke ubetrodd jobbpayload. Krev handlerallowlist og schemasjekk. Bruk kontrollert testhandler; langkjørende arbeid skjer uten lang DB-transaksjon.

Akseptkriterier
1. To workers behandler ikke samme aktive lease samtidig.
2. Jobb tas opp igjen etter crash/leaseutløp og får terminal feilstats etter maks forsøk.
3. En jobb kan ikke skrive til feil tenant eller velge egen vilkårlig handler.
4. Stoppsignal avslutter kontrollert; status kan leses bare av rett kunde.

Tester og verifisering
Integrasjon: konkurrerende claim, utløpt lease, feil/retry, idempotent resultat, fremmed objektreferanse, workerrestart og terminal feil. Bruk klokkeinjeksjon/korte testgrenser fremfor lange sleeps. Bekreft at web/worker ikke bruker migrator.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

