/** CSV-lesing: tegnsett, skilletegn, anførselstegn, grenser og radnummer. */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { detectDelimiter, readCsv, type CsvTable } from "../../src/domain/import/csv";
import { MAX_FILE_BYTES, MAX_ROWS } from "../../src/domain/import/limits";

const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/csv/${name}`));
const bytes = (text: string) => new TextEncoder().encode(text);

function tableOf(input: Uint8Array, delimiter?: ";" | ","): CsvTable {
  const result = readCsv(input, delimiter);
  if ("rejected" in result) throw new Error(`Avvist: ${result.rejected.code}`);
  return result.table;
}
const rejectionOf = (input: Uint8Array) => {
  const result = readCsv(input);
  if ("table" in result) throw new Error("Forventet avvisning");
  return result.rejected.code;
};

describe("tegnsett", () => {
  test("UTF-8 med BOM: BOM-en blir ikke en del av første overskrift, og æøå og harde mellomrom beholdes", () => {
    const table = tableOf(fixture("bom-semikolon.csv"));
    expect(table.delimiter).toBe(";");
    expect(table.headers).toEqual(["Navn", "Organisasjonsnummer", "Leverandør-ID", "Land", "Innkjøp (NOK)", "Bransjekode", "Kategori", "Beskrivelse"]);
    expect(table.rows.map((r) => r.cells[0])).toEqual(["Syntetisk Tekstil AS", "Østfold Rens & Vask ANS", "Shenzhen Syntetisk Elektronikk Co. Ltd"]);
    expect(table.rows[0].cells[4]).toBe("1 250 000,50");
  });

  test("fil som ikke er UTF-8 avvises i stedet for å gi ødelagte tegn", () => {
    expect(rejectionOf(fixture("latin1.csv"))).toBe("not_utf8");
    // UTF-16 (Excel «Unicode-tekst») og binærfiler inneholder nullbytes.
    expect(rejectionOf(new Uint8Array([0xff, 0xfe, 0x4e, 0x00, 0x61, 0x00]))).toBe("not_utf8");
    expect(rejectionOf(bytes("Navn;Land\nA\u0000S;NO\n"))).toBe("not_utf8");
  });
});

describe("skilletegn", () => {
  test("komma oppdages fra overskriftsraden, og komma inne i siterte felt deler ikke feltet", () => {
    const table = tableOf(fixture("komma.csv"));
    expect(table.delimiter).toBe(",");
    expect(table.rows.map((r) => r.cells)).toEqual([
      ["Bergen Bygg, avd. Vest AS", "920000010", "NO", "1 250,50"],
      ["Alta Frakt AS", "", "Norway", "12,5"],
    ]);
  });

  test("semikolon velges når overskriften har flest semikolon, selv om beløpene har desimalkomma", () => {
    expect(detectDelimiter("Navn;Beløp\nA AS;1,5\nB AS;2,5\n")).toBe(";");
    expect(detectDelimiter('"Navn, fullt";Beløp\n')).toBe(";");
    expect(detectDelimiter("name,amount\n")).toBe(",");
    // Én kolonne: semikolon, så et navn med komma ikke deles.
    expect(tableOf(bytes("Navn\nHansen, Ola ENK\n")).rows[0].cells).toEqual(["Hansen, Ola ENK"]);
  });

  test("brukeren kan overstyre skilletegnet", () => {
    const input = bytes("a;b,c\n1;2,3\n");
    expect(tableOf(input).headers).toEqual(["a", "b,c"]);
    expect(tableOf(input, ",").headers).toEqual(["a;b", "c"]);
  });
});

describe("anførselstegn og linjeskift", () => {
  test("doble anførselstegn, linjeskift og skilletegn inne i et sitert felt", () => {
    const table = tableOf(fixture("anforselstegn.csv"));
    expect(table.rows.map((r) => r.cells)).toEqual([
      ['Syntetisk "Kvalitet" AS', "Linje én\nlinje to; med semikolon", "100"],
      ["Vanlig AS", "enkel", "200"],
    ]);
    // Feltet med linjeskift er fortsatt én rad, slik et regneark viser den.
    expect(table.rows.map((r) => r.rowNumber)).toEqual([2, 3]);
  });

  test.each([
    ["CRLF", "Navn;Land\r\nA AS;NO\r\nB AS;SE\r\n"],
    ["LF", "Navn;Land\nA AS;NO\nB AS;SE\n"],
    ["CR", "Navn;Land\rA AS;NO\rB AS;SE\r"],
    ["uten avsluttende linjeskift", "Navn;Land\nA AS;NO\nB AS;SE"],
  ])("linjeskift: %s", (_label, text) => {
    expect(tableOf(bytes(text)).rows.map((r) => r.cells)).toEqual([
      ["A AS", "NO"],
      ["B AS", "SE"],
    ]);
  });

  test("anførselstegn som ikke lukkes merkes på raden i stedet for å skjules", () => {
    const table = tableOf(bytes('Navn;Land\nGod AS;NO\n"Åpen AS;NO\nNeste AS;SE\n'));
    expect(table.rows.map((r) => [r.rowNumber, r.quoteError])).toEqual([
      [2, false],
      [3, true],
    ]);
  });
});

describe("tomme felt og radnummer", () => {
  test("tomme linjer hoppes over uten å forskyve radnummeret; tomme felt beholdes som tomme", () => {
    const table = tableOf(fixture("tomme-felt.csv"));
    expect(table.rows.map((r) => [r.rowNumber, r.cells])).toEqual([
      [3, ["Kun Navn AS", "", "", ""]],
      [4, ["", "920000002", "NO", "100"]],
      [5, ["Kort Rad AS"]],
      [7, ["Null Kroner AS", "", "", "0"]],
    ]);
  });

  test("overskrift uten tekst får et navn brukeren kan velge", () => {
    expect(tableOf(bytes("Navn;;  \nA AS;x;y\n")).headers).toEqual(["Navn", "Kolonne 2", "Kolonne 3"]);
  });
});

describe("grenser", () => {
  const rows = (count: number) => bytes(`Navn\n${Array.from({ length: count }, (_, i) => `Leverandør ${i + 1} AS`).join("\n")}\n`);

  test(`${MAX_ROWS} rader godtas, én til avvises`, () => {
    expect(tableOf(rows(MAX_ROWS)).rows).toHaveLength(MAX_ROWS);
    expect(rejectionOf(rows(MAX_ROWS + 1))).toBe("too_many_rows");
  });

  test("fil over 2 MiB avvises på størrelsen, før innholdet leses", () => {
    // Ugyldig UTF-8: hadde innholdet blitt lest først, ville svaret vært «not_utf8».
    expect(rejectionOf(new Uint8Array(MAX_FILE_BYTES + 1).fill(0xff))).toBe("too_large");
    const atLimit = new Uint8Array(MAX_FILE_BYTES).fill(0x20);
    atLimit.set(bytes("Navn\nA AS\n"));
    expect(tableOf(atLimit).rows).toHaveLength(1);
  });

  test("tom fil, bare overskrift og for mange kolonner avvises med hver sin grunn", () => {
    expect(rejectionOf(bytes(""))).toBe("empty");
    expect(rejectionOf(bytes("  \n\n;;;\n"))).toBe("empty");
    expect(rejectionOf(bytes("Navn;Land\n"))).toBe("no_rows");
    expect(rejectionOf(bytes(`${Array.from({ length: 51 }, (_, i) => `k${i}`).join(";")}\nx\n`))).toBe("too_many_columns");
  });
});
