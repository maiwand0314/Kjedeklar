# Oppgave 10: CSV-opplasting og forhåndsvisning

**Avhengighet:** 09. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 10: CSV-opplasting og forhåndsvisning.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
La brukeren laste opp og forstå en CSV før den påvirker leverandørregisteret.

Berørte filer/moduler
src/domain/import/ (ren parser og normalisering), convex/suppliers/import/ (tenantAction for servervalidering), src/modules/suppliers/components/import/, tests/fixtures/csv/, tests/unit/csv*, tests/convex/csv*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Bruk et etablert CSV-bibliotek, ikke split(','). Støtt UTF-8/BOM, komma/semikolon, siterte felter og norske beløpsformater. Mapping av kolonner for navn, org.nr./ekstern ID, land og beløp; valgfrie bransje-/kjøpsfelter. 2 MiB/2 000 rader. Vis kildekolonne, normalisert verdi, radfeil, dubletter og foreslått matching. Ingen endring av leverandørdata i denne oppgaven. Den rene parseren i `src/domain/import/` kjøres også på server: filen sendes som bytes til en `tenantAction` som håndhever 2 MiB / 2 000 rader og parser i minne. Råfil lagres aldri, verken i tabeller, Convex file storage eller logg. Legg en syntetisk CSV-mal i repoet.

Akseptkriterier
1. Kolonnemapping og feil kan gjennomgås før import.
2. Ukjent land, ugyldig org.nr., tvetydig beløp og negative beløp blir synlige avklaringer.
3. Filer over grense avvises tidlig; filinnhold renderes som tekst.
4. Råfil lagres ikke i Convex (tabeller eller file storage) eller i logg.

Tester og verifisering
Fixtures for BOM, separatorer, escaped quotes, linjeskift, tomt felt, liknende navn, eksakt beløp, ugyldig encoding og fil-/radgrense. Test HTML/script-lignende navn og regnearkformler som ubetrodd tekst. Manuell preview med feilfil.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

