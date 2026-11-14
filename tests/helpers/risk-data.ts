/**
 * Syntetiske risikodata for tester. Alt her er oppdiktet og merket som test.
 * Landene bruker de brukertildelte kodene XA–XZ, så ingen ekte land får et
 * oppdiktet nivå. `production`-varianten finnes bare for å teste aktiveringsflyten
 * på lokale test-backends; den er ikke et faglig grunnlag.
 */
import { manifestChecksum } from "../../src/domain/risk/datasets/checksum";

type Json = Record<string, unknown>;

const TEST_SOURCE = {
  sourceTitle: "SYNTETISK TESTVERSJON – kun test",
  sourceUrl: "https://example.com/syntetisk-test",
  sourceEdition: "test-1",
  retrievedAt: "2026-01-10",
};
const FAR_FUTURE_REVIEW = { reviewer: "Test Reviewer", reviewedAt: "2026-01-15", reviewDueAt: "2999-01-15" };
const APPROVAL = { approvedBy: "Test Godkjenner", approvedAt: "2026-01-20" };

/** Legger på riktig checksum. */
export async function seal(manifest: Json): Promise<Json> {
  return { ...manifest, checksum: await manifestChecksum({ ...manifest, checksum: "0".repeat(64) } as never) };
}

/** Kjent god produksjonsklasse-versjon: avklart lisens, gjennomgått, godkjent og ikke utløpt. */
export const productionFacts = { environment: "production", licenseStatus: "cleared", review: FAR_FUTURE_REVIEW, approval: APPROVAL } as const;
const demoFacts = { environment: "demo", licenseStatus: "unclear" } as const;

export const syntheticCountry = (version: string, overrides: Json = {}, production = false) =>
  seal({
    schemaVersion: "risk-dataset-v1",
    kind: "country",
    version,
    ...TEST_SOURCE,
    ...(production ? productionFacts : demoFacts),
    // Produksjonsklassen godtar bare ekte landkoder; nivåene her er testverdier uten faglig mening.
    entries: (production ? ["NO", "SE"] : ["XA", "XB"]).map((iso2, i) => ({
      iso2, originalIndicator: `syntetisk ${i + 1}`, screeningLevel: i === 0 ? "high" : "low", transformationNote: "Testverdi", sourceReference: "Syntetisk test",
    })),
    ...overrides,
    checksum: "0".repeat(64),
  });

export const syntheticIndustry = (version: string, overrides: Json = {}, production = false) =>
  seal({
    schemaVersion: "risk-dataset-v1",
    kind: "industry",
    version,
    codeSystem: "SN2007",
    ...TEST_SOURCE,
    ...(production ? productionFacts : demoFacts),
    entries: [
      { codePrefix: "00", screeningLevel: "moderate", sourceReference: "Syntetisk test", rationale: "Testverdi" },
      { codeExact: "00.100", screeningLevel: "low", sourceReference: "Syntetisk test", rationale: "Testverdi" },
    ],
    ...overrides,
    checksum: "0".repeat(64),
  });

export const syntheticMethod = (version: string, overrides: Json = {}, production = false) =>
  seal({
    schemaVersion: "risk-dataset-v1",
    kind: "method",
    version,
    description: "SYNTETISK TESTMETODE – kun test",
    environment: production ? "production" : "demo",
    ...(production ? { review: FAR_FUTURE_REVIEW, approval: APPROVAL } : {}),
    definition: {
      scope: "kjedeklar_screening",
      requiresProfessionalReview: true,
      levels: ["low", "moderate", "high"],
      aggregation: "ordinal_max",
      unknownPolicy: { knownHighWins: true, materialGaps: ["productionCountry"], resultWhenMaterialGap: "unknown" },
      priorityOrder: ["high", "unknown", "moderate", "low"],
      amountAffectsLevel: false,
      amountSortsWithinLevel: true,
      ruleDefinitions: [{ ruleId: "COUNTRY_LEVEL", kind: "risk_factor", factor: "country", description: "Testregel" }],
    },
    ...overrides,
    checksum: "0".repeat(64),
  });
