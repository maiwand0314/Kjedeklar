# Oppgave 11: Bekreftet, idempotent CSV-import

**Avhengighet:** 10. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 11: Bekreftet, idempotent CSV-import.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lagre bare bekreftede importrader og hindre dubletter eller delvis skjult import.

Berørte filer/moduler
convex/schema.ts, convex/suppliers/import/, src/domain/import/, src/modules/suppliers/components/import/, tests/convex/import*, tests/integration/import*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Opprett `importBatches`/`importRows` fra servervalidert preview (tenantAction fra oppgave 10; råfil lagres aldri), med tenant, periode, hash, mappingversjon og utløp. Bind commit til dette grunnlaget. La bruker eksplisitt velge skip eller oppdater kjente leverandører; årets beløp erstattes med bekreftet aggregering, ikke summeres ved retry. Uklar navnematch må avklares. Commit skjer i Convex-mutasjoner innenfor Convex sine transaksjonsgrenser (sjekk installert dokumentasjon). Får ikke MVP-grensen plass i én mutasjon, lagres radene i batcher bundet til batchdokumentet med status og idempotens, slik at en avbrutt commit kan fullføres eller vises som ufullstendig, aldri delvis skjult. Validerte feilrader må rettes eller eksplisitt utelates før commit. Audit per batch med relevante endringsreferanser; dokumenter nødvendig detaljnivå uten full råfil.

Akseptkriterier
1. Dobbelklikk, retry og identisk fil for samme mapping/periode gir ikke flere leverandører eller dobbelt beløp.
2. Stale/utløpt preview eller endret leverandør etter preview gir konflikt og ny bekreftelse.
3. Resultat viser opprettet/oppdatert/utelatt og valgte feilrader.
4. Fremmed batch eller `targetSupplierId` kan ikke importeres (`getOwned`).

Tester og verifisering
Integrasjon: to samtidige commit, feil midt i en batch (mutasjonen rulles tilbake og batchstatus viser ufullstendig), gjentatt fil, endret mapping, matchkonflikt, fremmed tenant og auditrollback. E2E: preview → velg håndtering → commit → kontroller totalsum og liste.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

