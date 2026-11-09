import { z } from "zod";

/**
 * Valgte felter fra Enhetsregisterets `GET /enheter/{orgnr}`. Bare det vi
 * bruker valideres; ukjente felter ignoreres. Ingen personroller, og
 * antallAnsatte hentes ikke (det er ikke gjennomsnittlige årsverk).
 * Kontrakt: https://data.brreg.no/enhetsregisteret/api/dokumentasjon/no/index.html
 */
const kodeBeskrivelse = z.object({ kode: z.string().min(1), beskrivelse: z.string().optional() });

const adresse = z.object({
  adresse: z.array(z.string()).optional(),
  postnummer: z.string().optional(),
  poststed: z.string().optional(),
  kommune: z.string().optional(),
  kommunenummer: z.string().optional(),
  land: z.string().optional(),
  landkode: z.string().optional(),
});

export const enhetSchema = z.object({
  organisasjonsnummer: z.string().regex(/^\d{9}$/),
  navn: z.string().min(1),
  organisasjonsform: kodeBeskrivelse.optional(),
  forretningsadresse: adresse.optional(),
  postadresse: adresse.optional(),
  naeringskode1: kodeBeskrivelse.optional(),
  konkurs: z.boolean().optional(),
  underAvvikling: z.boolean().optional(),
  underTvangsavviklingEllerTvangsopplosning: z.boolean().optional(),
  slettedato: z.string().optional(),
});

/** Versjon av mappingen nedenfor. Økes når feltutvalg eller tolkning endres. */
export const BRREG_MAPPING_VERSION = "brreg-enhet-v1";

export type RegistryProfile = {
  orgNumber: string;
  name: string;
  legalForm: string | null;
  legalFormDescription: string | null;
  address: {
    lines: string[];
    postalCode: string | null;
    city: string | null;
    municipality: string | null;
    countryCode: string | null;
  } | null;
  addressKind: "forretningsadresse" | "postadresse" | null;
  industryCode: string | null;
  industryDescription: string | null;
  /** Brreg oppgir ikke hvilken SN-versjon koden følger. */
  industryCodeSystem: "SN";
  /** null = registeret oppga ikke feltet (ukjent), aldri tolket som «nei». */
  bankrupt: boolean | null;
  underLiquidation: boolean | null;
  underForcedLiquidation: boolean | null;
  deletedOn: string | null;
};

/** Datamangler som må vises og avklares, ikke fylles med standardverdier. */
export function profileGaps(profile: RegistryProfile): string[] {
  const gaps: string[] = [];
  if (!profile.industryCode) gaps.push("Næringskode mangler i registeret.");
  if (!profile.legalForm) gaps.push("Organisasjonsform mangler i registeret.");
  if (!profile.address) gaps.push("Adresse mangler i registeret.");
  if ([profile.bankrupt, profile.underLiquidation, profile.underForcedLiquidation].includes(null)) {
    gaps.push("Konkurs- og avviklingsstatus mangler i registeret.");
  }
  return gaps;
}

export function toProfile(enhet: z.infer<typeof enhetSchema>): RegistryProfile {
  const source = enhet.forretningsadresse ?? enhet.postadresse;
  return {
    orgNumber: enhet.organisasjonsnummer,
    name: enhet.navn,
    legalForm: enhet.organisasjonsform?.kode ?? null,
    legalFormDescription: enhet.organisasjonsform?.beskrivelse ?? null,
    address: source
      ? {
          lines: source.adresse ?? [],
          postalCode: source.postnummer ?? null,
          city: source.poststed ?? null,
          municipality: source.kommune ?? null,
          countryCode: source.landkode ?? null,
        }
      : null,
    addressKind: enhet.forretningsadresse ? "forretningsadresse" : enhet.postadresse ? "postadresse" : null,
    industryCode: enhet.naeringskode1?.kode ?? null,
    industryDescription: enhet.naeringskode1?.beskrivelse ?? null,
    industryCodeSystem: "SN",
    bankrupt: enhet.konkurs ?? null,
    underLiquidation: enhet.underAvvikling ?? null,
    underForcedLiquidation: enhet.underTvangsavviklingEllerTvangsopplosning ?? null,
    deletedOn: enhet.slettedato ?? null,
  };
}

/**
 * Registerstatus som tekst. Statusene er kontrollsignaler, ikke vurderinger av
 * virksomheten. «Ingen merknader» bare når registeret svarte nei på alle;
 * manglende felt vises som ukjent.
 */
export function registryStatusText(profile: RegistryProfile, formatDate: (iso: string) => string): string {
  const notes: string[] = [];
  if (profile.deletedOn) notes.push(`Slettet i registeret ${formatDate(profile.deletedOn)}`);
  if (profile.bankrupt) notes.push("Konkurs");
  if (profile.underLiquidation) notes.push("Under avvikling");
  if (profile.underForcedLiquidation) notes.push("Under tvangsavvikling eller tvangsoppløsning");
  if ([profile.bankrupt, profile.underLiquidation, profile.underForcedLiquidation].includes(null)) {
    notes.push(notes.length ? "øvrig konkurs- og avviklingsstatus ukjent" : "Ukjent (ikke oppgitt av registeret)");
  }
  return notes.length ? notes.join("; ") : "Ingen merknader";
}
