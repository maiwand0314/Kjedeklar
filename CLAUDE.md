# Kjedeklar – arbeidsregler for Claude Code

## Prosjekt og omfang
Kjedeklar (kjedeklar.no) er en norsk SaaS for arbeidet med åpenhetsloven. Målgruppen er virksomheter nær lovens størrelsesterskler, med få interne fagressurser. Verktøyet støtter menneskers vurderinger; det sertifiserer ikke etterlevelse og dokumenterer ikke faktisk fravær av menneskerettighetsbrudd.

MVP: oppstart med Brreg, veiledende pliktvurdering, CSV-import, leverandørregister, forklarbar risikotriage, manuell vurdering av egen virksomhet/funn/tiltak, valgfri AI-hjelp, redigert og versjonert redegjørelse og PDF. Pilotkunder opprettes kontrollert; abonnement faktureres manuelt.

Utenfor MVP: leverandørportal/spørreskjema, automatisk oversettelse og purring, regnskapsintegrasjoner, sanksjonsscreening, BankID, digital signering, offentlig publiseringsside, informasjonsinnboks, betalingsintegrasjon og automatisk årshjul. Kunden håndterer signering, publisering og informasjonskrav utenfor systemet. Ikke bygg disse funksjonene uten en egen oppgave.

Les `docs/ARKITEKTUR.md`, `docs/DATAMODELL.md`, `docs/FAGLIGE_AVKLARINGER.md`, `docs/decisions/0001-convex-eu.md` og den aktuelle oppgaven under `docs/oppgaver/`. `docs/OPPGAVER.md` er oversikt. Opprett bare tabeller, funksjoner og moduler som trengs i aktuell oppgave. Oppdater `docs/STATUS.md` ved avslutning med verifisert status, kjørte kommandoer og gjenstående begrensninger.

## Teknologi
- Én kodebase: Next.js App Router som grensesnitt, Convex som database og backend, React, TypeScript strict, Node.js 24 LTS, pnpm.
- Convex Cloud i region `aws-eu-west-1` (Irland) for staging og produksjon. Lokalt og i CI kjøres Convex sin åpne backend i Docker. Selvhostet Convex på EU/EØS-VPS er en senere mulighet; ikke bruk cloud-eksklusive funksjoner uten en beslutning i `docs/decisions/`.
- Tailwind CSS og shadcn/ui; React Hook Form og Zod der skjema trenger det.
- Convex-skjema med validatorer (`convex/schema.ts`), queries, mutasjoner, actions, scheduler og fillagring. Komponenter: `@convex-dev/better-auth`, og `@convex-dev/workpool` fra oppgave 12. `convex-helpers` for egne funksjonsbyggere og RLS-hjelper.
- Better Auth via `@convex-dev/better-auth`, med egne kontrollerte `organizations`/`memberships`-tabeller i appens skjema. Ikke implementer passordhashing eller sesjoner selv. Ikke bland inn Better Auths organisasjonsplugin med overlappende medlemskap uten en godkjent arkitekturbeslutning.
- Vitest for ren logikk, `convex-test` for raske funksjonstester, integrasjonstester mot lokal Convex-backend, Playwright for viktige brukerflyter. PDF med lokal Chromium i en egen Node-worker (oppgave 24).
- Docker Compose lokalt for Convex-backend og Mailpit. Varige jobber via Convex scheduler/workpool og en liten `jobs`-tabell; ingen Redis, ingen egen kø-infrastruktur.
- Nodemailer i Convex Node-actions over godkjent EU/EØS-SMTP. Mailpit kun lokalt. AI bak egen adapter i Convex-actions, deaktivert som standard.
- Velg stabile kompatible pakkeversjoner i oppgave 01, dokumenter dem og commit pnpm-lock.yaml. Pakker under 1.0 (f.eks. `@convex-dev/better-auth`) låses eksakt. Ingen prerelease og ingen `latest`-tagger, heller ikke for Docker-images. Les installert dokumentasjon før du gjenbruker API-er fra hukommelsen.

## Struktur
```text
convex/
  schema.ts               # alle tabeller og indekser
  convex.config.ts        # komponenter
  auth.config.ts, auth.ts # Better Auth i Convex
  http.ts                 # auth-ruter og smale HTTP-endepunkter
  lib/                    # tenant.ts (tenantQuery/Mutation/Action), rls.ts, getOwned, errors, audit
  organizations/          # medlemskap, pliktvurdering, virksomhetsprofil
  suppliers/              # leverandører, import, Brreg-beriking
  risk/                   # dataversjoner, vurderinger (bruker ren motor fra src/domain/risk)
  diligence/              # egen virksomhet, funn, tiltak og resultater
  statements/             # grunnlag, utkast, versjoner, PDF-metadata
  audit/
  jobs/
  ai/                     # ingen klienttilgang til nøkler eller provider
  email/
  integrations/brreg/
  ops/                    # interne funksjoner: bootstrap, seed, vedlikehold
src/
  app/                    # ruter, layouts og HTTP-adaptere
    (auth)/
    (app)/
    api/auth/[...all]/
  components/ui/          # delte UI-primitiver
  modules/<domene>/components/
  domain/                 # ren TypeScript uten Convex/Next, f.eks. risk/ og import/
  lib/                    # auth-klient, Convex-provider
worker/                   # PDF-worker fra oppgave 24
risk-data/                # JSON/CSV + manifest, eksplisitt demo/produksjon
tests/{unit,convex,integration,e2e,fixtures}/
scripts/
docs/{oppgaver,decisions}/
.github/workflows/ci.yml
```
Convex-moduler deles ved behov i `queries.ts`, `mutations.ts`, `actions.ts`, `model.ts` (hjelpere som tar `ctx`) og `validators.ts`. Ikke opprett tomme filer automatisk. Forretningsregler ligger i Convex-funksjoner eller `src/domain/`, ikke i React-komponenter. Den rene regelmotoren i `src/domain/risk/` skal kunne testes uten Next.js og Convex.

## Multi-tenant er et ufravikelig sikkerhetskrav
1. `organizationId: v.id("organizations")` er påkrevd på alle kundeeide dokumenter, også jobs, aiRuns, import, vurdering, rapportversjon, eksport og audit. `organizations` er selv tenantroten. Auth-identiteter er globale; de gir ikke i seg selv tilgang til kundedata.
2. Bruker-id hentes fra verifisert Better Auth-sesjon i Convex (`ctx.auth`/komponentens `getAuthUser`). Valgt organisasjon fra URL, cookie eller argument er en kandidat, aldri et tilgangsbevis. Kontroller aktivt medlemskap og rolle i Convex for hver operasjon, også ved nedlasting, scheduler-jobber og PDF-worker.
3. Alle offentlige Convex-funksjoner med kundedata lages med `tenantQuery`, `tenantMutation` eller `tenantAction` fra `convex/lib/tenant.ts`. De verifiserer bruker → aktivt medlemskap → rolle, setter `ctx.tenant = { organizationId, userId, role }` og gir en innpakket `ctx.db` som avviser dokumenter fra andre organisasjoner. Rå `query`/`mutation`/`action` fra `_generated/server` brukes bare i `convex/lib/` og for funksjoner uten kundedata; ESLint håndhever dette. Actions får aldri direkte `ctx.db`; de kaller interne queries/mutasjoner som eksplisitt får `organizationId` fra den verifiserte konteksten.
4. Alle indekser på kundetabeller starter med `organizationId`. Spørringer bruker `withIndex` med `organizationId`, aldri ubegrenset `.collect()` over en tabell eller `filter` som eneste tenantavgrensning.
5. Interne funksjoner (`internalQuery`/`internalMutation`/`internalAction`) kan bare kalles fra annen Convex-kode eller med deploy/admin key. Medlemskap kan bare opprettes gjennom kontrollert bootstrap/invitasjon. Deploy key og admin key er migrasjons-/operatørlegitimasjon: aldri i Next.js, nettleser, PDF-worker eller logger.
6. Convex har ikke fremmednøkler. Hver id som kommer inn eller lagres som referanse, lastes via `getOwned(ctx, table, id)` som kontrollerer `organizationId` mot `ctx.tenant`. Unike leverandøridentiteter gjelder innenfor tenant, ikke på tvers av kunder, og håndheves med indeksoppslag i samme mutasjon. Globalt org.nr.-oppslag er aldri kundetilgang.
7. Ingen global cache for kundeinnhold. Private HTTP-svar/PDF bruker `Cache-Control: no-store`; kundespesifikke cache-nøkler må inkludere organisasjon og autorisasjonskontekst. Krysskundefeil gir samme nøytrale «Ikke funnet» og skal ikke røpe at en ressurs eksisterer. Ingen `storage.getUrl`-lenker til kundefiler.
8. Integrasjonstester kjører mot lokal Convex-backend med ekte innloggede testbrukere og prøver uautorisert lesing, skriving, relasjonskobling, eksport, jobbkjøring og samtidige kall mellom to organisasjoner. `convex-test` er rask støtte, ikke eneste bevis. Convex har ingen radpolicyer i databasen: en lekket deploy key, feil i en intern funksjon eller dashboardtilgang kan omgå skillet. Beskriv aldri isolasjonen som databasehåndhevet.

## Revisjonslogg og historikk
Oppgave 01–04 er en lokal grunnmur uten kundedata; oppgave 05 etablerer domenets audit og kobler også eksisterende organisasjons-/medlemskapsendringer. Ingen pilot før dette er gjort. Authbibliotekets sikkerhetsmekanismer og trygg logging gjelder fra første oppgave.
- En forretningsendring og dens `auditEvents`-dokument skrives i samme Convex-mutasjon; kaster audit-skrivingen, rulles hele mutasjonen tilbake. Actions som endrer data gjør det gjennom én mutasjon som også skriver audit.
- Logg aktør (bruker/system), tenant, UTC-tid fra server (`Date.now()` i mutasjonen), hendelsestype, objektreferanse, requestId, begrenset diff og begrunnelse der det kreves.
- Ingen funksjon oppdaterer eller sletter `auditEvents`, og RLS-hjelperen nekter endring av tabellen fra tenantfunksjoner. Logg aldri passord, sesjonstoken, API-nøkler, full e-posttekst eller unødvendige personopplysninger. Diff er en eksplisitt tillatt feltliste.
- Vurderinger, manuelle overstyringer, godkjente dataversjoner og rapportversjoner bevares som historikk; nye input må ikke omskrive gamle resultater. Bevar kilde-, metode- og inputversjoner.
- Append-only på applikasjonsnivå er ikke beskyttelse mot noen med deploy key eller dashboardtilgang. Påstå ikke at loggen er uforanderlig i absolutt forstand. Kontrollert sletting/pseudonymisering skjer gjennom dokumentert vedlikeholdsprosess med avklart lagringstid og egen autorisasjon.

## Risiko og faglig riktighet
- Scoring er deterministisk og regelbasert; AI får aldri sette/godkjenne score eller endre regler.
- Skill `screeningLevel` (lav/moderat/høy/ukjent), `dataQuality` og brukerens dokumenterte vurdering. Nivåene er prioriteringsstøtte, ikke en statistisk sannsynlighet eller juridisk fasit.
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
- Leverandørnavn, CSV-felter og fritekst er ubetrodd innhold. AI har ikke verktøy, URL-henting, databasetilgang eller utførende rettigheter. Valider strukturert output med Zod. Output er alltid forslag med inputreferanser, modell, promptversjon og tidspunkt.
- Bruk token-/kostnadsbudsjett per tenant, eksplisitt brukerhandling, timeout og begrensede retries. AI-feil må ikke miste menneskets arbeid.
- Ikke finn på tiltak, policyer, resultater, kontrollbesøk, signaturer eller at ingen brudd finnes. Manglende opplysninger blir synlige hull, aldri oppdiktede avsnitt.
- Redegjørelsen må skille screening fra bekreftede funn og bygge på egen virksomhet, rutiner, faktiske/potensielle konsekvenser, tiltak og resultater. Bruker godkjenner grunnlaget.
- Intern godkjenning er ikke underskrift. PDF merkes `Utkast – ikke signert` eller `Til ekstern signering – ikke signert`. Ingen innebygd publisering i MVP. Forklar kundens neste steg uten å hevde at eksport oppfyller loven alene.

## Personvern og drift
- Kundedata, sikkerhetskopier, logger, fillagring, e-postbehandling, AI og ekstern overvåking skal følge det avtalte EU/EØS-kravet. Convex-deployments for staging/prod opprettes i `aws-eu-west-1`; Convex-avklaringene i `docs/decisions/0001-convex-eu.md` må være lukket før ekte kundedata. Bruk ingen ekstern analytics eller frontend-CDN/fonttjeneste med dataflyt uten vurdering.
- Bare syntetiske data i git, CI, fixtures, screenshots og Claude Code. Ikke lim kundeeksporter, Convex-eksporter eller produksjonshemmeligheter inn i kodeagenten. Secrets valideres ved oppstart og sjekkes aldri inn. Convex-miljøvariabler settes per deployment, ikke i kode.
- TLS, HttpOnly/Secure/SameSite-cookies, origin/CSRF-kontroll, innloggingsratebegrensning, safe logging og gjenopprettbar backup (Convex-eksport) før pilot.
- Importer begrenses til 2 MiB / 2 000 rader i MVP. Vis norske tall og NOK; lagre beløp som heltall i øre (`v.int64()`, `bigint` i TypeScript) og datoer eksplisitt som `YYYY-MM-DD`-strenger. Tidsstempler lagres som UTC-millisekunder satt på serveren, presenteres i Europe/Oslo. Rapportperioder er datoer, ikke UTC-midnatt beregnet fra brukerens nettleser.
- Ingen rå CSV i lagring, og ingen PDF-er tilgjengelige via offentlige URL-er. PDF rendres uten eksterne nettverkskall, med lokal font og HTML-escaping. Eksport av regnearkvennlige felt må hindre formelinjeksjon.
- E-post krever verifisert avsender, SPF/DKIM/DMARC og håndtering av returmeldinger. Ved lokal utvikling brukes bare Mailpit, aldri ekte mottakere.

## Konvensjoner
- Engelsk kode/tabellnavn (camelCase i Convex), norsk bokmål i UI, feilmeldinger og hjelpetekster. Profesjonelt rolig grensesnitt, responsivt, tastaturbetjenbart, synlige etiketter og feilmeldinger; risiko vises med tekst, ikke bare farge.
- Convex-validatorer (`v.*`) på alle funksjonsargumenter og returverdier; Zod ved øvrige eksterne grenser (CSV, Brreg, AI-output, miljøvariabler). Forretningsregler i Convex-funksjoner/`src/domain/`, ikke i React-komponenter. Kortfattede feil til bruker (`ConvexError` med kode) og requestId til feilsøking.
- Integritet håndheves i mutasjoner: validatorer, `getOwned`, indeksbaserte unikhetssjekker. Bruk `rowVersion` for optimistisk låsing der to brukere kan overskrive samme vurdering, og idempotensnøkler for import/jobber/AI/PDF. Hold mutasjoner innenfor Convex sine transaksjonsgrenser; store importer deles i batcher.
- Ikke innfør ny infrastruktur, generell pluginplattform eller store abstraksjoner uten et faktisk behov i oppgaven.

## Kommandoavtale
Oppgave 01 skal opprette disse scriptnavnene; de er planlagte frem til det er gjort. Script for senere moduler opprettes når modulen bygges. Ikke påstå at en kommando har kjørt før den faktisk er kjørt.
```bash
pnpm install --frozen-lockfile
docker compose up -d convex mailpit
pnpm convex:deploy:local   # skjema og funksjoner til lokal Convex-backend
pnpm seed:dev
pnpm dev                   # Next.js + convex dev mot lokal backend
pnpm lint
pnpm typecheck
pnpm test:unit             # Vitest: ren logikk og convex-test
pnpm test:integration      # mot separat lokal test-backend
pnpm test:e2e
pnpm build
# fra oppgave 14:
pnpm risk-data:validate
pnpm risk-data:import -- --file <manifest-path>
# fra oppgave 24:
pnpm worker
```
Lokal dev-backend og test-backend er separate instanser. `seed:dev` og test-reset nekter å kjøre mot annet enn lokale backend-URL-er, og test-reset finnes bare når backenden er merket som testmiljø. Admin key for lokal backend genereres etter dokumentert kommando i README. Deploy til Convex Cloud skjer bare via eksplisitt CI-/operatørsteg med deploy key; aldri `convex dev` eller automatisk deploy mot produksjon. Skjemaendringer som krever datamigrering gjøres med eksplisitte, testede migreringsfunksjoner.

## Arbeidsflyt per oppgave
1. Les instrukser og relevant eksisterende kode; oppsummer kort og fortsett innenfor avklart scope. Ikke gjett på udokumenterte API-er.
2. Arbeid på én branch per oppgave, f.eks. `feature/01-foundation`. Repoet er `github.com/maiwand0314/Kjedeklar` (privat). Push branchen når oppgaven er verifisert; ikke merge til `main` eller deploy uten at det er del av den aktuelle bestillingen.
3. Implementer bare oppgaven. Skriv meningsfulle tester av risiko og akseptkriterier, inkludert feiltilfeller. Ingen test som bare speiler implementasjonen.
4. Kjør relevante sjekker og fullfør dem. Ved blokkert ekstern tjeneste bruker du fake for lokal verifikasjon og dokumenterer nøyaktig hva som ikke er integrasjonstestet. Aldri skjul feil eller svekk tenantvern/tester for å få grønt.
5. Oppsummer endring, tester, gjenværende avklaringer og manuell prøve. Oppdater STATUS. Stopp før neste oppgave. Den andre utvikleren gjennomgår diff før merge.
