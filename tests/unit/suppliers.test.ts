import { describe, expect, test } from "vitest";
import { formatKroner } from "../../src/domain/applicability/form";
import { COUNTRY_CODES, countryName, countryOptions, isCountryCode } from "../../src/domain/suppliers/countries";
import {
  nameKey,
  normalizeSupplier,
  normalizeSupplierPeriod,
  parseSupplierPeriodForm,
  type SupplierPeriodForm,
} from "../../src/domain/suppliers/supplier";

const valueOf = <T>(result: { value: T } | { errors: unknown }): T => {
  if ("errors" in result) throw new Error(`Forventet gyldig, fikk ${JSON.stringify(result.errors)}`);
  return result.value;
};
const errorsOf = <E>(result: { value: unknown } | { errors: E }): E => {
  if ("value" in result) throw new Error("Forventet feil, men verdien var gyldig");
  return result.errors;
};

describe("landkoder", () => {
  test("249 unike ISO-koder, alle med norsk navn", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    expect(COUNTRY_CODES.filter((code) => !/^[A-Z]{2}$/.test(code) || countryName(code) === code)).toEqual([]);
    expect(countryName("NO")).toBe("Norge");
    expect(countryName("CN")).toBe("Kina");
  });

  test("ukjente og feilskrevne koder avvises", () => {
    expect(["NO", "VN"].every(isCountryCode)).toBe(true);
    expect(["no", "XX", "NOR", "", "EU"].some(isCountryCode)).toBe(false);
  });

  test("valglisten er sortert på norsk navn", () => {
    const names = countryOptions().map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "nb")));
    expect(names).toContain("Norge");
  });
});

describe("leverandørprofil", () => {
  test("bare navnet er påkrevd; tomme felt blir utelatt, ikke lagret som tom tekst", () => {
    const value = valueOf(
      normalizeSupplier({ name: "  Oslo   Bygg AS ", registryOrgNumber: "", externalKey: "  ", registeredCountry: "", industryCodeSystem: "", industryCode: "" }),
    );
    expect(value).toEqual({ name: "Oslo Bygg AS" });
  });

  test("alle felt utfylt: org.nr. uten mellomrom, kodeverk og kode sammen", () => {
    const value = valueOf(
      normalizeSupplier({
        name: "Syntetisk Tekstil AS",
        registryOrgNumber: "920 000 002",
        externalKey: " L-1001 ",
        registeredCountry: "NO",
        industryCodeSystem: "SN2007",
        industryCode: "46.420",
      }),
    );
    expect(value).toEqual({
      name: "Syntetisk Tekstil AS",
      registryOrgNumber: "920000002",
      externalKey: "L-1001",
      registeredCountry: "NO",
      industryCodeSystem: "SN2007",
      industryCode: "46.420",
    });
  });

  test.each([
    [{ name: "   " }, "name"],
    [{ name: "x".repeat(201) }, "name"],
    [{ name: "A", registryOrgNumber: "920000003" }, "registryOrgNumber"], // feil kontrollsiffer
    [{ name: "A", registryOrgNumber: "12345" }, "registryOrgNumber"],
    [{ name: "A", externalKey: "x".repeat(101) }, "externalKey"],
    [{ name: "A", registeredCountry: "Norge" }, "registeredCountry"],
    [{ name: "A", registeredCountry: "no" }, "registeredCountry"],
    [{ name: "A", industryCode: "46.900" }, "industryCodeSystem"], // kode uten kodeverk
    [{ name: "A", industryCodeSystem: "SN2007" }, "industryCode"], // kodeverk uten kode
    [{ name: "A", industryCodeSystem: "ISIC", industryCode: "46" }, "industryCodeSystem"],
    [{ name: "A", industryCodeSystem: "NACE2", industryCode: "handel" }, "industryCode"],
  ] as const)("ugyldig %j gir feil på %s", (raw, field) => {
    expect(Object.keys(errorsOf(normalizeSupplier(raw)))).toEqual([field]);
  });

  test("navnenøkkel: små bokstaver og enkle mellomrom, også for æ, ø og å", () => {
    expect(nameKey("  Oslo   BYGG AS ")).toBe("oslo bygg as");
    expect(nameKey("ÅS ØKOLOGISKE ÆRFUGLDUN")).toBe("ås økologiske ærfugldun");
  });
});

describe("innkjøpsdata for en periode", () => {
  const form = (overrides: Partial<SupplierPeriodForm> = {}): SupplierPeriodForm => ({
    spend: "",
    purchaseCategory: "",
    purchaseDescription: "",
    productionCountries: [],
    upstreamUnknown: true,
    ...overrides,
  });
  const spendOf = (spend: string) => valueOf(parseSupplierPeriodForm(form({ spend }))).spendOre;

  test("tomt beløp er ukjent og noe annet enn null kroner", () => {
    const unknown = valueOf(parseSupplierPeriodForm(form()));
    expect(unknown).toEqual({ productionCountries: [], upstreamUnknown: true });
    expect("spendOre" in unknown).toBe(false);
    expect(spendOf("0")).toBe(0n);
    expect(spendOf("0,00")).toBe(0n);
    expect(formatKroner(0n)).toBe("0 kr");
  });

  test.each([
    ["125000", 12_500_000n],
    ["125 000", 12_500_000n],
    ["1 250,50", 125_050n],
    ["1250,5", 125_050n],
    ["1250.5", 125_050n],
    ["12 345 678,90", 1_234_567_890n], // hardt mellomrom, slik norske regneark skriver
    ["0,01", 1n],
  ])("norsk beløp %j → %s øre", (raw, expected) => {
    expect(spendOf(raw)).toBe(expected);
  });

  test("store beløp lagres eksakt, også over grensen for vanlige flyttall", () => {
    const ore = spendOf("999 999 999 999 999,99");
    expect(ore).toBe(99_999_999_999_999_999n);
    expect(ore! > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(formatKroner(ore!).replace(/\s/g, " ")).toBe("999 999 999 999 999,99 kr");
  });

  test.each(["-5", "1,234", "12 kr", "1.234,50", "abc", "1,2,3", "1234567890123456"])(
    "ugyldig beløp %j avvises i stedet for å gjettes",
    (raw) => {
      expect(Object.keys(errorsOf(parseSupplierPeriodForm(form({ spend: raw }))))).toEqual(["spend"]);
    },
  );

  test("tekst trimmes, tom tekst utelates, og land blir unike og sortert", () => {
    const value = valueOf(
      parseSupplierPeriodForm(
        form({ purchaseCategory: " Arbeidstøy ", purchaseDescription: "  ", productionCountries: ["VN", "CN", "VN"], upstreamUnknown: false }),
      ),
    );
    expect(value).toEqual({ purchaseCategory: "Arbeidstøy", productionCountries: ["CN", "VN"], upstreamUnknown: false });
  });

  test("ukjent landkode og for lang tekst avvises", () => {
    expect(Object.keys(errorsOf(parseSupplierPeriodForm(form({ productionCountries: ["CN", "Kina"] }))))).toEqual(["productionCountries"]);
    expect(
      Object.keys(errorsOf(parseSupplierPeriodForm(form({ purchaseCategory: "x".repeat(101), purchaseDescription: "x".repeat(2001) })))),
    ).toEqual(["purchaseCategory", "purchaseDescription"]);
  });

  test("negativt beløp og beløp over 64 bit avvises på serversiden", () => {
    const base = { productionCountries: [], upstreamUnknown: true };
    expect(Object.keys(errorsOf(normalizeSupplierPeriod({ ...base, spendOre: -1n })))).toEqual(["spend"]);
    expect(Object.keys(errorsOf(normalizeSupplierPeriod({ ...base, spendOre: 2n ** 63n })))).toEqual(["spend"]);
    expect(valueOf(normalizeSupplierPeriod({ ...base, spendOre: 2n ** 63n - 1n })).spendOre).toBe(2n ** 63n - 1n);
  });
});
