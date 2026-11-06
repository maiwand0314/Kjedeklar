# Kjedeklar – arbeidsregler for Claude Code

## Prosjekt og omfang
Kjedeklar (kjedeklar.no) er en norsk SaaS for arbeidet med åpenhetsloven. Målgruppen er virksomheter nær lovens størrelsesterskler, med få interne fagressurser. Verktøyet støtter menneskers vurderinger; det sertifiserer ikke etterlevelse og dokumenterer ikke faktisk fravær av menneskerettighetsbrudd.

MVP: oppstart med Brreg, veiledende pliktvurdering, CSV-import, leverandørregister, forklarbar risikotriage, manuell vurdering av egen virksomhet/funn/tiltak, valgfri AI-hjelp, redigert og versjonert redegjørelse og PDF. Pilotkunder opprettes kontrollert; abonnement faktureres manuelt.

Utenfor MVP: leverandørportal/spørreskjema, automatisk oversettelse og purring, regnskapsintegrasjoner, sanksjonsscreening, BankID, digital signering, offentlig publiseringsside, informasjonsinnboks, betalingsintegrasjon og automatisk årshjul. Kunden håndterer signering, publisering og informasjonskrav utenfor systemet. Ikke bygg disse funksjonene uten en egen oppgave.

Les `docs/ARKITEKTUR.md`, `docs/DATAMODELL.md`, `docs/FAGLIGE_AVKLARINGER.md` og den aktuelle oppgaven under `docs/oppgaver/`. `docs/OPPGAVER.md` er oversikt. Opprett bare skjema og moduler som trengs i aktuell oppgave. Oppdater `docs/STATUS.md` ved avslutning med verifisert status, kjørte kommandoer og gjenstående begrensninger.

## Teknologi
- Én modulær monolitt: Next.js App Router, React, TypeScript strict, Node.js 24 LTS, pnpm.
- Tailwind CSS og shadcn/ui; React Hook Form og Zod der skjema trenger det.
- PostgreSQL 18, Drizzle ORM og eksplisitte SQL-migrasjoner for RLS/roller/rettigheter.
- Better Auth med Drizzle-adapter og egne kontrollerte Membership/Organization-modeller. Ikke implementer passordhashing eller sesjoner selv. Ikke bland inn organisasjonsplugin med overlappende medlemskap uten en godkjent arkitekturbeslutning.
- Vitest, reell PostgreSQL for integrasjonstester, Playwright for viktige brukerflyter og PDF med lokal Chromium.
- Docker Compose lokalt og ved første drift. Separat worker fra samme repo for varige jobber via en liten Job-tabell med leasing; ingen Redis i MVP.
- Nodemailer over godkjent EU/EØS-SMTP. Mailpit kun lokalt. AI bak egen adapter, deaktivert som standard.
- Velg stabile kompatible pakkeversjoner i oppgave 01, dokumenter dem og commit pnpm-lock.yaml. Ingen prerelease og ingen `latest`-tagger i driftsfiler. Les installert dokumentasjon før du gjenbruker API-er fra hukommelsen.

## Struktur
```text
src/
  app/                     # ruter, layouts og HTTP-adaptere
    (auth)/
    (app)/
    api/auth/[...all]/
  components/ui/           # delte UI-primitiver
  modules/
    organizations/        # medlemskap, pliktvurdering, virksomhetsprofil
    suppliers/            # leverandører, import, Brreg-beriking
    risk/                 # ren regelmotor, dataversjoner, vurderinger
    diligence/            # egen virksomhet, funn, tiltak og resultater
    statements/           # grunnlag, utkast, versjoner, PDF
    audit/
  server/
    auth/                  # Better Auth, sesjon, kontrollert onboarding
    db/schema/
    tenancy/               # requireMembership, withTenant, autorisasjon
    integrations/brreg/
    ai/                    # ingen klienttilgang til nøkler eller provider
    email/
    jobs/
  worker.ts
drizzle/                   # migrasjoner, inkludert SQL-policyer
risk-data/                 # JSON/CSV + manifest, eksplisitt demo/produksjon
tests/{unit,integration,e2e,fixtures}/
scripts/
docs/{oppgaver,decisions}/
.github/workflows/ci.yml
```
Modulene bruker ved behov `schema.ts`, `service.ts`, `repository.ts`, `validation.ts` og `components/`. Ikke opprett tomme lag automatisk. Servermoduler merkes `server-only`; den rene regelmotoren skal kunne testes uten Next.js eller database.

## Multi-tenant er et ufravikelig sikkerhetskrav
1. `organization_id NOT NULL` på alle kundeeide rader, også Job, AiRun, import, vurdering, rapportversjon, eksport og audit. Organization er selv tenantroten. Auth-identiteter er globale; de gir ikke i seg selv tilgang til kundedata.
2. Hent userId fra verifisert sesjon. Valgt organisasjon er en kandidat, aldri et tilgangsbevis. Kontroller aktivt medlemskap og rolle på server for hver operasjon, også Server Actions, nedlasting og worker.
3. Bruk `withTenant(session, organizationId, callback)` som verifiserer medlemskap og utfører alle dataspørringer i samme transaksjon med `set_config('app.organization_id', value, true)`. Bruk transaksjonslokal kontekst, aldri varig SET på en gjenbrukt forbindelse. Ikke importer et ubeskyttet forretnings-DB-objekt i ruter.
4. SELECT/INSERT/UPDATE/DELETE-policyer med både USING og WITH CHECK. ENABLE og FORCE RLS. Runtime er ikke superuser, tabell-eier eller BYPASSRLS og har ikke DDL/TRUNCATE. Migrasjonslegitimasjon brukes aldri av appen.
5. Auth og medlemskapsoppslag har et smalt separat grensesnitt/DB-rolle uten leserettigheter til forretningsdata. Medlemskap kan bare opprettes gjennom kontrollert bootstrap/invitasjon. Dokumenter eventuell SECURITY DEFINER-funksjon, fast search_path, eksakte grants og test misbruk; foretrekk vanlig avgrenset rolle.
6. Bruk sammensatte nøkler/FK-er `(organization_id, id)` slik at en rad ikke kan referere til en annen tenants leverandør/rapport. Unike leverandøridentiteter gjelder innenfor tenant, ikke på tvers av kunder. Globalt org.nr.-oppslag er aldri kundetilgang.
7. Ingen global cache for kundeinnhold. Private HTTP-svar/PDF bruker no-store; kundespesifikke cache-nøkler må inkludere organisasjon og autorisasjonskontekst. Krysskundefeil skal ikke røpe at en ressurs eksisterer.
8. Integrasjonstester kjører som faktisk runtime-rolle og prøver uautorisert lesing, skriving, relasjonskobling, eksport, jobbkjøring og gjenbruk av pool-forbindelse mellom to organisasjoner. RLS er et ekstra vern; en kompromittert server med runtime-nøkkel er ikke avverget av tenant-konteksten alene.

## Revisjonslogg og historikk
Oppgave 01–04 er en lokal grunnmur uten kundedata; oppgave 05 etablerer domenets audit og kobler også eksisterende organisasjons-/medlemskapsendringer. Ingen pilot før dette er gjort. Authbibliotekets sikkerhetsmekanismer og trygg logging gjelder fra første oppgave.
- En forretningsendring og dens AuditEvent lagres i samme transaksjon; ved auditfeil rulles endringen tilbake.
- Logg aktør (bruker/system), tenant, UTC-tid fra server/DB, hendelsestype, objektreferanse, requestId, begrenset diff og begrunnelse der det kreves.
- Runtime kan ikke UPDATE/DELETE audit. Logg aldri passord, sesjonstoken, API-nøkler, full e-posttekst eller unødvendige personopplysninger. Diff er en eksplisitt tillatt feltliste.
- Vurderinger, manuelle overstyringer, godkjente dataversjoner og rapportversjoner bevares som historikk; nye input må ikke omskrive gamle resultater. Bevar kilde-, metode- og inputversjoner.
- Append-only på applikasjonsnivå er ikke beskyttelse mot DB-administrator. Påstå ikke at loggen er uforanderlig i absolutt forstand. Kontrollert sletting/pseudonymisering skjer gjennom dokumentert vedlikeholdsprosess med avklart lagringstid og egen autorisasjon.

## Risiko og faglig riktighet
- Scoring er deterministisk og regelbasert; AI får aldri sette/godkjenne score eller endre regler.
- Skill `screening_level` (lav/moderat/høy/ukjent), `data_quality` og brukerens dokumenterte vurdering. Nivåene er prioriteringsstøtte, ikke en statistisk sannsynlighet eller juridisk fasit.
- Innkjøpsbeløp påvirker bare sortering innenfor samme nivå. Det skal aldri redusere eller heve faglig risikonivå.
- Ukjent/manglende/utgått kilde, ukjent produksjonsland og ukjent bransje må vises eksplisitt og kreve oppfølging. Ingen stille lavrisiko-default. En kjent høy faktor skal fortsatt være høy selv om andre data mangler.
- Skill leverandørens registreringsland fra kjent produksjons-/arbeidsland og fra ukjent oppstrøms kjede. Norsk adresse innebærer ikke norsk produksjon.
- Registernotiser som nystiftet/konkurs er kontrollsignaler, ikke i seg selv bevis på menneskerettighetsbrudd. Ingen sanksjonsstatus uten faktisk integrasjon.
- Risikodata har kilde, utgave, metode, kodeverkversjon, lisensavklaring, hentetid, review-dato, ansvarlig og checksum. Aktiver bare godkjente produksjonsversjoner. Demo-fixtures må aldri brukes på kundedata.
- Regelendringer gir eksplisitt ny beregning; lagret vurdering skal alltid kunne gjenskapes. Leverandørendringer og nye regler gjør tidligere vurderinger utdaterte, med synlig status.
- Overstyring krever tekstlig begrunnelse og lagrer både opprinnelig og valgt nivå. Den skjuler ikke datamangler eller screeningresultat. Endret grunnlag krever ny bekreftelse.

## AI og dokumentgenerering
- Hele kjerneflyten skal fungere uten AI. Bruk providerinterface og fake i tester. Ingen fallback til et annet land eller en annen provider ved feil.
- Reelle data sendes bare til dokumentert godkjent behandling i EU/EØS. Kontroller inferens, lagring, misbrukslogger, supporttilgang, underleverandører og avtaler; regionnavn eller DPA alene er ingen garanti. Er kravet ikke avklart, forblir AI av.
- Minimer data. Ikke send kontaktpersoner eller komplette regnskaps-/leverandørlister når oppgaven kan løses med anonyme relevante felter. Ikke logg fulle prompts med kundedata.
- Leverandørnavn, CSV-felter og fritekst er ubetrodd innhold. AI har ikke verktøy, URL-henting, SQL eller utførende rettigheter. Valider strukturert output med Zod. Output er alltid forslag med inputreferanser, modell, promptversjon og tidspunkt.
- Bruk token-/kostnadsbudsjett per tenant, eksplisitt brukerhandling, timeout og begrensede retries. AI-feil må ikke miste menneskets arbeid.
- Ikke finn på tiltak, policyer, resultater, kontrollbesøk, signaturer eller at ingen brudd finnes. Manglende opplysninger blir synlige hull, aldri oppdiktede avsnitt.
- Redegjørelsen må skille screening fra bekreftede funn og bygge på egen virksomhet, rutiner, faktiske/potensielle konsekvenser, tiltak og resultater. Bruker godkjenner grunnlaget.
- Intern godkjenning er ikke underskrift. PDF merkes `Utkast – ikke signert` eller `Til ekstern signering – ikke signert`. Ingen innebygd publisering i MVP. Forklar kundens neste steg uten å hevde at eksport oppfyller loven alene.

## Personvern og drift
- Kundedata, sikkerhetskopier, logger, e-postbehandling, AI og ekstern overvåking skal følge det avtalte EU/EØS-kravet. Bruk ingen ekstern analytics eller frontend-CDN/fonttjeneste med dataflyt uten vurdering.
- Bare syntetiske data i git, CI, fixtures, screenshots og Claude Code. Ikke lim kundeeksporter eller produksjonshemmeligheter inn i kodeagenten. Secrets valideres ved oppstart og sjekkes aldri inn.
- TLS, HttpOnly/Secure/SameSite-cookies, origin/CSRF-kontroll, innloggingsratebegrensning, safe logging og gjenopprettbar backup før pilot.
- Importer begrenses til 2 MiB / 2 000 rader i MVP. Vis norske tall og NOK; lagre beløp i heltallsøre/bigint og datoer eksplisitt. Tidsstempler lagres i UTC, presenteres i Europe/Oslo. Rapportperioder er datoer, ikke UTC-midnatt beregnet fra brukerens nettleser.
- Ingen rå CSV eller nedlastede PDF-er i åpent webområde. PDF rendres uten eksterne nettverkskall, med lokal font og HTML-escaping. Eksport av regnearkvennlige felt må hindre formelinjeksjon.
- E-post krever verifisert avsender, SPF/DKIM/DMARC og håndtering av returmeldinger. Ved lokal utvikling brukes bare Mailpit, aldri ekte mottakere.

## Konvensjoner
- Engelsk kode/tabellnavn, norsk bokmål i UI, feilmeldinger og hjelpetekster. Profesjonelt rolig grensesnitt, responsivt, tastaturbetjenbart, synlige etiketter og feilmeldinger; risiko vises med tekst, ikke bare farge.
- Zod ved alle eksterne grenser. Parameterisert SQL. Forretningsregler i service/domene, ikke i React-komponenter. Kortfattede feil til bruker og requestId til feilsøking.
- Bruk databaseconstraints for integritet, optimistisk låsing der to utviklere/brukere kan overskrive samme vurdering, og idempotens for import/jobber/AI/PDF.
- Ikke innfør ny infrastruktur, generell pluginplattform eller store abstraksjoner uten et faktisk behov i oppgaven.

## Kommandoavtale
Oppgave 01 skal opprette disse scriptnavnene; de er planlagte frem til det er gjort. Script for senere moduler opprettes når modulen bygges. Ikke påstå at en kommando har kjørt før den faktisk er kjørt.
```bash
pnpm install --frozen-lockfile
docker compose up -d db mailpit
pnpm db:migrate
pnpm db:seed:dev
pnpm dev
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
# fra oppgave 12:
pnpm worker
# fra oppgave 14:
pnpm risk-data:validate
pnpm risk-data:import -- --file <manifest-path>
```
`db:migrate` bruker egen migrasjonsrolle. App/test bruker runtime-rolle. `db:seed:dev` og testreset nekter å kjøre mot produksjon. Test-DB skal være separat og opprettes etter dokumentert kommando i README; migrasjoner testes fra tom DB i CI. Aldri automatisk schema push i produksjon.

## Arbeidsflyt per oppgave
1. Les instrukser og relevant eksisterende kode; oppsummer kort og fortsett innenfor avklart scope. Ikke gjett på udokumenterte API-er.
2. Arbeid på én branch per oppgave, f.eks. `feature/01-foundation`. Ikke lag et eksternt repo eller push/deploy uten at det er del av den aktuelle bestillingen.
3. Implementer bare oppgaven. Skriv meningsfulle tester av risiko og akseptkriterier, inkludert feiltilfeller. Ingen test som bare speiler implementasjonen.
4. Kjør relevante sjekker og fullfør dem. Ved blokkert ekstern tjeneste bruker du fake for lokal verifikasjon og dokumenterer nøyaktig hva som ikke er integrasjonstestet. Aldri skjul feil eller svekk RLS/tester for å få grønt.
5. Oppsummer endring, tester, gjenværende avklaringer og manuell prøve. Oppdater STATUS. Stopp før neste oppgave. Den andre utvikleren gjennomgår diff før merge.
