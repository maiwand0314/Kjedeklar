import { describe, expect, test } from "vitest";
import { registryProfileSchema, type RegistryProfile } from "../../src/domain/brreg/enhet";
import { registryStateOf, registrySuggestions } from "../../src/domain/suppliers/registry";
import { SYNTHETIC_REGISTRY_PROFILE } from "../helpers/public-functions";

const profile = (overrides: Partial<RegistryProfile> = {}): RegistryProfile => ({ ...SYNTHETIC_REGISTRY_PROFILE, ...overrides });

describe("registryStateOf", () => {
  test("uten norsk org.nr. er beriking ikke relevant, uansett gammel status", () => {
    expect(registryStateOf({})).toBe("not_applicable");
    expect(registryStateOf({ registryEnrichment: { orgNumber: "920000010", state: "succeeded" } })).toBe("not_applicable");
  });
  test("status for et annet org.nr. gjelder ikke", () => {
    expect(registryStateOf({ registryOrgNumber: "920000010" })).toBe("not_fetched");
    expect(registryStateOf({ registryOrgNumber: "920000029", registryEnrichment: { orgNumber: "920000010", state: "succeeded" } })).toBe("not_fetched");
    expect(registryStateOf({ registryOrgNumber: "920000010", registryEnrichment: { orgNumber: "920000010", state: "failed" } })).toBe("failed");
  });
});

describe("registrySuggestions", () => {
  const supplier = { name: "Syntetisk Testvarer AS", registeredCountry: "NO", industryCode: "46.900" };
  test("ingen forskjell gir ingen forslag; store/små bokstaver og mellomrom i navnet teller ikke", () => {
    expect(registrySuggestions({ ...supplier, name: " syntetisk  testvarer as " }, profile())).toEqual([]);
  });
  test("forslag for navn, land og næringskode, også når feltet er ukjent", () => {
    expect(registrySuggestions({ name: "Annet navn" }, profile())).toEqual([
      { field: "name", current: "Annet navn", proposed: "SYNTETISK TESTVARER AS" },
      { field: "registeredCountry", current: null, proposed: "NO" },
      { field: "industryCode", current: null, proposed: "46.900" },
    ]);
    expect(registrySuggestions({ ...supplier, registeredCountry: "SE", industryCode: "47.110" }, profile())).toMatchObject([
      { field: "registeredCountry", current: "SE" },
      { field: "industryCode", current: "47.110" },
    ]);
  });
  test("manglende næringskode i registeret gir aldri forslag og sletter ikke det brukeren har", () => {
    expect(registrySuggestions(supplier, profile({ industryCode: null }))).toEqual([]);
  });
  test("NUF får ikke «NO» foreslått", () => {
    expect(registrySuggestions({ ...supplier, registeredCountry: undefined }, profile({ legalForm: "NUF" }))).toEqual([]);
  });
});

test("registryProfileSchema godtar en gyldig profil og avviser feil form", () => {
  expect(registryProfileSchema.safeParse(SYNTHETIC_REGISTRY_PROFILE).success).toBe(true);
  expect(registryProfileSchema.safeParse({ ...SYNTHETIC_REGISTRY_PROFILE, bankrupt: "nei" }).success).toBe(false);
  expect(registryProfileSchema.safeParse({ ...SYNTHETIC_REGISTRY_PROFILE, industryCodeSystem: "SN2025" }).success).toBe(false);
});
