# Oppgave 02: Bevis tenant-isolasjonen

**Avhengighet:** 01. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 02: Bevis tenant-isolasjonen.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Herd grunnmuren og bevis at tenants ikke kan lese, endre eller koble hverandres data.

Berørte filer/moduler
src/server/tenancy/, src/server/db/, drizzle/*rls*.sql, tests/integration/tenancy.test.ts, docs/decisions/tenant-boundary.md
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Gjennomgå samtlige serverinnganger og DB-rettigheter. FORCE RLS, default-deny, USING/WITH CHECK og transaksjonslokal tenantkontekst skal være eksplisitte. Lag gjenbrukbar testhjelper for to kunder og kontroller at testforbindelsen bruker faktisk runtime. Avgrens auth/membership-rollen fra kundedata. Bruk Organization som ekte testobjekt; ikke legg inn en dummy produksjonstabell. Forbered en sjekkliste/testhelper for sammensatte FK-er når nye tabeller bygges. Dokumenter hvorfor valgt org i cookie/URL ikke er autorisasjon.

Akseptkriterier
1. Forsøk på fremmed org i URL, input og cookie gir samme avslag uten å røpe data.
2. Runtime er ikke eier/BYPASSRLS og kan ikke endre policyer eller TRUNCATE.
3. Tenantkontekst overlever ikke transaksjonen ved gjenbrukt poolforbindelse, rollback eller samtidige kall.
4. Authrollen kan ikke SELECT forretningsdata; medlemskap kan ikke tildeles via en vanlig kunde-request.

Tester og verifisering
Negative integrasjonstester for SELECT/INSERT/UPDATE/DELETE der operasjonen finnes; direkte SQL med manglende/fremmed kontekst; poolgjenbruk A→B→uten kontekst og rollback. Test faktisk rolle med DB-spørring og eksplisitt assertion. Sett fremtidige FK-misbrukstilfeller i testhelperen, ikke tomme grønne tester.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

