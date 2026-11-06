# Oppgave 13: Brreg-beriking av leverandører

**Avhengighet:** 12. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 13: Brreg-beriking av leverandører.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Berik norske leverandører kontrollert etter import uten å blokkere webrequesten.

Berørte filer/moduler
src/modules/suppliers/enrichment/, src/server/integrations/brreg/, src/server/jobs/handlers/, tests/integration/enrichment*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag batchjobber for org.nr.-oppslag med begrenset samtidighet og adapteren fra oppgave 06. Lagre minimal RegistrySnapshot, foreslå/oppdater avtalte registerfelter og vis status sist hentet/feilet/ikke relevant. Brukerrettede/overstyrte felt skal ikke overskrives uten bekreftelse. Skill registreringsstatus fra faglig menneskerettighetsrisiko. Eksterne leverandører uten norsk org.nr. må fungere manuelt.

Akseptkriterier
1. Import kan brukes mens beriking kjører; status per leverandør er synlig.
2. 429/timeout gir begrenset retry og delvis feilstatus uten tap av import.
3. Bransjekode har kodeverkversjon og hentetid; manglende kode blir ikke lav risiko.
4. Oppdatering gir audit og markerer relevant vurderingsgrunnlag endret når risikomodulen finnes.

Tester og verifisering
Integrasjon med fake Brreg: blanding av norske/utenlandske/manglende oppslag, restart og duplikatjobber, brukerredigering mens jobben kjører, cross-tenant payload og audit. Kontroller at nytteløs retries ikke fortsetter uendelig.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

