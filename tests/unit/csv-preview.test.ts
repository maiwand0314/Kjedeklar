/** Kolonnevalg, normalisering, dubletter, matching og ubetrodd tekst i importforhåndsvisningen. */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseCountry } from "../../src/domain/import/country";
import { mappingProblem, suggestMapping } from "../../src/domain/import/mapping";
import type { ExistingSupplier } from "../../src/domain/import/match";
import { matchKey } from "../../src/domain/import/normalize";
import { matchImport, parseImport, type ParsedImport, type PreviewOptions } from "../../src/domain/import/preview";

const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/csv/${name}`));
const bytes = (text: string) => new TextEncoder().encode(text);

function parsed(input: Uint8Array, options: PreviewOptions = {}): ParsedImport {
  const result = parseImport(input, options);
  if ("rejected" in result) throw new Error(`Avvist: ${result.rejected.code}`);
  return result;
}
const preview = (input: Uint8Array, existing: ExistingSupplier[] = [], options: PreviewOptions = {}) => {
  const p = parsed(input, options);
  return { ...p, ...matchImport(p.rows, existing) };
};
const codes = (row: { issues: { code: string }[] }) => row.issues.map((i) => i.code);

describe("kolonnevalg", () => {
  test("foreslås fra norske og engelske overskrifter, uansett store bokstaver og tegnsetting", () => {
    expect(suggestMapping(["Navn", "Organisasjonsnummer", "Leverandør-ID", "Land", "Innkjøp (NOK)", "Bransjekode", "Kategori", "Beskrivelse"])).toEqual({
      name: 0,
      registryOrgNumber: 1,
      externalKey: 2,
      registeredCountry: 3,
      spend: 4,
      industryCode: 5,
      purchaseCategory: 6,
      purchaseDescription: 7,
    });
    expect(suggestMapping(["AMOUNT", "Org.nr.", "Supplier", "country"])).toEqual({ spend: 0, registryOrgNumber: 1, name: 2, registeredCountry: 3 });
  });

  test("ukjente overskrifter foreslås ikke, og brukeren må da velge navnekolonnen", () => {
    expect(suggestMapping(["Kolonne A", "Tekst"])).toEqual({});
    const p = parsed(bytes("Kolonne A;Tekst\nx;y\n"));
    expect(p.problems).toEqual(["Velg hvilken kolonne som inneholder navnet på leverandøren."]);
    expect(p.rows).toEqual([]);
    expect(p.rowCount).toBe(1);
    // Med et eksplisitt valg kommer radene.
    expect(parsed(bytes("Kolonne A;Tekst\nx;y\n"), { mapping: { name: 1 } }).rows[0].values).toEqual({ name: "y" });
  });

  test("kolonne utenfor filen og samme kolonne to ganger avvises som valg", () => {
    expect(mappingProblem({ name: 0 }, 2)).toBeNull();
    expect(mappingProblem({ name: 2 }, 2)).toMatch(/finnes ikke/);
    expect(mappingProblem({ name: -1 }, 2)).toMatch(/finnes ikke/);
    expect(mappingProblem({ name: 0.5 }, 2)).toMatch(/finnes ikke/);
    expect(mappingProblem({ name: 0, spend: 0 }, 2)).toMatch(/Samme kolonne/);
  });

  test("bransjekode krever at kodeverket er valgt", () => {
    const input = fixture("bom-semikolon.csv");
    const without = parsed(input);
    expect(without.problems).toEqual([expect.stringMatching(/Velg kodeverket/)]);
    expect(without.rows.every((r) => r.values.industryCode === undefined)).toBe(true);
    const withSystem = parsed(input, { industryCodeSystem: "SN2007" });
    expect(withSystem.problems).toEqual([]);
    expect(withSystem.rows.map((r) => r.values.industryCode)).toEqual(["46.420", "81.210", undefined]);
  });
});

describe("normalisering", () => {
  test("kildeverdi og normalisert verdi for hvert felt", () => {
    const { rows, summary } = preview(fixture("bom-semikolon.csv"), [], { industryCodeSystem: "SN2007" });
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      source: { name: "Syntetisk Tekstil AS", registryOrgNumber: "920 000 002", registeredCountry: "Norge", spend: "1 250 000,50" },
      values: {
        name: "Syntetisk Tekstil AS",
        registryOrgNumber: "920000002",
        externalKey: "L-1001",
        registeredCountry: "NO",
        spendOre: 125_000_050n,
        industryCode: "46.420",
        purchaseCategory: "Arbeidstøy",
        purchaseDescription: "Arbeidsklær til lager",
      },
      issues: [],
      status: "ready",
    });
    expect(rows[2].values).toMatchObject({ registeredCountry: "CN", spendOre: 41_200_000n });
    // Tomme felt gir ingen verdi: de er ukjente, ikke tom tekst.
    expect(rows[1].values).not.toHaveProperty("registryOrgNumber");
    expect(rows[1].values).not.toHaveProperty("purchaseDescription");
    expect(summary).toEqual({ ready: 3, clarify: 0, error: 0, proposedNew: 3, proposedExisting: 0, proposedUnclear: 0 });
  });

  test("malen i repoet leses uten avklaringer", () => {
    const result = preview(new Uint8Array(readFileSync("public/maler/leverandorer-mal.csv")));
    expect(result.problems).toEqual([]);
    expect(result.rows.map((r) => [r.status, r.issues])).toEqual([
      ["ready", []],
      ["ready", []],
      ["ready", []],
    ]);
    expect(result.rows[0].values).toMatchObject({ registryOrgNumber: "920000002", registeredCountry: "NO", spendOre: 125_000_050n });
  });

  test("tomme felt: ukjent beløp er noe annet enn null, og manglende navn er en feil", () => {
    const { rows } = preview(fixture("tomme-felt.csv"));
    expect(rows.map((r) => [r.rowNumber, r.status, codes(r)])).toEqual([
      [3, "ready", []],
      [4, "error", ["name_missing"]],
      [5, "clarify", ["too_few_fields"]],
      [7, "ready", []],
    ]);
    expect(rows[0].values).toEqual({ name: "Kun Navn AS" });
    expect(rows[3].values).toEqual({ name: "Null Kroner AS", spendOre: 0n });
    // Raden uten navn har fortsatt org.nr., land og beløp normalisert.
    expect(rows[1].values).toEqual({ registryOrgNumber: "920000002", registeredCountry: "NO", spendOre: 10_000n });
  });

  test("beløp: eksakt, tvetydig, negativt, annen valuta og ugyldig blir synlige avklaringer", () => {
    const { rows } = preview(fixture("belop.csv"));
    const byName = Object.fromEntries(rows.map((r) => [r.values.name, { ore: r.values.spendOre, status: r.status, codes: codes(r) }]));
    expect(byName).toEqual({
      "Eksakt AS": { ore: 9_007_199_254_740_993n, status: "ready", codes: [] },
      "Tusenpunktum AS": { ore: 123_456_789n, status: "ready", codes: [] },
      "Amerikansk AS": { ore: 123_456_789n, status: "ready", codes: [] },
      "Tvetydig Punktum AS": { ore: undefined, status: "clarify", codes: ["amount_ambiguous"] },
      "Tvetydig Komma AS": { ore: undefined, status: "clarify", codes: ["amount_ambiguous"] },
      "Negativ AS": { ore: -500_000n, status: "clarify", codes: ["amount_negative"] },
      "Kreditnota AS": { ore: -125_050n, status: "clarify", codes: ["amount_negative"] },
      "Euro AS": { ore: undefined, status: "error", codes: ["amount_currency"] },
      "Krone AS": { ore: 250_000n, status: "ready", codes: [] },
      "Vitenskapelig AS": { ore: undefined, status: "error", codes: ["amount_format"] },
      "Ukjent AS": { ore: undefined, status: "ready", codes: [] },
      "Null AS": { ore: 0n, status: "ready", codes: [] },
      "Tre Desimaler AS": { ore: undefined, status: "error", codes: ["amount_decimals"] },
    });
  });

  test("valgt desimaltegn avklarer de tvetydige beløpene for hele filen", () => {
    const amounts = (decimal: "comma" | "dot") =>
      Object.fromEntries(preview(fixture("belop.csv"), [], { decimal }).rows.map((r) => [r.values.name, r.values.spendOre]));
    expect(amounts("comma")).toMatchObject({ "Tvetydig Punktum AS": 123_400n, "Tusenpunktum AS": 123_456_789n });
    expect(amounts("dot")).toMatchObject({ "Tvetydig Komma AS": 1_234_500n, "Amerikansk AS": 123_456_789n });
  });

  test("org.nr.: mellomrom, punktum og «NO … MVA» godtas; feil kontrollsiffer og feil lengde er feil", () => {
    const row = (orgNumber: string) => preview(bytes(`Navn;Orgnr\nA AS;${orgNumber}\n`)).rows[0];
    for (const written of ["920000002", "920 000 002", "920.000.002", "NO 920 000 002 MVA", "no920000002mva"]) {
      expect(row(written).values.registryOrgNumber, written).toBe("920000002");
    }
    for (const written of ["920000003", "12345678", "9200000022", "ukjent", "NO MVA"]) {
      const r = row(written);
      expect(codes(r), written).toEqual(["org_number_invalid"]);
      expect(r.values, written).toEqual({ name: "A AS" });
      expect(r.status).toBe("error");
    }
  });

  test("land: kode eller norsk eller engelsk navn; ukjent land gjettes ikke", () => {
    expect(["NO", "no", " Norge ", "norway", "KINA", "China", "Storbritannia", "UK", "Côte d'Ivoire", "Elfenbenskysten", "Turkey", "Tyrkia"].map(parseCountry)).toEqual(
      ["NO", "NO", "NO", "NO", "CN", "CN", "GB", "GB", "CI", "CI", "TR", "TR"],
    );
    expect(parseCountry("")).toBeNull();
    expect(["Kinna", "Korea", "EU", "NOR", "Asia", "XX"].map(parseCountry)).toEqual(Array(6).fill(undefined));
    const row = preview(bytes("Navn;Land\nA AS;Kinna\n")).rows[0];
    expect(codes(row)).toEqual(["country_unknown"]);
    expect(row.values).toEqual({ name: "A AS" });
    expect(row.source.registeredCountry).toBe("Kinna");
    expect(row.status).toBe("clarify");
  });

  test("for lange verdier er feil, og kildeteksten avkortes i svaret", () => {
    const long = "x".repeat(2001);
    const row = preview(bytes(`Navn;Leverandør-ID;Kategori;Beskrivelse\n${"N".repeat(201)};${"i".repeat(101)};${"k".repeat(101)};${long}\n`)).rows[0];
    expect(codes(row)).toEqual(["name_too_long", "external_key_too_long", "category_too_long", "description_too_long"]);
    expect(row.values).toEqual({});
    expect(row.source.purchaseDescription).toHaveLength(201);
    expect(row.source.purchaseDescription?.endsWith("…")).toBe(true);
  });

  test("rad med flere felt enn overskriften og rad med åpent anførselstegn er feil", () => {
    const { rows } = preview(bytes('Navn;Land\nFor Mange AS;NO;ekstra\n"Åpen AS;NO\n'));
    expect(rows.map((r) => [r.rowNumber, r.status, codes(r)])).toEqual([
      [2, "error", ["too_many_fields"]],
      [3, "error", ["quotes", "too_few_fields"]],
    ]);
  });
});

describe("ubetrodd tekst", () => {
  test("HTML, script og regnearkformler beholdes tegn for tegn som tekst", () => {
    const { rows } = preview(fixture("ubetrodd-tekst.csv"));
    expect(rows.map((r) => [r.values.name, r.values.purchaseDescription])).toEqual([
      ["<script>alert('xss')</script>", "<img src=x onerror=alert(1)>"],
      ['=HYPERLINK("http://ondsinnet.example";"Klikk")', "=1+1"],
      ["+47 Leverandør AS", "@SUM(A1:A9)"],
      ["-Minus AS", "=cmd|' /C calc'!A0"],
      ["@Krøllalfa AS", "{{7*7}}"],
    ]);
    // Formeltegn først i navnet gir en avklaring; teksten endres ikke.
    expect(rows.map(codes)).toEqual([[], ["name_formula"], ["name_formula"], ["name_formula"], ["name_formula"]]);
    expect(rows.map((r) => r.values.spendOre)).toEqual([10_000n, 20_000n, 30_000n, 40_000n, 50_000n]);
  });

  test("en formel i beløpsfeltet regnes ikke ut", () => {
    const row = preview(bytes("Navn;Beløp\nA AS;=1+1\n")).rows[0];
    expect(codes(row)).toEqual(["amount_format"]);
    expect(row.values).toEqual({ name: "A AS" });
  });
});

describe("dubletter i filen", () => {
  test("samme org.nr. og samme leverandør-ID meldes med radnummer; lignende navn er en mulig dublett", () => {
    const { rows } = preview(fixture("lignende-navn.csv"));
    const issues = Object.fromEntries(rows.map((r) => [r.rowNumber, r.issues.map((i) => `${i.code}: ${i.message}`)]));
    expect(issues).toEqual({
      2: ["similar_name: Navnet ligner på navnet i rad 3 og 4."],
      3: ["similar_name: Navnet ligner på navnet i rad 2 og 4."],
      4: ["duplicate_org_number: Samme organisasjonsnummer som rad 8.", "similar_name: Navnet ligner på navnet i rad 2 og 3."],
      5: [], // «Oslo Byggevarer AS» er et annet navn
      // Samme navn, men hvert sitt gyldige org.nr.: to ulike virksomheter.
      6: [],
      7: [],
      8: ["duplicate_org_number: Samme organisasjonsnummer som rad 4.", "duplicate_external_key: Samme leverandør-ID som rad 9."],
      9: ["duplicate_external_key: Samme leverandør-ID som rad 8."],
    });
    expect(rows.every((r) => r.issues.every((i) => i.level === "warning"))).toBe(true);
  });

  test("mange dubletter listes kort", () => {
    const { rows } = preview(bytes(`Navn;Orgnr\n${Array.from({ length: 7 }, (_, i) => `Rad ${i} AS;920000002`).join("\n")}\n`));
    expect(rows[0].issues[0].message).toBe("Samme organisasjonsnummer som rad 3, 4, 5 og 3 til.");
  });

  test("navnenøkkel for sammenligning: selskapsform og tegnsetting teller ikke", () => {
    expect(["Oslo Bygg AS", "OSLO BYGG A/S", "oslo  bygg", "Oslo Bygg A.S.", "Oslo Bygg Ltd."].map(matchKey)).toEqual(Array(5).fill("oslo bygg"));
    expect(matchKey("Oslo Byggevarer AS")).toBe("oslo byggevarer");
    expect(matchKey("AS")).toBe("as"); // bare selskapsform: behold navnet
  });
});

describe("foreslått matching mot leverandører som finnes fra før", () => {
  const existing: ExistingSupplier[] = [
    { id: "s-org", name: "Syntetisk Tekstil Norge AS", registryOrgNumber: "920000002", archived: false },
    { id: "s-key", name: "Gammelt Navn AS", externalKey: "L-1002", archived: false },
    { id: "s-name", name: "SHENZHEN SYNTETISK ELEKTRONIKK CO LTD", archived: false },
    { id: "s-arkiv", name: "Arkivert AS", registryOrgNumber: "920000010", archived: true },
    { id: "s-annen", name: "Annen AS", registryOrgNumber: "920000029", externalKey: "K-9", archived: false },
  ];
  const matchOf = (csv: string, list = existing) => {
    const [row] = preview(bytes(csv), list).rows;
    return { match: row.match, codes: codes(row), status: row.status };
  };
  const brief = (id: string) => {
    const s = existing.find((e) => e.id === id)!;
    return { id: s.id, name: s.name, archived: s.archived };
  };

  test("org.nr. og leverandør-ID er sikre treff; navn er bare et forslag som må avklares", () => {
    const { rows, summary } = preview(fixture("bom-semikolon.csv"), existing, { industryCodeSystem: "SN2007" });
    expect(rows.map((r) => [r.match, r.status, codes(r)])).toEqual([
      [{ kind: "org_number", suppliers: [brief("s-org")] }, "ready", []],
      [{ kind: "external_key", suppliers: [brief("s-key")] }, "ready", []],
      [{ kind: "name", suppliers: [brief("s-name")] }, "clarify", ["match_name"]],
    ]);
    expect(summary).toMatchObject({ proposedNew: 0, proposedExisting: 2, proposedUnclear: 1 });
  });

  test("ingen treff er en ny leverandør; rad uten navn og identifikator får ikke noe forslag", () => {
    expect(matchOf("Navn;Orgnr\nHelt Ny AS;\n")).toEqual({ match: { kind: "new" }, codes: [], status: "ready" });
    expect(matchOf("Navn;Orgnr;Land\n;;NO\n")).toEqual({ match: { kind: "none" }, codes: ["name_missing"], status: "error" });
  });

  test("org.nr. og leverandør-ID som peker på ulike leverandører er en konflikt", () => {
    expect(matchOf("Navn;Orgnr;Leverandør-ID\nKonflikt AS;920000002;L-1002\n")).toEqual({
      match: { kind: "conflict", suppliers: [brief("s-org"), brief("s-key")] },
      codes: ["match_conflict"],
      status: "clarify",
    });
    // ID-en tilhører en leverandør med et annet org.nr. enn raden.
    expect(matchOf("Navn;Orgnr;Leverandør-ID\nKonflikt AS;920000037;K-9\n").match).toEqual({ kind: "conflict", suppliers: [brief("s-annen")] });
    // To leverandører med samme ID (ID er ikke unik ennå).
    const twins: ExistingSupplier[] = [
      { id: "t1", name: "Tvilling En AS", externalKey: "T-1", archived: false },
      { id: "t2", name: "Tvilling To AS", externalKey: "T-1", archived: false },
    ];
    expect(matchOf("Navn;Leverandør-ID\nTvilling AS;T-1\n", twins).match.kind).toBe("conflict");
  });

  test("konfliktmeldingen nevner bare det raden faktisk har", () => {
    const conflictMessage = (csv: string, list = existing) =>
      preview(bytes(csv), list).rows[0].issues.find((i) => i.code === "match_conflict")?.message;
    expect(conflictMessage("Navn;Orgnr;Leverandør-ID\nKonflikt AS;920000002;L-1002\n")).toBe(
      "Organisasjonsnummer og leverandør-ID peker på ulike leverandører som finnes fra før. Avklar hvilken som er riktig.",
    );
    // Org.nr. i raden finnes ikke fra før; ID-en tilhører en leverandør med et annet org.nr.
    expect(conflictMessage("Navn;Orgnr;Leverandør-ID\nKonflikt AS;920000037;K-9\n")).toBe(
      "Leverandør-ID-en tilhører en leverandør som finnes fra før med et annet organisasjonsnummer. Avklar hvilken som er riktig.",
    );
    // Bare leverandør-ID i raden, og to leverandører har den.
    const twins: ExistingSupplier[] = [
      { id: "t1", name: "Tvilling En AS", externalKey: "T-1", archived: false },
      { id: "t2", name: "Tvilling To AS", externalKey: "T-1", archived: false },
    ];
    expect(conflictMessage("Navn;Leverandør-ID\nTvilling AS;T-1\n", twins)).toBe(
      "Flere leverandører som finnes fra før, har samme leverandør-ID. Avklar hvilken som er riktig.",
    );
  });

  test("treff på arkivert leverandør sies fra om", () => {
    expect(matchOf("Navn;Orgnr\nArkivert AS;920000010\n")).toEqual({
      match: { kind: "org_number", suppliers: [brief("s-arkiv")] },
      codes: ["match_archived"],
      status: "clarify",
    });
  });

  test("likt navn foreslås ikke når begge har hvert sitt org.nr.", () => {
    expect(matchOf("Navn;Orgnr\nAnnen AS;920000037\n").match).toEqual({ kind: "new" });
    expect(matchOf("Navn;Orgnr\nAnnen AS;\n").match).toEqual({ kind: "name", suppliers: [brief("s-annen")] });
  });

  test("raden endres ikke av forslaget, og eksisterende leverandører røres ikke", () => {
    const before = structuredClone(existing);
    const { rows } = preview(fixture("bom-semikolon.csv"), existing);
    expect(existing).toEqual(before);
    expect(rows[0].values.name).toBe("Syntetisk Tekstil AS"); // ikke navnet til leverandøren som finnes fra før
  });
});
