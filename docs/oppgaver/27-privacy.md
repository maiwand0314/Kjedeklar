# Oppgave 27: Personvern, kundeeksport og kontrollert sletting

**Avhengighet:** 26. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 27: Personvern, kundeeksport og kontrollert sletting.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag konkrete kundedokumentutkast og en begrenset operasjonell datarettighetsprosess.

Berørte filer/moduler
docs/PERSONVERN-UTKAST.md, docs/DATABEHANDLERAVTALE-UTKAST.md, docs/VILKAR-UTKAST.md, docs/decisions/retention.md, scripts/customer-export.ts, scripts/customer-delete.ts
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Beskriv faktiske data, formål, behandlingsroller, underleverandører, lokasjoner, supporttilgang, lagringstid, innsyn/sletting, hendelser og backup. Marker ukjente kontrakt-/selskapsopplysninger som avklaringer; ikke finn på DPA-er eller påstå juridisk godkjenning. Vilkår beskriver beslutningsstøtte, kundens gjennomgang/signering/publisering og faktiske tjenestegrenser. Lag operatørkommando for tenantavgrenset eksport og en dry-run-sletteplan. Selve sletting testes i isolert syntetisk miljø, krever eksplisitt tenant-ID/vedlikeholdsautorisasjon og avklart retention, aldri en åpen kunde-API. Gjør skillet mellom runtime append-only og autorisert rettighetsprosess tydelig.

Akseptkriterier
1. Dokumentutkast stemmer med implementerte funksjoner og faktisk valgte/ikke valgte leverandører.
2. Kunden kan få en strukturert eksport av egne data; ingen annen tenant følger med.
3. Dry-run viser DB-rader, privatfiler, AI-output og auth-forhold som berøres.
4. En bruker med medlemskap i to tenants slettes ikke globalt ved avslutning av bare én kunde; backup-policyen beskriver utsatt sletting og restore-sperrer.

Tester og verifisering
Integrasjon med to kunder og delt bruker: eksportgrenser, korrekt tenant-sletteplan, manglende vedlikeholdstilgang og feil tenant-ID. Prøv sletting kun i testmiljø og bevis at andre kundens data bevares. Gjennomgå dokumentene mot en faktisk datakartlegging; ekstern faglig vurdering står som gjenstående hvis den ikke foreligger.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

