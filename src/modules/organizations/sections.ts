/**
 * Seksjonene i appskallet. Én kilde for menyen og for plassholdersidene til
 * deler som ikke er bygget ennå. Når en seksjon bygges, får den egen rute-
 * mappe (som går foran den dynamiske plassholderruten) og `placeholder` fjernes.
 */
export type Section = {
  slug: string; // "" er oversikten
  label: string;
  placeholder?: { title: string; text: string };
};

export const SECTIONS: readonly Section[] = [
  { slug: "", label: "Oversikt" },
  { slug: "virksomheten", label: "Virksomheten" },
  {
    slug: "leverandorer",
    label: "Leverandører",
    placeholder: {
      title: "Ingen leverandører",
      text: "Her skal du importere og vedlikeholde leverandørregisteret. Funksjonen er ikke tilgjengelig ennå.",
    },
  },
  {
    slug: "risikovurderinger",
    label: "Risikovurderinger",
    placeholder: {
      title: "Ingen risikovurderinger",
      text: "Her skal du se og bekrefte risikotriagen for leverandørene. Funksjonen er ikke tilgjengelig ennå.",
    },
  },
  {
    slug: "funn-og-tiltak",
    label: "Funn og tiltak",
    placeholder: {
      title: "Ingen funn eller tiltak",
      text: "Her skal du registrere funn, tiltak og resultater fra aktsomhetsvurderingene. Funksjonen er ikke tilgjengelig ennå.",
    },
  },
  {
    slug: "redegjorelse",
    label: "Redegjørelse",
    placeholder: {
      title: "Ingen redegjørelse",
      text: "Her skal du lage, redigere og eksportere redegjørelsen. Funksjonen er ikke tilgjengelig ennå.",
    },
  },
  { slug: "innstillinger", label: "Innstillinger" },
];

/** Plassholderseksjonen med denne sluggen, eller undefined (ukjent eller allerede bygget). */
export function placeholderSection(slug: string) {
  const section = SECTIONS.find((s) => s.slug === slug);
  return section?.placeholder ? { label: section.label, ...section.placeholder } : undefined;
}
