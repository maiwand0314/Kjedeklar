# 0003 – Kontolivssyklus: invitasjon, verifisering, reset og ratebegrensning

- **Status:** Vedtatt i oppgave 03 (november 2026)
- **Bygger på:** [0001 – Convex Cloud i EU](0001-convex-eu.md), [0002 – Tenantgrensen](0002-tenant-boundary.md)
- **Kode:** `convex/auth.ts`, `convex/http.ts`, `convex/lib/invitation.ts`, `convex/lib/verification.ts`, `convex/invitations/`, `convex/email/`, `convex/ops/workspaces.ts`, `src/domain/auth-proxy.ts`, `src/app/api/auth/[...all]/route.ts`
- **Bevis:** `tests/convex/invitations.test.ts`, `tests/integration/auth-lifecycle.test.ts`, `tests/e2e/auth.spec.ts`, `tests/unit/auth-lifecycle.test.ts`

## Invitasjon
- **Første admin:** Operatøren kjører `ops/workspaces:provision`. Den lager alltid en ny organisasjon uten medlemmer og en invitasjon. Operatøren kontrollerer manuelt at mottakeren tilhører virksomheten før kjøring. Org.nr. er ingen eierskapsverifisering.
- **Flere admins:** En admin i organisasjonen inviterer via `invitations/mutations:create` (`tenantMutation`). Ingen rolle kan velges; alle medlemskap er `admin` i MVP.
- **Token:** Lages med `crypto.randomBytes(32)` i en Node-action (`email/actions:sendInvitation`), fordi mutasjoner ikke har kryptografisk tilfeldighet. Bare SHA-256-hashen lagres. En ny invitasjon til samme adresse gir nytt token, og den gamle lenken slutter å virke.
- **Gyldighet:** 7 dager. Invitasjonen er engangs og kan tilbakekalles.
- **Tokenet er tilgangsbeviset.** Byggeklossene `invitationQuery`/`invitationMutation`/`invitationAction` slår opp invitasjonen via `by_tokenHash` og gir en innpakket `ctx.db` med `invitationRules`. Den gir tilgang til én invitasjon, dens organisasjon og den aksepterende brukerens eget medlemskap, og ingenting annet.
- **Aksept:**
  - *Innlogget bruker:* krever verifisert e-post lik invitasjonens.
  - *Ny konto:* e-posten tas fra invitasjonen, aldri fra brukeren, og regnes som verifisert fordi lenken ble sendt dit.
  - Medlemskap og «brukt» skrives i samme mutasjon. Samtidige forsøk gir én vinner (serialiserbare mutasjoner).
- **Like avslag:** Ukjent, brukt, utløpt, tilbakekalt token og feil mottaker gir alle `INVITATION_INVALID`.

## Better Auth-mekanismer
- **E-postverifisering:** `requireEmailVerification: true` og `sendOnSignIn`. Ubekreftet konto får 403 og ny lenke, men bare når passordet var riktig, så kontoer røpes ikke.
- **Passordreset:**
  - Token gyldig i 1 time, engangs.
  - `revokeSessionsOnPasswordReset: true`. `safeGetAuthUser` sjekker sesjonen i hvert Convex-kall, så allerede utstedte Convex-token virker heller ikke etter reset.
  - Samme svar for ukjent e-post. Better Auth simulerer i tillegg arbeidet mot tidsangrep.
- **Hashede token:** `verification.storeIdentifier: "hashed"`. Reset- og verifiseringstoken lagres hashet i komponentens tabell.
- **Origin/CSRF:** Better Auth avviser fremmed `Origin` og fremmede `redirectTo`/`callbackURL`. Server actions i Next.js har innebygd origin-kontroll. Convex-funksjoner autentiseres med bearer-JWT, ikke cookie.
- **Cookies:** Better Auths standard er HttpOnly og SameSite=Lax, og Secure når `SITE_URL` er https.
- **Convex-JWT:** levetid 5 minutter.

## Token aldri i URL som sendes til en server
Integrasjonstesten fant at verifiseringstokenet havnet i Convex-backendens tilgangslogg (`GET /api/auth/verify-email?token=…`). Det samme ville skjedd med reset-lenken og med invitasjonslenken i en reverse proxy. Derfor:

- Alle lenker i e-post går til appen med tokenet i fragmentet: `/invitasjon#token=…`, `/tilbakestill-passord#token=…` og `/bekreft-epost#token=…`. Nettleseren sender aldri fragmentet til noen server.
- Siden leser tokenet på klienten, fjerner det fra adresselinjen og historikken, og sender det bare i POST-body:
  - reset: Better Auths `/reset-password`;
  - invitasjon: server action → Convex;
  - verifisering: `account/actions:verifyEmail`, som kaller `auth.api.verifyEmail` i samme prosess.
- Lenker til planlagte e-postjobber forsegles (AES-GCM, nøkkel avledet fra `BETTER_AUTH_SECRET`), så tokenet ikke står i klartekst i argumentene til planlagte funksjoner.
- Integrasjonstesten leser både funksjonslogger og backendens serverlogg og feiler hvis et token eller passord fra testene står der.

## Ratebegrensning per klient-IP
Better Auth får ikke klientens IP i Convex sine HTTP-actions, og faller da tilbake til én felles bøtte per sti (se oppgave 02). Løsning:

- Next.js-proxyen (`/api/auth/*`) leser klient-IP fra en header satt av en klarert reverse proxy (`AUTH_CLIENT_IP_SOURCE_HEADER`, standard `x-forwarded-for`). Den setter `x-kjedeklar-client-ip` og `x-kjedeklar-proxy-secret` og fjerner alltid klientens egne verdier av disse.
- `createAuthForHttp` i Convex beholder klient-IP bare når hemmeligheten (`AUTH_PROXY_SECRET`, minst 32 tegn, sammenlignet i konstant tid) stemmer, og fjerner alltid hemmeligheten før Better Auth ser forespørselen.
- Direkte kall til Convex uten hemmelighet havner i den felles bøtten. Det gjør det umulig å forfalske IP for å omgå grensen, og misbruk der rammer ikke brukere som kommer via appen.
- **Regler:**

| Endepunkt | Grense |
|---|---|
| `/sign-in/email` | 5 per 60 s |
| `/request-password-reset` | 3 per 300 s |
| `/reset-password` | 5 per 300 s |
| `/send-verification-email` | 3 per 300 s |
| `/convex/jwks` og `/convex/token` | Unntatt (oppgave 02) |

**Forutsetning i produksjon (oppgave 25):** Reverse proxyen foran Next.js må overskrive, ikke videreføre, headeren klient-IP leses fra. Lokalt setter Next.js `x-forwarded-for` bare når den mangler, så en klient kan forfalske den. Det er akseptert lokalt og brukes bevisst i e2e for å gi hver test egen IP.

## E-post
- Nodemailer kjører i en Convex Node-action.
- I oppgave 03 er bare Mailpit tillatt: `KJEDEKLAR_ENV` må være `development` eller `test`, og `SMTP_HOST` må være lokal. Ellers nekter koden å sende.
- Ingen produksjonsleverandør er aktivert. Det skjer i oppgave 25.
- Innholdet er minimalt og på norsk. Logger inneholder aldri mottaker, lenke eller innhold.

## Kjente begrensninger
- **Leveringslogg:** Ingen leveringslogg for e-post (`emailDeliveries`). SMTP-feil gir bare en feilet planlagt jobb.
- **Ratebegrensning med databaselagring** kan gi konfliktfeil under høy samtidighet. Med nøkler per IP er det lite sannsynlig. Vurderes på nytt mot Convex Cloud i oppgave 25.
- **Utløpte invitasjoner** ryddes ikke automatisk; de vises som «Utløpt».
- **Utlogging fra alle enheter** finnes bare via passordreset. Det er ingen egen knapp.
