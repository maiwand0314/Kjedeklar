# Oppgave 07: Veiledende vurdering av lovens virkeområde

**Avhengighet:** 06. **Anslått aktiv tid:** 2–4 timer, gitt at avhengighetene er ferdige. Eksterne tilganger, fagreview og kontraktsavklaringer kan komme i tillegg.

Kopier hele blokken til Claude Code fra repoets rot:

```text
Start oppgave 07: Veiledende vurdering av lovens virkeområde.

Les CLAUDE.md, docs/ARKITEKTUR.md, docs/DATAMODELL.md, docs/FAGLIGE_AVKLARINGER.md og docs/STATUS.md. Undersøk eksisterende kode før du endrer den. Gjør bare denne oppgaven; ikke start neste.

Mål
Gi en forklarbar, veiledende pliktvurdering med synlig usikkerhet og versjonerte regler.

Berørte filer/moduler
src/modules/organizations/applicability/, drizzle/, docs/decisions/applicability-rules.md, tests/unit/applicability*
Tilpass stier til etablert repo uten å flytte uvedkommende kode. Opprett bare nødvendige migrasjoner/moduler.

Omfang
Les gjeldende §§2–3 og dokumenter sannhetstabell før implementasjon. Be om salgsinntekt, balansesum og gjennomsnittlige årsverk for to år, tidligere status, konsern/allmenn interesse og norsk/utenlandsk tilknytning. For ordinære norske tilfeller med avklart historikk: sannsynlig omfattet/ikke omfattet. Konsern, særlige virkeområder, overgangstilfeller med ukjent historikk eller ufullstendig input gir manuell avklaring. Ikke lag en omfattende juridisk ekspertmotor. Vis input, terskler, regelversjon og begrunnelse; la kunden bekrefte grunnlaget.

Akseptkriterier
1. Nøyaktig terskel behandles etter lovens ordlyd; antallAnsatte fra Brreg brukes ikke som årsverk.
2. Toårsregelen inngår i testmatrisen; ukjent historikk gir ikke skråsikkert nei.
3. Alle resultater er veiledende og lagres som ny historikk med kundens bekreftelse.
4. Et sannsynlig ikke-omfattet foretak kan fortsatt bruke verktøyet frivillig; ingen automatisk utestenging.

Tester og verifisering
Tabellstyrte tester for 0/1/2/3 overskredne terskler, lik terskel, ett/to sammenhengende år, ny overgang og ukjent historikk, konsern/allmenn interesse/utenlandsk virksomhet. Testmatrisen må bygge på lest kilde; ved uløst tolkning skal utfallet være manuell avklaring. Integrasjon for tenant og audit.
Kjør lint og typecheck samt relevante tester. Kjør build ved endret frameworkkonfigurasjon, server-/klientgrense eller pakkesett. Alle nye kundetabeller får tenant-/FK-tester, og fra oppgave 05 får alle nye mutasjoner audit med rollback-test der dette ikke allerede er dekket av testhjelperen. Test i reell PostgreSQL når SQL/tilgangsregler er berørt; ikke erstatt dette med mocks.

Avslutning
Oppdater docs/STATUS.md med endringer, faktisk kjørte kommandoer/resultater, manuell prøve og eventuelle eksterne avklaringer. Si tydelig hva som ikke er verifisert. Lever en avgrenset diff klar til review av den andre utvikleren. Ikke push, merge, deploy, send ekte e-post eller start neste oppgave uten at det inngår i en konkret videre bestilling.
```

