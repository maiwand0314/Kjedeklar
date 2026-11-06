# Oppgave 19: AI-forslag til klassifisering og begrunnelser

**Avhengighet:** 18. **Anslått aktiv tid:** 2–3 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 19: AI-forslag til klassifisering og begrunnelser.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Hjelp brukeren med rotete kjøpsdata uten å gi AI beslutningsmyndighet.

Berørte filer/moduler
src/modules/suppliers/classification/, src/modules/risk/explanations/, src/server/ai/prompts/, tests/unit/ai-suggestions*, tests/e2e/ai-suggestions*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Lag eksplisitte knapper for foreslå kjøpskategori og forklar gjeldende regler på norsk. Kategoriforslag er begrenset til godkjente kategorier med inputreferanser og kan svare ukjent. Aksept/avvisning lagres som AiSuggestion. Akseptert kategori endrer input gjennom vanlig service+audit og krever ny regelberegning; AI setter aldri screeningnivå. Begrunnelsen bygger bare på triggered_rules og mangler, og en deterministisk tekst finnes som fallback. Ikke send leverandørkontakter eller hele kundelisten.

Akseptkriterier
1. Ingenting endres før kunden aksepterer.
2. Forklaring stemmer med regel-ID, nivå og kilder; uunderbygde utsagn avvises/faller tilbake til mal.
3. Akseptert kategori gir sporbar inputendring, historikk og stale vurdering.
4. Avvisning og AI-feil bevarer eksisterende arbeid og nivå.

Tester og verifisering
Fixtures med prompt injection i leverandørnavn/kjøpstekst, ukjent kategori, forsøk på å endre score og begrunnelse som motsier faktagrunnlag. Integrasjon: aksept gjennom riktig tenant og audit; E2E med fake, ikke ekte kostbare kall.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

