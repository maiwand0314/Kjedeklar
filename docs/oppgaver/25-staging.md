# Oppgave 25: Reproduserbar EU-staging og avsenderoppsett

**Avhengighet:** 24. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 25: Reproduserbar EU-staging og avsenderoppsett.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gjør løsningen klar til kontrollert staging i EU/EØS og test teknisk e-postlevering.

Berørte filer/moduler
Dockerfile, compose.staging.yml, Caddyfile, scripts/deploy-check.ts, docs/DRIFT.md, docs/decisions/data-processors.md
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag Docker-bygg med web/worker og Chromium-avhengigheter, ikke-root prosess, health/readiness, graceful shutdown, secrets utenfor image og separate runtime/migrasjonslegitimasjoner. Dokumenter og sett opp staging bare hvis nødvendig konto/server/domene er gitt; ellers lever kjørbar lokal staging og presise konfigurasjonstrinn uten å påstå deploy. Velg EU/EØS-region eksplisitt, hold DB privat og bruk TLS. Dokumenter SMTP-kandidat, SPF/DKIM/DMARC, reply-to og bounceflyt. Ingen kundeinnhold i e-post. Reell DNS-/SMTP-test bare med gitt tilgang og en eksplisitt testadresse; ingen bulkutsending.

Akseptkriterier
1. Containerne kan bygges og kjøres lokalt med stagingkonfigurasjon og syntetiske data.
2. Ingen dev-seed, åpen DB-port, produksjonssecret eller global AI-fallback i staging.
3. DRIFT angir versjoner, oppgraderinger, migrasjon før release, healthkontroll og tilbakerulling ved kompatibel migrasjon.
4. Faktisk leverandør/region, tilgjengelige avtaler og uløste e-post-/EU-forhold dokumenteres ærlig.

Tester og verifisering
Bygg og smoke-test containerne, kontroller minste rettigheter og manglende-secrets-feil. Verifiser DNS og testlevering med tilgang; uten tilgang marker dette ikke verifisert. Test ugyldig health/dependency og at logs er redigert. Ingen produksjonsdeploy eller DNS-endring basert bare på denne generelle prompten.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

