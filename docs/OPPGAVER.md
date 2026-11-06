# MVP-plan og bruk av promptene

Planen har 29 små implementasjons-/verifikasjonsoppgaver. De fleste er estimert til 2–4 aktive timer. Oppgave 01 er en konsentrert 3–5-timers grunnmur. Estimatene er arbeidsanslag, ikke garantier; oppsett av eksterne kontoer og faglige/lisensmessige avklaringer kan ta lengre kalendertid. Oppgave 28 er uttrykkelig én liten datagjennomgang om gangen og gjentas ved behov.

Én oppgave om gangen i Claude Code. Start en ny samtale per oppgave når konteksten blir stor; repoets dokumentasjon og STATUS er sannhetskilden. Kopier hele promptblokken fra den enkelte filen. Fullfør og review før neste. Dette er en MVP frem til en kontrollert pilot, ikke en ferdig fullskala tjeneste med alle senere funksjoner.

| Nr. | Oppgave | Aktiv tid | Ferdig når |
|---|---|---|---|
| 01 | [Kjørbart prosjektskjelett](oppgaver/01-foundation.md) | 3–5 t | Login, to syntetiske tenants og grønn CI |
| 02 | [Bevis tenant-isolasjonen](oppgaver/02-tenant-isolation.md) | 2–4 t | Isolasjon og tilgangsgrenser er negativtestet |
| 03 | [Invitasjon, verifisering og kontogjenoppretting](oppgaver/03-auth-lifecycle.md) | 2–4 t | Invite og reset fungerer lokalt |
| 04 | [Norsk appskall og navigasjon](oppgaver/04-app-shell.md) | 2–3 t | Norsk responsivt appskall |
| 05 | [Transaksjonell revisjonslogg](oppgaver/05-audit.md) | 2–4 t | Atomisk audit med begrensede rettigheter |
| 06 | [Brreg-oppslag for egen virksomhet](oppgaver/06-brreg-onboarding.md) | 2–3 t | Virksomhet kan bekrefte Brreg-data |
| 07 | [Veiledende vurdering av lovens virkeområde](oppgaver/07-applicability.md) | 2–4 t | Veiledende resultat med manuell avklaring |
| 08 | [Rapportperiode og virksomhetsprofil](oppgaver/08-business-profile.md) | 2–3 t | Periode og ekte virksomhetsgrunnlag lagres |
| 09 | [Leverandørregister med manuell registrering](oppgaver/09-suppliers.md) | 2–3 t | Leverandør og årets innkjøp kan redigeres |
| 10 | [CSV-opplasting og forhåndsvisning](oppgaver/10-csv-preview.md) | 2–3 t | CSV kan normaliseres uten lagringsendring |
| 11 | [Bekreftet, idempotent CSV-import](oppgaver/11-csv-import.md) | 2–4 t | Bekreftet import tåler retry |
| 12 | [Varige bakgrunnsjobber](oppgaver/12-jobs.md) | 2–4 t | Jobber tåler feil/retry og isolerer tenants |
| 13 | [Brreg-beriking av leverandører](oppgaver/13-brreg-enrichment.md) | 2–3 t | Beriking bevarer brukerrettelser |
| 14 | [Versjonerte risikodata og faglig metodekontrakt](oppgaver/14-risk-data.md) | 2–4 t | Dataversjoner kan valideres/aktiveres |
| 15 | [Deterministisk risikomotor](oppgaver/15-risk-engine.md) | 2–4 t | Regler gir reproduserbar screening |
| 16 | [Risikoliste, forklaring og manuell overstyring](oppgaver/16-risk-review.md) | 2–4 t | Brukeren kan forstå og begrunne overstyring |
| 17 | [Manuelle funn, tiltak og oppfølging](oppgaver/17-findings-measures.md) | 2–4 t | Egen virksomhet, funn og tiltak kan registreres |
| 18 | [AI-grensesnitt med personvern- og kostnadsgrenser](oppgaver/18-ai-boundary.md) | 2–4 t | AI er valgfri og har kontrollert datagrense |
| 19 | [AI-forslag til klassifisering og begrunnelser](oppgaver/19-ai-suggestions.md) | 2–3 t | Forslag krever menneskelig aksept |
| 20 | [Kontroll av rapportgrunnlag og hull](oppgaver/20-report-readiness.md) | 2–3 t | Hull og grunnlag vises samlet |
| 21 | [Malbasert redegjørelse uten AI](oppgaver/21-statement-template.md) | 2–3 t | Utkast fungerer uten AI |
| 22 | [AI-assistert redegjørelsesutkast](oppgaver/22-ai-statement.md) | 2–3 t | AI skriver bare forslag fra grunnlaget |
| 23 | [Redigering, versjoner og intern gjennomgang](oppgaver/23-statement-editor.md) | 2–4 t | Eksakt revisjon kan gjennomgås internt |
| 24 | [PDF-eksport av eksakt revisjon](oppgaver/24-pdf-export.md) | 2–4 t | Privat usignert PDF kan eksporteres |
| 25 | [Reproduserbar EU-staging og avsenderoppsett](oppgaver/25-staging.md) | 2–4 t | Staging og e-postoppsett er dokumentert/testet |
| 26 | [Backup, restore og driftskontroll](oppgaver/26-backup-restore.md) | 2–4 t | Reell restore-prøve med syntetiske data |
| 27 | [Personvern, kundeeksport og kontrollert sletting](oppgaver/27-privacy.md) | 2–4 t | Eksport/sletting og kundedokumentutkast finnes |
| 28 | [Første faglig gjennomgåtte risikodataversjon](oppgaver/28-approved-risk-data.md) | 2–4 per avgrenset gjennomgang t | Pilotdekning har ekte kilder og fagreview |
| 29 | [Samlet pilotprøve og konkret lanseringsbeslutning](oppgaver/29-pilot.md) | 2–4 t | Pilotstatus har evidens og åpne avklaringer |

## Hva første oppgave betyr
Første kveld leverer en tynn, kjørbar grunnmur med lokal Convex-backend, auth, organisasjon/medlemskap, tenant-byggeklosser og CI. Den forsøker ikke å gjøre komplett sikkerhet, alle invitasjonsflyter eller drift ferdig. Oppgave 02–05 bygger dette videre før kundens forretningsdata introduseres. Hvis den første kvelden stopper på en pakke-/miljøfeil, fullfør samme avgrensede oppgave neste gang fremfor å kutte test eller isolasjon.

## Milepæler
- **Etter 05:** lokal teknisk grunnmur, kontrollert innlogging og revisjonslogg.
- **Etter 13:** oppstart og fungerende leverandørflyt med CSV og beriking.
- **Etter 17:** forklarbar screening og manuelt dokumentert aktsomhetsarbeid, med demodata der fagkilder ennå ikke er godkjent.
- **Etter 24:** full dokumentflyt, valgfri AI og usignert PDF.
- **Etter 29:** konkret vurdering av pilotklarhet med kilder, personvern, drift og verifikasjon.

Oppgave 28s kilde-/lisensarbeid kan undersøkes tidlig av et teammedlem. Produksjonsaktivering skjer først når datakontrakten, metoden og ekte fagreview finnes. Denne kalenderavhengigheten bør ikke oppdages først etter at hele UI-et er bygget.

## Gjennomgang før merge
Den andre utvikleren vurderer diff, akseptkriterier, Convex-skjema/tenantvern, audit og faktiske testresultater. Ikke aksepter «testene burde passere». Når ekstern tilgang mangler kan syntetisk lokal verifikasjon være ferdig, mens ekstern oppgave fortsatt er åpen. Ikke slå av test eller sikkerhetsregel for å få grønt.

## Etter MVP
Senere oppgaver kan bygges som separate små løp: leverandørskjema med tokenlenker/filkontroll, oversettelse/purring, faktisk signering, fast offentlig publiseringslenke, informasjonskrav med lovlig fristbehandling, årshjul, abonnement og deretter én regnskapsintegrasjon om gangen. Bekreft API-vilkår, sertifisering og produksjonstilgang når en slik integrasjon faktisk prioriteres; antatt behandlingstid fra konseptet er ikke en verifisert avhengighet i denne MVP-en.

