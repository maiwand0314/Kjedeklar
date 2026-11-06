# Oppgave 25: Reproduserbar EU-staging og avsenderoppsett

**Avhengighet:** 24. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 25: Reproduserbar EU-staging og avsenderoppsett.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gjør løsningen klar til kontrollert staging i EU/EØS og test teknisk e-postlevering.

Berørte filer/moduler
Dockerfile (Next.js og PDF-worker), compose.staging.yml, reverse proxy-konfigurasjon hvis Next.js/worker selvhostes, .github/workflows/ (Convex-deploy til staging), scripts/deploy-check.ts, docs/DRIFT.md, docs/decisions/hosting.md, docs/decisions/data-processors.md
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Staging bruker en Convex Cloud-deployment i aws-eu-west-1; regionen kan ikke endres etterpå, så kontroller den før første deploy. Deploy key finnes bare i CI og hos navngitt operatør, aldri i Next.js, nettleser eller PDF-worker. Ingen `convex dev` mot staging eller produksjon. Velg og dokumenter EU/EØS-leverandør for hosting av Next.js og PDF-worker. Lag Docker-bygg for web og PDF-worker med Chromium-avhengigheter, ikke-root prosess, health/readiness, graceful shutdown og secrets utenfor image. Bruk TLS, med reverse proxy der Next.js/worker selvhostes. Dokumenter og sett opp staging bare hvis nødvendig konto/server/domene er gitt; ellers lever kjørbar lokal staging mot lokal Convex-backend og presise konfigurasjonstrinn uten å påstå deploy. Gi brukeren konkrete steg for å opprette Convex-konto/team, prosjekt med staging-deployment i EU-region og deploy key for CI; sjekk installert dokumentasjon/Convex-dokumentasjonen for gjeldende fremgangsmåte. Dokumenter SMTP-kandidat, SPF/DKIM/DMARC, reply-to og bounceflyt. Ingen kundeinnhold i e-post. Reell DNS-/SMTP-test bare med gitt tilgang og en eksplisitt testadresse; ingen bulkutsending.

Akseptkriterier
1. Containerne kan bygges og kjøres lokalt med stagingkonfigurasjon og syntetiske data.
2. Ingen dev-seed, deploy key utenfor CI/operatør, `convex dev` mot staging, produksjonssecret eller global AI-fallback i staging.
3. DRIFT angir versjoner, oppgraderinger, rekkefølge for Convex-deploy og Next.js-/worker-release, healthkontroll og tilbakerulling ved kompatible skjemaendringer.
4. Faktisk leverandør/region, tilgjengelige avtaler og uløste e-post-/EU-forhold dokumenteres ærlig.

Tester og verifisering
Bygg og smoke-test containerne, kontroller at Next.js og worker ikke har deploy/admin key, og at manglende secrets gir feil. Verifiser DNS og testlevering med tilgang; uten tilgang marker dette ikke verifisert. Test ugyldig health/dependency og at logs er redigert. Ingen produksjonsdeploy eller DNS-endring basert bare på denne generelle prompten.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

