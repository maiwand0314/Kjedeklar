# Oppgave 29: Samlet pilotprøve og konkret lanseringsbeslutning

**Avhengighet:** 28. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 29: Samlet pilotprøve og konkret lanseringsbeslutning.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Verifiser hele MVP-en med syntetiske virksomheter og gi en konkret liste over hva som er klart til pilot.

Berørte filer/moduler
tests/e2e/mvp-flow.spec.ts, docs/PILOTSTATUS.md, docs/STATUS.md, eventuelle små feilrettinger i berørte moduler
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Kjør én sammenhengende prøve: invitert admin → org.nr./bekreftet grunnlag → periode/profil → CSV med feilretting → beriking → screening → begrunnet overstyring → eget funn/tiltak → mal/AI-utkast → redigering → intern review → PDF. Prøv to tenants og AI av, samt fake AI-feil. Samle bare nødvendige manglende regresjonstester; ikke dupliser alle enhetstester. Gjennomgå e-post, dataflyt, fagdekning, dokumentutkast, backup/restore og ekstern signering/publisering, samt status for Convex-avklaringene i docs/decisions/0001-convex-eu.md (DPA, underleverandører og overføringsgrunnlag, backup/logg/support, dashboard- og deploy key-tilgang). Ikke legg til nye funksjoner eller skjul blokkeringer for å erklære ferdig.

Akseptkriterier
1. Alle gjennomgåtte akseptkriterier har faktisk test-/reviewevidens, ikke bare avkrysning.
2. Ingen høy risiko for tenantlekkasje, feil data i PDF eller oppdiktet rapportfakta gjenstår.
3. PILOTSTATUS skiller lokal test, faktisk ekstern integrasjon og uløste menneskelige/kontraktuelle avklaringer.
4. Hvis AI ikke er avklart men øvrig flyt er klar, kan manuell pilot foreslås med AI av. Reell kundetilgang krever avklart databehandling, lukkede Convex-avklaringer i beslutning 0001 og faglig forsvarlig håndtering av dekning. Ingen automatisk produksjonsrelease.

Tester og verifisering
Kjør lint/typecheck, relevante unit/integration, full kritisk e2e og build i ren CI. Manuell PDF-kontroll og gjentatt sentral tenant-negativtest gjennom nedlasting. Dokumenter faktisk utført restore fra oppgave 26; ikke gjenta skyhandlinger uten grunn. Oppsummer konkrete feil/åpne avklaringer og foreslå neste minste retting ved blokkering.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

