# 0006 – Rapportperiode og virksomhetsprofil

- **Status:** Vedtatt i oppgave 08 (november 2026)
- **Bygger på:** [0002 – Tenantgrensen](0002-tenant-boundary.md), [0004 – Revisjonslogg](0004-revisjonslogg.md)
- **Kode:** `src/domain/reporting/` (ren TypeScript), `convex/organizations/reportingPeriods.ts`, `convex/organizations/businessProfile.ts`
- **Tester:** `tests/unit/reporting.test.ts`, `tests/convex/profile.test.ts`, `tests/convex/profile-rollback.test.ts`, `tests/integration/profile.test.ts`, `tests/e2e/profile.spec.ts`

## Rapportperiode
- **Datoer er tekst:** `startDate`, `endDate` og `publicationDueDate` lagres som `YYYY-MM-DD`. Ingen tidssone og ingen UTC-midnatt fra nettleseren. Gyldig dato er en ekte kalenderdato i 2000–2100.
- **Regler (server og skjema bruker samme funksjon):** slutt etter start, og frist ikke før slutt. Det er ingen regel om lengde eller kalenderår, så avvikende regnskapsår er tillatt.
- **Fristen er kundens egen dato.** Skjemaet foreslår kalenderåret med neste 30. juni-frist (åpenhetsloven § 5), men alle tre datoene kan endres. Systemet regner aldri ut en frist selv og sender ingen påminnelser.
- **Unikhet:** samme start og slutt finnes bare én gang per organisasjon. Det kontrolleres med indeksoppslag i samme mutasjon; to samtidige forsøk gir én periode og én `PERIOD_EXISTS`. Overlappende perioder med ulike datoer er tillatt.
- **Ingen endring eller sletting** av perioder fra appen i MVP. Status er bare `open` til en senere oppgave innfører lukking.

## Valgt periode
- Valgt periode står i adressen som `?periode=<id>`. Det er en kandidat, aldri et tilgangsbevis: serveren laster den med `getOwned`, og ukjent id, id fra en annen tabell og en annen organisasjons periode gir samme nøytrale «Ikke funnet».
- Uten parameter brukes nyeste periode. Menyen tar bare med parameteren når den peker på en av organisasjonens egne perioder.
- **Statuskode:** en ugyldig periode i adressen gir «Ikke funnet»-siden med HTTP 200, ikke 404. Siden strømmes etter lastetilstanden, og da er statuskoden allerede sendt. Ingen data vises. Fremmed organisasjon gir fortsatt ekte 404, fordi den avvises før strømmingen starter.

## Virksomhetsprofil
- **Åtte temaer:** organisering, drift og produkter, geografisk virksomhet, ansvar, retningslinjer, rutiner, interessentdialog og gjenopprettingsprosess.
- **Tre svarstatuser per tema:**
  - `described`: kunden har skrevet en beskrivelse (påkrevd tekst, maks 4 000 tegn);
  - `not_established`: kunden sier uttrykkelig at dette ikke finnes. Bare for de fem temaene som er noe virksomheten kan ha eller mangle;
  - `unknown`: ikke besvart. Vises som et synlig hull.

  Et tomt felt blir aldri tolket som «finnes» eller «finnes ikke», og `not_established` teller ikke som hull.
- **Versjoner:** hver lagring gir en ny rad i `businessProfileRevisions` med neste versjonsnummer for perioden. Gamle rader endres aldri (RLS nekter endring).
- **Samtidige lagringer:** klienten sender versjonen den så (`expectedRevision`). Er den utdatert, avvises lagringen med `CONFLICT`. Brukeren beholder teksten sin i skjemaet og får beskjed om å kopiere den før siden lastes på nytt; skjemaet fletter ikke versjoner.
- **Bekreftelse:** valgfri avkrysning ved lagring setter `confirmedBy`/`confirmedAt` på den versjonen. Det er en intern bekreftelse, ikke en underskrift, og en ny versjon er ubekreftet til den bekreftes.
- **Revisjonslogg:** `business_profile.saved` logger versjon, bekreftelse og status per tema. Svarteksten logges aldri.

## Kjente begrensninger
- Innholdet i eldre versjoner kan ikke åpnes i appen; bare versjonsnummer, tidspunkt og bekreftelse vises.
- Historikken viser ikke hvem som lagret. Det står i revisjonsloggen.
- Listen viser de 50 nyeste periodene og de 20 nyeste versjonene.
