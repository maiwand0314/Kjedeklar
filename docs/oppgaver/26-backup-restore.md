# Oppgave 26: Backup, restore og driftskontroll

**Avhengighet:** 25. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 26: Backup, restore og driftskontroll.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Bevis at både Convex-data og PDF-filer i Convex file storage kan gjenopprettes i valgt EU/EØS-oppsett.

Berørte filer/moduler
scripts/backup*, scripts/restore*, docs/DRIFT.md, docs/RESTORE-PROVE.md, infra/ hvis det finnes
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Backupenheten er Convex-eksport (`npx convex export`, inkludert filer; sjekk installert dokumentasjon for flagg) lagret kryptert i EU/EØS med begrenset tilgang, retention og separat kopi. Sjekk Convex-dokumentasjonen for innebygd backupfunksjon (tilgjengelighet, frekvens, lagringssted, region) og dokumenter den; ikke anta at den finnes eller dekker kravet. Dokumenter nøkkelhåndtering og mål for datatap/gjenoppretting, f.eks. pilotmål 24t/4t som må måles, ikke en garanti. Gjenopprett en syntetisk installasjon til ny, tom deployment (`npx convex import`); kontroller skjema, tenantfunksjoner, RLS-hjelper og pdfExports.storageId-referanser. Sett enkel varselrutine/healthkontroll uten kundeinnhold. Restore-script skal nekte å importere til produksjon uten et separat eksplisitt vedlikeholdssteg. Dokumenter hvem som har deploy key til eksport/import.

Akseptkriterier
1. Restore-prøve bevarer to tenants, vurderinger, audit, rapportversjon og nedlastbar PDF.
2. Backuper og nøkler havner ikke i git/CI; valgt lagringssted og tilgang er dokumentert.
3. Feilet backup kan oppdages og siste vellykkede tidspunkt finnes.
4. Sletting/restore tar hensyn til at gamle backuper ikke skal gjeninnføre slettede aktive brukere/kundedata uten oppfølging.

Tester og verifisering
Kjør faktisk Convex-eksport → ny tom deployment → import med syntetiske data. Kjør tenanttester og PDF-hashkontroll etterpå. Test manglende nøkkel/fil og backupfeil. Logg observert tid og datatap i RESTORE-PROVE; ikke marker ikke-kjørt skylagring som verifisert.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

