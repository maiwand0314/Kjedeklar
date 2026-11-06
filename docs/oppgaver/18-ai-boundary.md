# Oppgave 18: AI-grensesnitt med personvern- og kostnadsgrenser

**Avhengighet:** 17. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 18: AI-grensesnitt med personvern- og kostnadsgrenser.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Lag et sikkert valgfritt AI-lag som er deaktivert til faktisk leverandøroppsett er avklart.

Berørte filer/moduler
convex/ai/, convex/schema.ts, convex/jobs/handlers/ai.ts, docs/decisions/ai-provider.md, tests/unit/ai*, tests/convex/ai*, tests/integration/ai*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Definer adapter for strukturert input/output i Convex Node-actions («use node»), fake-provider, aiRuns, timeouts, begrenset retry, outputvalidering og tenantbudsjett. Legg konfigurasjon for foreslått Azure OpenAI-implementasjon; reell sending krever eksplisitt godkjent providerkonfigurasjon med EU/EØS-behandling og avtalt dataminimering. Ikke velg en global modell eller geografisk fallback ved manglende kapasitet. En konfigurasjonsbool er ikke dokumentasjon: registrer hvem som har vurdert region, behandling/logging/support og kildegrunnlag. AI-kall bestilles av en tenantmutasjon som jobb i jobs-tabellen og kjøres via scheduler/workpool fra oppgave 12; actionen får bare minimert input, og resultatet skrives via intern mutasjon som kontrollerer tenant på nytt. Modellen har aldri databasetilgang. Full flyt virker med AI av. AI har ingen verktøy/databasetilgang/URL-henting.

Akseptkriterier
1. AI er av som default; feil eller uavklart leverandør gir tydelig manuell vei.
2. Kun godkjente nødvendige felter sendes; prompts og tokens dumpes ikke i logger.
3. Maks token/kostnadsgrense per tenant og beskyttelse mot dobbel bestilling virker.
4. Modell, promptversjon, inputrefs/hash og usage lagres; output må passere skjema.

Tester og verifisering
Fake-provider: timeout, 429, ugyldig JSON, ekstraverktøyinstruksjoner i fritekst, kostnadsgrense og idempotent retry. Integrasjon: feil tenant i jobbreferanse og AI avslått når godkjenning mangler. Ekte API-test bare med syntetiske data; dokumenter hvis tilgang/avtale ikke finnes.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

