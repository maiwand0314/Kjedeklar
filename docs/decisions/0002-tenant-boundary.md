# 0002 – Tenantgrensen i Convex

- **Status:** Vedtatt i oppgave 02 (november 2026)
- **Bygger på:** [0001 – Convex Cloud i EU](0001-convex-eu.md), CLAUDE.md «Multi-tenant er et ufravikelig sikkerhetskrav»
- **Kode:** `convex/lib/tenant.ts`, `convex/lib/rls.ts`, `eslint.config.mjs`
- **Bevis:** `tests/convex/registry.test.ts`, `tests/convex/references.test.ts`, `tests/convex/tenancy.test.ts`, `tests/integration/tenancy.test.ts`, `tests/e2e/login.spec.ts`, `tests/unit/lint-rules.test.ts`

## Beslutning
Tilgang til kundedata avgjøres bare i Convex, for hvert kall, i denne rekkefølgen:

1. **Verifisert sesjon.** Bruker-id hentes fra Better Auth via komponentens API (`authComponent.safeGetAuthUser`). Mangler sesjon eller er den utløpt, gir det `UNAUTHENTICATED`.
2. **Organisasjonskandidat.** Tas imot som streng og normaliseres med `ctx.db.normalizeId("organizations", …)`.
3. **Aktivt medlemskap** for brukeren i organisasjonen, slått opp med indeks.
4. **Aktiv organisasjon.**
5. **Rolle** mot funksjonens tillatte roller (kun `admin` i MVP). Feil rolle gir `FORBIDDEN`. Det røper ingenting nytt, fordi brukeren allerede er medlem.
6. **`ctx.tenant`** settes, og `ctx.db` erstattes med en innpakket versjon med reglene i `convex/lib/rls.ts`.

Feiler steg 2–4, blir avslaget alltid `{ code: "NOT_FOUND", message: "Ikke funnet." }`. Det gjelder ugyldig format, id fra en annen tabell, slettet eller ukjent organisasjon, fremmed organisasjon, inaktivt medlemskap og inaktiv organisasjon. I Next.js blir alle disse samme 404-side.

## Hvorfor valgt organisasjon ikke er autorisasjon
Organisasjons-id i URL (`/o/[organizationId]`), i en cookie eller som funksjonsargument kommer fra klienten. Klienten kan endre den fritt. Den sier hva brukeren *ønsker* å se, ikke hva brukeren *har lov til* å se. Derfor:

- Next.js sender URL-verdien videre som en kandidat og tar aldri egne tilgangsbeslutninger. Siden viser bare det Convex returnerer.
- Appen leser ingen cookie for valgt organisasjon. Om noen setter en slik cookie, har den ingen effekt (testet i e2e med fire typiske navn).
- Convex kontrollerer medlemskapet på nytt i hvert kall, også for et åpent live-abonnement. Når et medlemskap deaktiveres, gir neste kall med samme token `NOT_FOUND`, og et åpent abonnement får samme avslag fordi medlemskapet er en del av queryens lesesett.
- Kjennskap til en organisasjons-id eller et organisasjonsnummer gir ikke tilgang. Ingen offentlig funksjon oppretter medlemskap.

## Default-deny
- **Typen.** `ExhaustiveRules` i `convex/lib/rls.ts` krever eksplisitt `read`, `modify` og `insert` for *hver* tabell i skjemaet. En ny tabell uten regel gir typefeil.
- **Kjøretid.** `defaultPolicy: "deny"` avviser tabeller uten regel, som en ekstra sikring.
- **I dag.** `organizations` og `memberships` kan leses innenfor egen tenant og kan ikke endres eller opprettes fra tenant- eller brukerfunksjoner. De endres bare via interne funksjoner i `convex/ops/`.

## Innganger (inventar per oppgave 02)
| Inngang | Grense | Kontroll |
|---|---|---|
| `organizations/queries:current` (query) | `tenantQuery` | Hele kjeden over |
| `organizations/queries:listMine` (query) | `userQuery` | Sesjon. Ser bare egne aktive medlemskap |
| `GET /.well-known/openid-configuration` | Better Auth | Offentlig metadata, ingen kundedata |
| `GET`/`POST /api/auth/*` | Better Auth | Innlogging, utlogging, sesjon og Convex-token. Åpen registrering er av. Ingen admin- eller organisasjonsplugin |
| Next.js `/logg-inn`, `/` og `/o/[organizationId]` | Server components | Kaller bare offentlige funksjoner med brukerens token (`fetchAuthQuery`) |
| Next.js `/api/auth/[...all]` | Proxy | Videresender til Better Auth i Convex. Har ingen egen logikk |
| Interne funksjoner i `ops/`, `invitations/internal`, `email/actions` | Admin/deploy key eller annen Convex-kode | Kan ikke kalles fra klient eller Next.js |
| `account/queries:me` (query) | `userQuery` | Egen e-post og navn (oppgave 03) |
| `invitations/queries:listForOrganization`, `invitations/mutations:create`, `invitations/mutations:revoke` | `tenantQuery`/`tenantMutation` | Hele kjeden over, kun admin (oppgave 03) |
| `invitations/queries:lookup`, `invitations/mutations:acceptAsCurrentUser`, `invitations/actions:acceptWithNewAccount` | `invitationQuery`/`invitationMutation`/`invitationAction` | Token i invitasjonslenken. Se [0003](0003-kontolivssyklus.md) |
| `account/actions:verifyEmail` (action) | `verificationAction` | Better Auths signerte verifiseringstoken. Se [0003](0003-kontolivssyklus.md) |

Registertesten feiler hvis noen legger til en offentlig funksjon eller HTTP-rute som ikke står i `tests/helpers/public-functions.ts`. Integrasjonstesten feiler hvis en intern funksjon mangler en probe.

## Avgrensning av Better Auth-komponenten
- Komponentens tabeller (bruker, sesjon, konto, verifisering, ratebegrensning) ligger i komponentens eget navnerom. Klienter kan ikke kalle komponentens funksjoner; det er testet mot lokal backend.
- Appens kode leser bare autentisert bruker via `authComponent`. ESLint tillater `components` fra `_generated/api` bare i `convex/auth.ts`.
- Better Auths organisasjons- og adminplugin er ikke installert. Endepunkter som kunne tildelt rolle eller aktiv organisasjon, gir 404, og medlemskap og rolle finnes bare i appens `memberships`.
- Brukere opprettes bare av interne funksjoner (seed og testfixture nå, invitasjon i oppgave 03).

## Hva dette ikke beskytter mot
Convex har ikke radpolicyer, databaseroller eller fremmednøkler. Vernet ligger i applikasjonslaget, og det kan omgås av:

- **Deploy key eller admin key.** Den kan kjøre alle interne funksjoner, lese og skrive alle tabeller og endre funksjonene. Den skal bare finnes i CI-deploy og hos navngitte operatører, aldri i Next.js, nettleser, PDF-worker eller logger.
- **Interne funksjoner.** De har ingen tenantkontekst og stoler på argumentene sine. En feil i en intern funksjon kan koble data på tvers av kunder. Hold dem små, la dem ta eksplisitt `organizationId` og gå dem nøye gjennom i review.
- **Convex-dashboardet.** Det gir full lese- og skrivetilgang til data og miljøvariabler.
- **En feil i selve byggeklossene.** Bruk av `ctx.db` *før* innpakning, eller en for romslig RLS-regel. Testene over er laget for å fange dette, men de er ikke et formelt bevis.

Isolasjonen skal derfor aldri beskrives som databasehåndhevet.

## Unntak
| Unntak | Begrunnelse |
|---|---|
| Indeksen `memberships.by_userId` starter ikke med `organizationId` | Organisasjonsvelgeren og `userQuery` slår opp innlogget brukers egne medlemskap før en organisasjon er valgt. Den leses bare med bruker-id fra sesjonen |
| Indeksen `invitations.by_tokenHash` starter ikke med `organizationId` | Invitasjonslenken identifiserer invitasjonen før organisasjonen er kjent. Slås bare opp med SHA-256 av et 256-bits token, i invitasjonsbyggeklossene |
| Lint-unntaket for `convex/lib/**` | Byggeklossene må pakke inn rå `query`/`mutation`. Alt som legges i `convex/lib/` skal få ekstra oppmerksomhet i review |

## Sjekkliste for ny kundetabell
1. `organizationId: v.id("organizations")` er påkrevd. Registertesten krever det.
2. Alle indekser starter med `organizationId`. Unntak må begrunnes her og i `INDEX_EXCEPTIONS`.
3. Tabellen får eksplisitt regel i `tenantRules` og `userRules`. Typen krever det. Vurder bevisst om tenantfunksjoner skal kunne endre og opprette.
4. Tabellen registreres i `tests/convex/tenant-tables.ts`. Typen krever det, og da kjøres standardtestene for `getOwned` og RLS automatisk.
5. Hver id som kommer inn eller lagres som referanse, lastes med `getOwned(ctx, table, id)`.
6. Unikhet håndheves med indeksoppslag innenfor organisasjonen i samme mutasjon.

## Sjekkliste for ny offentlig funksjon
1. Lag den med `tenantQuery`/`tenantMutation` (eller `userQuery` uten kundedata fra en bestemt organisasjon). ESLint stopper rå byggere.
2. Legg til `returns`-validator.
3. Registrer den i `tests/helpers/public-functions.ts` med grense og eksempelargumenter. Da kjøres de negative testene både i convex-test og mot lokal backend.
4. Får den id-er som argument: test fremmed id via `getOwned` i funksjonens egne tester.
5. Ny intern funksjon: legg til en probe i `tests/integration/tenancy.test.ts`.
