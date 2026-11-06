# Oppgave 19: AI-forslag til klassifisering og begrunnelser

**Avhengighet:** 18. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 19: AI-forslag til klassifisering og begrunnelser.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Hjelp brukeren med rotete kjøpsdata uten å gi AI beslutningsmyndighet.

Berørte filer/moduler
src/modules/suppliers/components/classification/, src/modules/risk/components/explanations/, convex/ai/prompts/, convex/ai/suggestions.ts, tests/unit/ai-suggestions*, tests/convex/ai-suggestions*, tests/integration/ai-suggestions*, tests/e2e/ai-suggestions*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag eksplisitte knapper for foreslå kjøpskategori og forklar gjeldende regler på norsk. Kategoriforslag er begrenset til godkjente kategorier med inputreferanser og kan svare ukjent. Forslag lages i Node-action via jobb fra oppgave 18. Aksept/avvisning lagres i aiSuggestions. Akseptert kategori endrer input gjennom vanlig tenantmutasjon med audit, aldri direkte fra en action, og krever ny regelberegning; AI setter aldri screeningnivå. Begrunnelsen bygger bare på triggeredRules og missingFields, og en deterministisk tekst finnes som fallback. Ikke send leverandørkontakter eller hele kundelisten.

Akseptkriterier
1. Ingenting endres før kunden aksepterer.
2. Forklaring stemmer med regel-ID, nivå og kilder; uunderbygde utsagn avvises/faller tilbake til mal.
3. Akseptert kategori gir sporbar inputendring, historikk og stale vurdering.
4. Avvisning og AI-feil bevarer eksisterende arbeid og nivå.

Tester og verifisering
Fixtures med prompt injection i leverandørnavn/kjøpstekst, ukjent kategori, forsøk på å endre score og begrunnelse som motsier faktagrunnlag. Integrasjon: aksept gjennom riktig tenant og audit; E2E med fake, ikke ekte kostbare kall.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

