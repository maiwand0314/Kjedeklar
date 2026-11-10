/**
 * Foreslår hvordan hver rad henger sammen med leverandører som finnes fra før
 * i organisasjonen. Bare forslag: ingenting slås sammen eller endres her.
 */
import { matchKey, type ImportRow } from "./normalize";

export type ExistingSupplier = { id: string; name: string; registryOrgNumber?: string; externalKey?: string; archived: boolean };
export type MatchedSupplier = Pick<ExistingSupplier, "id" | "name" | "archived">;

export type MatchProposal =
  /** Ingen leverandør med samme org.nr., ID eller navn finnes fra før. */
  | { kind: "new" }
  /** Sikker identifikator: samme org.nr. eller samme leverandør-ID. */
  | { kind: "org_number" | "external_key"; suppliers: MatchedSupplier[] }
  /** Likt navn uten felles identifikator. Må bekreftes av brukeren. */
  | { kind: "name"; suppliers: MatchedSupplier[] }
  /** Identifikatorene peker på ulike leverandører, eller flere har samme ID. */
  | { kind: "conflict"; suppliers: MatchedSupplier[] }
  /** Raden mangler navn og identifikator, så det finnes ikke noe å foreslå. */
  | { kind: "none" };

const brief = (suppliers: ExistingSupplier[]): MatchedSupplier[] =>
  suppliers.slice(0, 5).map(({ id, name, archived }) => ({ id, name, archived }));

/** Gir forslaget for hver rad, i samme rekkefølge, og legger avklaringene til på raden. */
export function proposeMatches(rows: ImportRow[], existing: readonly ExistingSupplier[]): MatchProposal[] {
  const index = (key: (s: ExistingSupplier) => string | undefined) => {
    const map = new Map<string, ExistingSupplier[]>();
    for (const supplier of existing) {
      const k = key(supplier);
      if (k) map.set(k, [...(map.get(k) ?? []), supplier]);
    }
    return map;
  };
  const byOrgNumber = index((s) => s.registryOrgNumber);
  const byExternalKey = index((s) => s.externalKey);
  const byName = index((s) => matchKey(s.name));

  return rows.map((row): MatchProposal => {
    const { name, registryOrgNumber, externalKey } = row.values;
    const warn = (code: string, message: string) => row.issues.push({ level: "warning", code, message });
    const orgMatches = (registryOrgNumber && byOrgNumber.get(registryOrgNumber)) || [];
    const keyMatches = (externalKey && byExternalKey.get(externalKey)) || [];
    const identified = [...new Set([...orgMatches, ...keyMatches])];
    // Samme ID, men leverandøren har et annet org.nr. enn raden: ikke samme leverandør uten videre.
    const otherOrgNumber = keyMatches.some((s) => registryOrgNumber && s.registryOrgNumber && s.registryOrgNumber !== registryOrgNumber);

    if (identified.length > 1 || otherOrgNumber) {
      warn("match_conflict", "Organisasjonsnummer og leverandør-ID peker på ulike leverandører som finnes fra før. Avklar hvilken som er riktig.");
      return { kind: "conflict", suppliers: brief(identified) };
    }
    if (identified.length === 1) {
      if (identified[0].archived) warn("match_archived", "Leverandøren finnes fra før, men er arkivert.");
      return { kind: orgMatches.length > 0 ? "org_number" : "external_key", suppliers: brief(identified) };
    }
    // To ulike gyldige org.nr. er to ulike virksomheter, selv med likt navn.
    const sameName = ((name && byName.get(matchKey(name))) || []).filter((s) => !(registryOrgNumber && s.registryOrgNumber));
    if (sameName.length > 0) {
      warn("match_name", "Navnet ligner på en leverandør som finnes fra før. Avklar om det er samme leverandør; ingenting slås sammen automatisk.");
      return { kind: "name", suppliers: brief(sameName) };
    }
    return name ? { kind: "new" } : { kind: "none" };
  });
}
