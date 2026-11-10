/** Fra forhåndsvisning til importgrunnlag: sammenslåing, typer, tillatte valg og fingeravtrykk. */
import { describe, expect, test } from "vitest";
import type { ExistingSupplier } from "../../src/domain/import/match";
import { proposeMatches } from "../../src/domain/import/match";
import { allowedDecisions, buildEntries, effectiveDecision, entryKind, fingerprint, type ImportEntry } from "../../src/domain/import/plan";
import { parseImport } from "../../src/domain/import/preview";

const bytes = (text: string) => new TextEncoder().encode(text);
function entriesOf(csv: string): ImportEntry[] {
  const parsed = parseImport(bytes(csv), {});
  if ("rejected" in parsed) throw new Error(parsed.rejected.code);
  return buildEntries(parsed.rows);
}
const codes = (entry: ImportEntry) => entry.issues.map((i) => i.code);
const kinds = (csv: string, existing: ExistingSupplier[] = []) => {
  const entries = entriesOf(csv);
  const matches = proposeMatches(entries, existing);
  return entries.map((e, i) => [e.rowNumber, entryKind(e, matches[i]), matches[i].kind]);
};

describe("sammenslåing til én oppføring per leverandør", () => {
  test("rader med samme org.nr. summeres, og første verdi per felt brukes", () => {
    const [entry, other] = entriesOf(
      "Navn;Orgnr;Land;Beløp;Kategori\nTekstil AS;920000002;;100,50;\nTekstil Norge AS;920000002;Norge;200;Arbeidstøy\nAnnen AS;920000010;;50;\nTekstil AS;920000002;;;Sko\n",
    );
    expect(entry).toMatchObject({
      rowNumber: 2,
      sourceRows: [2, 3, 5],
      sourceRowCount: 3,
      values: { name: "Tekstil AS", registryOrgNumber: "920000002", registeredCountry: "NO", spendOre: 30_050n, purchaseCategory: "Arbeidstøy" },
    });
    // Dublettmeldingene er erstattet av én melding om sammenslåingen.
    expect(codes(entry)).toEqual(["aggregated"]);
    expect(entry.issues[0].message).toBe(
      "Slått sammen fra 3 rader i filen (rad 2, 3 og 5) med samme organisasjonsnummer eller leverandør-ID. Beløpet er summen av radene.",
    );
    expect(other).toMatchObject({ rowNumber: 4, sourceRows: [4], sourceRowCount: 1, values: { spendOre: 5_000n }, issues: [] });
  });

  test("rad uten org.nr. hører til leverandøren med samme leverandør-ID", () => {
    const entries = entriesOf("Navn;Orgnr;Leverandør-ID;Beløp\nA AS;920000002;L-1;100\nA AS;;L-1;50\nB AS;;L-2;7\n");
    expect(entries.map((e) => [e.sourceRows, e.values.spendOre])).toEqual([
      [[2, 3], 15_000n],
      [[4], 700n],
    ]);
  });

  test("ukjent beløp er ikke null: sum av kjente beløp, og ukjent når ingen rad har beløp", () => {
    const [mixed, none] = entriesOf("Navn;Orgnr;Beløp\nA AS;920000002;100\nA AS;920000002;\nB AS;920000010;\nB AS;920000010;\n");
    expect(mixed.values.spendOre).toBe(10_000n);
    expect(none.values).not.toHaveProperty("spendOre");
  });

  test("navn alene slår aldri sammen rader", () => {
    const entries = entriesOf("Navn;Beløp\nOslo Bygg AS;100\nOslo Bygg AS;200\n");
    expect(entries.map((e) => [e.sourceRows, e.values.spendOre, codes(e)])).toEqual([
      [[2], 10_000n, ["similar_name"]],
      [[3], 20_000n, ["similar_name"]],
    ]);
  });

  test("kreditnota trekkes fra summen; negativ sum er en feil som må utelates", () => {
    const [net, negative, single] = entriesOf(
      "Navn;Orgnr;Beløp\nA AS;920000002;1 000\nA AS;920000002;-250\nB AS;920000010;100\nB AS;920000010;-300\nC AS;;-5\n",
    );
    expect([net.values.spendOre, codes(net)]).toEqual([75_000n, ["amount_negative", "aggregated"]]);
    expect([negative.values.spendOre, codes(negative)]).toEqual([-20_000n, ["amount_negative", "aggregated", "amount_negative_total"]]);
    expect(codes(single)).toEqual(["amount_negative", "amount_negative_total"]);
  });

  test("rader med feil står alene og slås ikke inn i summen", () => {
    const entries = entriesOf("Navn;Orgnr;Beløp\nA AS;920000002;100\nA AS;920000002;EUR 50\nA AS;920000002;25\n");
    expect(entries.map((e) => [e.sourceRows, e.values.spendOre, codes(e)])).toEqual([
      [[2, 4], 12_500n, ["aggregated"]],
      [[3], undefined, ["amount_currency", "duplicate_org_number"]],
    ]);
  });

  test("samme ID med ulike org.nr., eller samme org.nr. med ulike ID-er, er en motstrid i filen", () => {
    const twoOrgs = entriesOf("Navn;Orgnr;Leverandør-ID\nA AS;920000002;L-1\nB AS;920000010;L-1\nC AS;;L-9\n");
    expect(twoOrgs.map((e) => [e.sourceRows, codes(e).includes("identity_conflict")])).toEqual([
      [[2], true],
      [[3], true],
      [[4], false],
    ]);
    expect(twoOrgs[0].issues.at(-1)?.message).toMatch(/med rad 3, men radene peker ikke på én og samme leverandør/);
    const twoKeys = entriesOf("Navn;Orgnr;Leverandør-ID\nA AS;920000002;L-1\nA AS;920000002;L-2\n");
    expect(twoKeys.map((e) => codes(e).includes("identity_conflict"))).toEqual([true, true]);
  });

  test("mange rader per leverandør: bare de første radnumrene lagres, antallet er riktig", () => {
    const lines = Array.from({ length: 300 }, () => "A AS;920000002;1").join("\n");
    const [entry] = entriesOf(`Navn;Orgnr;Beløp\n${lines}\n`);
    expect([entry.sourceRows.length, entry.sourceRowCount, entry.values.spendOre]).toEqual([20, 300, 30_000n]);
  });
});

describe("type og tillatte valg", () => {
  const existing: ExistingSupplier[] = [
    { id: "s-org", name: "Finnes AS", registryOrgNumber: "920000002", archived: false },
    { id: "s-key", name: "Annen AS", externalKey: "L-9", archived: false },
    { id: "s-org2", name: "Tredje AS", registryOrgNumber: "920000010", archived: false },
    { id: "s-name", name: "Navnetreff AS", archived: false },
  ];

  test("hver oppføring får én type ut fra feil, treff og avklaringer", () => {
    const csv = "Navn;Orgnr;Leverandør-ID;Land\nNy AS;;;\nNy Med Avklaring AS;;;Kinna\nKjent AS;920000002;;\nNavnetreff AS;;;\nKonflikt AS;920000010;L-9;\n;;;NO\nFeil AS;123;;\n";
    expect(kinds(csv, existing)).toEqual([
      [2, "new_clean", "new"],
      [3, "new_warning", "new"],
      [4, "known", "org_number"],
      [5, "unclear", "name"],
      [6, "unclear", "conflict"],
      [7, "error", "none"],
      [8, "error", "new"],
    ]);
  });

  test("tillatte valg per type", () => {
    expect(allowedDecisions("new_clean", "new")).toEqual(["create", "skip"]);
    expect(allowedDecisions("new_warning", "new")).toEqual(["create", "skip"]);
    expect(allowedDecisions("known", "org_number")).toEqual(["update", "skip"]);
    expect(allowedDecisions("unclear", "name")).toEqual(["update", "create", "skip"]);
    // Ved motstridende treff ville en ny leverandør bli en dublett.
    expect(allowedDecisions("unclear", "conflict")).toEqual(["update", "skip"]);
    expect(allowedDecisions("error", "new")).toEqual(["skip"]);
  });

  test("eget valg går foran fellesvalg; uten valg er oppføringen uavklart", () => {
    expect(effectiveDecision({ kind: "new_clean" }, {})).toBe("create");
    expect(effectiveDecision({ kind: "new_clean", decision: "skip" }, {})).toBe("skip");
    for (const kind of ["new_warning", "known", "unclear", "error"] as const) expect(effectiveDecision({ kind }, {})).toBeUndefined();
    expect(effectiveDecision({ kind: "known" }, { known: "update" })).toBe("update");
    expect(effectiveDecision({ kind: "known", decision: "skip" }, { known: "update" })).toBe("skip");
    expect(effectiveDecision({ kind: "error" }, { error: "skip" })).toBe("skip");
    expect(effectiveDecision({ kind: "unclear" }, { known: "update" })).toBeUndefined();
  });
});

describe("fingeravtrykk av grunnlaget", () => {
  const csv = "Navn;Orgnr;Beløp\nA AS;920000002;100\nB AS;;200\n";
  test("samme fil og valg gir samme tekst; endret beløp, rad eller periode gir en annen", () => {
    const base = fingerprint(entriesOf(csv), { period: "p1" });
    expect(fingerprint(entriesOf(csv), { period: "p1" })).toBe(base);
    expect(fingerprint(entriesOf(csv.replace("200", "201")), { period: "p1" })).not.toBe(base);
    expect(fingerprint(entriesOf(`${csv}C AS;;1\n`), { period: "p1" })).not.toBe(base);
    expect(fingerprint(entriesOf(csv), { period: "p2" })).not.toBe(base);
    // Beløp er bigint og må kunne skrives ut.
    expect(base).toContain('"10000n"');
  });
});
