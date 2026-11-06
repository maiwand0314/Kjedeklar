# Oppgave 14: Versjonerte risikodata og faglig metodekontrakt

**Avhengighet:** 13. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 14: Versjonerte risikodata og faglig metodekontrakt.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Opprett dataformat og godkjenningsflyt før risikomotoren implementeres.

Berørte filer/moduler
risk-data/, src/modules/risk/datasets/, src/server/db/schema/risk-dataset.ts, drizzle/, scripts/risk-data-*.ts, docs/decisions/risk-method-v0.md
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Definer manifests og Zod-skjema for land-/bransjedata og selvstendig metodeversjon. Felter for kildeutgave, URL, lisensavklaring, ISO-land, SN/NACE-versjon, transformationsregel, review-dato, forfallsdato, reviewer, miljø og checksum. Skriv validator/import-/aktiveringskommando med begrenset vedlikeholdsrolle; aldri en kunde-API. Opprett bare tydelig syntetiske demo-fixtures i testmiljø. Dokumenter ordinal max/ukjent-regel, prioriteringsrekkefølge og forskjell mellom kontrollsignaler og risikofaktorer. Ikke fyll ekte land med gjetninger. Eksisterende produksjonsversjon kan ikke endres på stedet.

Akseptkriterier
1. Ny dataversjon kan importeres og aktiveres uten kodeendring; gammel forblir lesbar.
2. Produksjonsaktivering av demo, uavklart lisens, manglende godkjenning eller ugyldig mapping avvises.
3. Kilder kan være utdaterte; dette blir en eksplisitt datakvalitetstilstand.
4. Metodekontrakten sier tydelig at dette er Kjedeklars screening, med krav om faglig gjennomgang før kundebruk.

Tester og verifisering
Validering: duplisert land, tvetydig bransjemapping, manglende kildereferanse, uventet kodeverk, endret checksum, utgått review, demo i prod. Integrasjon: kunde kan ikke endre felles data og ny versjon endrer ikke gammel.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

