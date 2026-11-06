# Oppgave 14: Versjonerte risikodata og faglig metodekontrakt

**Avhengighet:** 13. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 14: Versjonerte risikodata og faglig metodekontrakt.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Opprett dataformat og godkjenningsflyt før risikomotoren implementeres.

Berørte filer/moduler
risk-data/, src/domain/risk/datasets/ (Zod-skjema og validator), convex/schema.ts, convex/risk/ (interne import-/aktiveringsfunksjoner og lesefunksjoner), scripts/risk-data-*.ts, docs/decisions/risk-method-v0.md, tests/unit/risk-data*, tests/integration/risk-data*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Definer manifests og Zod-skjema for land-/bransjedata og selvstendig metodeversjon. Felter for kildeutgave, URL, lisensavklaring, ISO-land, SN/NACE-versjon, transformationsregel, review-dato, forfallsdato, reviewer, miljø og checksum. Tabellene er globale og har ikke `organizationId`. Skriv validator/import-/aktiveringskommando: skriving og aktivering skjer bare via interne Convex-funksjoner kjørt av operatør, og `pnpm risk-data:import` bruker admin/deploy key lokalt hos operatør, aldri i appen; aldri en kunde-API. Tenantfunksjoner leser bare aktiverte, godkjente versjoner gjennom egne lesefunksjoner. Opprett bare tydelig syntetiske demo-fixtures i testmiljø. Dokumenter ordinal max/ukjent-regel, prioriteringsrekkefølge og forskjell mellom kontrollsignaler og risikofaktorer. Ikke fyll ekte land med gjetninger. Eksisterende produksjonsversjon kan ikke endres på stedet.

Akseptkriterier
1. Ny dataversjon kan importeres og aktiveres uten kodeendring; gammel forblir lesbar.
2. Produksjonsaktivering av demo, uavklart lisens, manglende godkjenning eller ugyldig mapping avvises.
3. Kilder kan være utdaterte; dette blir en eksplisitt datakvalitetstilstand.
4. Metodekontrakten sier tydelig at dette er Kjedeklars screening, med krav om faglig gjennomgang før kundebruk.

Tester og verifisering
Validering: duplisert land, tvetydig bransjemapping, manglende kildereferanse, uventet kodeverk, endret checksum, utgått review, demo i prod. Integrasjon mot lokal backend: kunde kan ikke endre felles data (ingen offentlig skrivefunksjon, interne funksjoner kan ikke kalles fra klient), tenantfunksjoner ser ikke uaktiverte versjoner, og ny versjon endrer ikke gammel.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

