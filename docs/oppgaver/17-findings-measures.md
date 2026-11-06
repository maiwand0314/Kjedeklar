# Oppgave 17: Manuelle funn, tiltak og oppfølging

**Avhengighet:** 16. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 17: Manuelle funn, tiltak og oppfølging.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md, docs/decisions/0001-convex-eu.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gi redegjørelsen reelt grunnlag utover leverandørscore uten å bygge leverandørskjema.

Berørte filer/moduler
src/modules/diligence/components/, convex/diligence/, convex/schema.ts, tests/convex/diligence*, tests/integration/diligence*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige tabeller/funksjoner/moduler.

Omfang
Lag enkle skjema og tenantmutasjoner for findings og measures, knyttet til perioden og valgfritt leverandør/vurdering. Støtt egen virksomhet, leverandørkjede og forretningsforbindelser; faktiske/potensielle konsekvenser, berørte rettigheter, alvorlighet, sannsynlighet og kort evidensnotat. Tiltak har ansvar, frist, planlagt/gjennomført status, forventet og observert resultat samt oppfølging. Ikke konverter screening til bekreftet brudd. Ingen dokumentopplasting eller sensitive personnavn. Registrer uttrykkelig dersom kunden ikke har identifisert funn eller ikke har vurdert dette ennå.

Akseptkriterier
1. Egen virksomhet kan ha funn uten leverandør.
2. Planlagte tiltak omtales ikke som utført; forventede resultater omtales ikke som observert.
3. Et funn kan ha flere tiltak; alle koblinger kontrolleres med getOwned, og ansvarlig må ha aktivt medlemskap i samme organisasjon.
4. Endringer logges og tidligere rapportgrunnlag kan fortsatt rekonstrueres via snapshot.

Tester og verifisering
Integrasjon: egen virksomhet uten supplier, fremmed finding/supplier/user som ansvarlig, ugyldige statusskifter, auditrollback og samtidige endringer. E2E: lag ett potensielt funn og ett planlagt tiltak med forventet resultat.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense, Convex-skjema eller pakkesett. Alle nye kundetabeller får tenant- og referansetester (`getOwned`), og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test mot lokal Convex-backend når tenantvern eller tilgangsregler er berørt; `convex-test` alene er ikke nok.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Push oppgavebranchen til GitHub (privat repo maiwand0314/Kjedeklar) når sjekkene er grønne, men ikke merge til main, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

