import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { fetchEnhet } from "../../convex/integrations/brreg/client";
import { profileGaps, registryStatusText, type RegistryProfile } from "../../src/domain/brreg/enhet";
import { normalizeOrgNumber } from "../../src/domain/brreg/org-number";

const fixture = (name: string) => readFileSync(`tests/fixtures/brreg/${name}.json`, "utf8");

/** Falsk fetch: én respons per kall, i rekkefølge. */
function fakeFetch(...responses: Array<Response | "hang" | Error>) {
  const calls: string[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push(String(url));
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (next === "hang") {
      return await new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))),
      );
    }
    if (next instanceof Error) throw next;
    return next.clone();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const json = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "application/json" } });
const fast = { timeoutMs: 50, backoffMs: 1 };

describe("organisasjonsnummer", () => {
  test.each([
    ["920000002", "920000002"],
    ["920 000 002", "920000002"],
    ["920000003", null], // feil kontrollsiffer
    ["12345678", null],
    ["9200000021", null],
    ["abcdefghi", null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeOrgNumber(input)).toBe(expected);
  });
});

describe("Enhetsregisteret-adapter", () => {
  test("gyldig svar gir bare valgte felter, kilde-hash og hentetid", async () => {
    const { impl, calls } = fakeFetch(json(fixture("enhet-aksjeselskap")));
    const result = await fetchEnhet("920000002", { fetchImpl: impl, now: () => 1_700_000_000_000, ...fast });
    expect(calls).toEqual(["https://data.brreg.no/enhetsregisteret/api/enheter/920000002"]);
    expect(result).toMatchObject({
      kind: "found",
      fetchedAt: 1_700_000_000_000,
      mappingVersion: "brreg-enhet-v1",
      profile: {
        orgNumber: "920000002",
        name: "SYNTETISK TESTVARER AS",
        legalForm: "AS",
        industryCode: "46.900",
        industryCodeSystem: "SN",
        addressKind: "forretningsadresse",
        address: { lines: ["Testgata 1"], postalCode: "0150", city: "OSLO", countryCode: "NO" },
        bankrupt: false,
        deletedOn: null,
      },
    });
    if (result.kind !== "found") throw new Error();
    expect(result.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    // Antall ansatte og andre felter tas ikke med.
    expect(JSON.stringify(result.profile)).not.toMatch(/antallAnsatte|57|sektor/i);
    expect(profileGaps(result.profile)).toEqual([]);
  });

  test("manglende næringskode blir en synlig datamangel, ikke en standardverdi", async () => {
    const { impl } = fakeFetch(json(fixture("enhet-uten-naeringskode")));
    const result = await fetchEnhet("931234560", { fetchImpl: impl, ...fast });
    if (result.kind !== "found") throw new Error(result.kind);
    expect(result.profile.industryCode).toBeNull();
    expect(result.profile.addressKind).toBe("postadresse");
    expect(profileGaps(result.profile)).toEqual(["Næringskode mangler i registeret."]);
  });

  test("slettet enhet (200 med slettedato) vises med dato", async () => {
    const { impl } = fakeFetch(json(fixture("enhet-slettet")));
    const result = await fetchEnhet("940000017", { fetchImpl: impl, ...fast });
    if (result.kind !== "found") throw new Error(result.kind);
    expect(result.profile.deletedOn).toBe("2024-06-30");
    expect(profileGaps(result.profile)).toContain("Adresse mangler i registeret.");
    // Statusfeltene mangler i svaret: ukjent (null), ikke «nei».
    expect(result.profile).toMatchObject({ bankrupt: null, underLiquidation: null, underForcedLiquidation: null });
    expect(profileGaps(result.profile)).toContain("Konkurs- og avviklingsstatus mangler i registeret.");
  });

  test.each([
    [404, "not_found"],
    [410, "removed"],
    [400, "invalid"],
  ])("HTTP %i gir %s uten nye forsøk", async (status, kind) => {
    const { impl, calls } = fakeFetch(new Response(null, { status }));
    expect((await fetchEnhet("920000002", { fetchImpl: impl, ...fast })).kind).toBe(kind);
    expect(calls).toHaveLength(1);
  });

  test("429 prøves på nytt, og et senere gyldig svar brukes", async () => {
    const { impl, calls } = fakeFetch(new Response(null, { status: 429 }), json(fixture("enhet-aksjeselskap")));
    expect((await fetchEnhet("920000002", { fetchImpl: impl, ...fast })).kind).toBe("found");
    expect(calls).toHaveLength(2);
  });

  test("vedvarende 5xx gir unavailable etter begrenset antall forsøk", async () => {
    const { impl, calls } = fakeFetch(new Response("{}", { status: 503 }));
    expect(await fetchEnhet("920000002", { fetchImpl: impl, ...fast })).toEqual({
      kind: "unavailable",
      reason: "server_error",
    });
    expect(calls).toHaveLength(3);
  });

  test("timeout avbryter kallet og gir unavailable/timeout", async () => {
    const { impl, calls } = fakeFetch("hang");
    expect(await fetchEnhet("920000002", { fetchImpl: impl, ...fast, retries: 1 })).toEqual({
      kind: "unavailable",
      reason: "timeout",
    });
    expect(calls).toHaveLength(2);
  });

  test("nettverksfeil gir unavailable/network", async () => {
    const { impl } = fakeFetch(new TypeError("fetch failed"));
    expect(await fetchEnhet("920000002", { fetchImpl: impl, ...fast, retries: 0 })).toEqual({
      kind: "unavailable",
      reason: "network",
    });
  });

  test.each([
    ["navn mangler (API-endring)", JSON.stringify({ organisasjonsnummer: "920000002" })],
    ["navn har feil type", JSON.stringify({ organisasjonsnummer: "920000002", navn: 42 })],
    ["annet organisasjonsnummer i svaret", fixture("enhet-uten-naeringskode")],
    ["ikke JSON", "<html>vedlikehold</html>"],
  ])("%s gir contract_changed", async (_label, body) => {
    const { impl } = fakeFetch(json(body));
    expect((await fetchEnhet("920000002", { fetchImpl: impl, ...fast })).kind).toBe("contract_changed");
  });
});

describe("registerstatus som tekst", () => {
  const base = { bankrupt: false, underLiquidation: false, underForcedLiquidation: false, deletedOn: null };
  const text = (p: Partial<RegistryProfile>) => registryStatusText({ ...base, ...p } as RegistryProfile, (d) => d);

  test.each([
    [{}, "Ingen merknader"],
    [{ bankrupt: true }, "Konkurs"],
    [{ bankrupt: null, underLiquidation: null, underForcedLiquidation: null }, "Ukjent (ikke oppgitt av registeret)"],
    [{ bankrupt: null }, "Ukjent (ikke oppgitt av registeret)"],
    [{ underLiquidation: true, bankrupt: null }, "Under avvikling; øvrig konkurs- og avviklingsstatus ukjent"],
    [{ deletedOn: "2024-06-30", bankrupt: null, underLiquidation: null, underForcedLiquidation: null },
      "Slettet i registeret 2024-06-30; øvrig konkurs- og avviklingsstatus ukjent"],
  ])("%j → %s", (profile, expected) => {
    expect(text(profile as Partial<RegistryProfile>)).toBe(expected);
  });
});
