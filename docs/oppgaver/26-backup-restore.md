# Oppgave 26: Backup, restore og driftskontroll

**Avhengighet:** 25. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 26: Backup, restore og driftskontroll.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Bevis at både database og privat PDF-lager kan gjenopprettes i valgt EU/EØS-oppsett.

Berørte filer/moduler
scripts/backup*, scripts/restore*, docs/DRIFT.md, docs/RESTORE-PROVE.md, infra/ hvis det finnes
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag kryptert backup av DB og private filer med begrenset tilgang, retention og separat EU/EØS-kopi. Ikke stol bare på VM-snapshot. Dokumenter nøkkelhåndtering og mål for datatap/gjenoppretting, f.eks. pilotmål 24t/4t som må måles, ikke en garanti. Gjenopprett en syntetisk installasjon til separat miljø; kontroller migrasjoner, runtimegrants, RLS og PDF-referanser. Sett enkel varselrutine/healthkontroll uten kundeinnhold. Restore-script skal nekte å overskrive produksjon uten et separat eksplisitt vedlikeholdssteg.

Akseptkriterier
1. Restore-prøve bevarer to tenants, vurderinger, audit, rapportversjon og nedlastbar PDF.
2. Backuper og nøkler havner ikke i git/CI; valgt lagringssted og tilgang er dokumentert.
3. Feilet backup kan oppdages og siste vellykkede tidspunkt finnes.
4. Sletting/restore tar hensyn til at gamle backuper ikke skal gjeninnføre slettede aktive brukere/kundedata uten oppfølging.

Tester og verifisering
Kjør faktisk backup→tomt separat miljø→restore med syntetiske data. Kjør tenanttester og PDF-hashkontroll etterpå. Test manglende nøkkel/fil og backupfeil. Logg observert tid og datatap i RESTORE-PROVE; ikke marker ikke-kjørt skylagring som verifisert.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

