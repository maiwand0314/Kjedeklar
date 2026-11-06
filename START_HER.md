# Kjedeklar – start her

Denne pakken er et konkret arbeidsoppsett for Claude Code, skrevet 6. november 2026. Den inneholder prosjektregler, begrunnet teknologivalg, datamodell, faglige avklaringer og 29 avgrensede oppgaver med komplette kopierbare prompter. Den inneholder ikke en implementert applikasjon, et faktisk risikodatasett eller ferdig godkjente juridiske kundedokumenter.

## Bruk
1. Opprett en tom prosjektmappe for Kjedeklar. Pakk ut denne pakken der, slik at CLAUDE.md ligger i repoets rot og docs/ ligger rett under roten. Ikke start med å installere alle mulige funksjoner selv.
2. Les docs/ARKITEKTUR.md, docs/FAGLIGE_AVKLARINGER.md og docs/decisions/0001-convex-eu.md sammen. Stackvalget (Next.js + Convex Cloud i EU) er vedtatt 6. november 2026; endringer krever en ny beslutning i docs/decisions/.
3. Åpne mappen i Claude Code. Kopier hele promptblokken fra docs/oppgaver/01-foundation.md. Første prompt setter opp Next.js, lokal Convex-backend, auth, tenantstruktur og CI. Den krever ingen Convex-konto og gjør ingen produksjonsdeploy.
4. Følg README-en som Claude lager for applikasjonen. Kjør testene og prøv flyten. La den andre utvikleren gjennomgå endringen før merge.
5. Ta neste prompt i rekkefølge. Claude oppdaterer docs/STATUS.md med faktisk verifisering, slik at nye samtaler kan fortsette fra repoet.

## Filer
| Fil | Bruk |
|---|---|
| CLAUDE.md | Regler Claude Code leser fra repoet |
| docs/ARKITEKTUR.md | Stackvalg, systemgrenser og drift |
| docs/DATAMODELL.md | Entiteter, relasjoner, historikk og integritet |
| docs/FAGLIGE_AVKLARINGER.md | Lovkrav, kilder og menneskelige avklaringer |
| docs/OPPGAVER.md | Rekkefølge, tidsanslag og lenker til alle oppgaver |
| docs/oppgaver/*.md | Én ferdig prompt per kveld/oppgave |
| docs/STATUS.md | Levende status for faktisk implementasjon |
| docs/decisions/*.md | Arkitekturbeslutninger, blant annet 0001 om Convex i EU |
| KJEDEKLAR_ALLE_PROMPTER.md | Samme oppgaveprompter samlet for enkel lesing; enkeltfilene er arbeidsgrunnlaget |

## Bevisste produktvalg
- Next.js som grensesnitt og Convex Cloud i EU (`aws-eu-west-1`) som backend, med mulighet for selvhostet Convex senere. En liten PDF-worker kommer i oppgave 24. Ingen Kubernetes/Redis i MVP. Se docs/decisions/0001-convex-eu.md.
- Ingen innkjøpsbeløp i risikonivå. Ukjent datagrunnlag er synlig. AI godkjenner ingenting.
- En enkel manuell del for egen virksomhet, funn og tiltak er med. Uten den kan et pent redegjørelsesutkast mangle faktisk grunnlag.
- Intern gjennomgang og PDF er med; signering og publisering skjer utenfor appen.
- Pilotopprettelse/invitasjon og manuell fakturering holder første versjon liten.
- Ekte risikodata, leverandøravtaler og EU/EØS-behandling må dokumenteres. AI er av til provideroppsettet er avklart, og hele kjerneflyten fungerer uten AI.

## Fordeling av arbeid
Ta én integrert oppgave om gangen og fordel implementasjon/review mellom dere. Unngå samtidige endringer i `convex/schema.ts`. Fagkilder og lisensrettigheter kan undersøkes mens grunnmuren bygges; oppgave 28 er ikke en oppfordring til å utsette denne undersøkelsen. Ikke bruk ekte kundedata i Claude Code eller repoets tester.

Aktiv arbeidstid er et anslag: mange oppgaver passer 2–4 timer, men eksterne tilganger og fagreview har egen kalendertid. Oppgave 01 er litt større fordi dere uttrykkelig vil ha et kjørbart skjelett med auth/Convex/tenant/CI først. Hvis dere må stoppe, fortsett samme oppgave neste kveld.

