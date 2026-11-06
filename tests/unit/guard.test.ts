import { afterEach, describe, expect, test } from "vitest";
import { assertLocalEnv, isLocalDeploymentUrl } from "../../convex/ops/guard";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("isLocalDeploymentUrl", () => {
  test.each([
    ["http://127.0.0.1:3210", true],
    ["http://localhost:3220", true],
    ["https://happy-animal-123.eu-west-1.convex.cloud", false],
    ["http://127.0.0.1.evil.example", false],
    [undefined, false],
    ["ikke en url", false],
  ])("%s → %s", (url, expected) => {
    expect(isLocalDeploymentUrl(url)).toBe(expected);
  });
});

describe("assertLocalEnv", () => {
  test("nekter når KJEDEKLAR_ENV mangler", () => {
    delete process.env.KJEDEKLAR_ENV;
    process.env.CONVEX_CLOUD_URL = "http://127.0.0.1:3210";
    expect(() => assertLocalEnv(["development"])).toThrow(/Nektet/);
  });

  test("nekter feil miljø selv på lokal URL", () => {
    process.env.KJEDEKLAR_ENV = "development";
    process.env.CONVEX_CLOUD_URL = "http://127.0.0.1:3220";
    expect(() => assertLocalEnv(["test"])).toThrow(/Nektet/);
  });

  test("nekter riktig miljønavn på sky-deployment", () => {
    process.env.KJEDEKLAR_ENV = "development";
    process.env.CONVEX_CLOUD_URL = "https://happy-animal-123.eu-west-1.convex.cloud";
    expect(() => assertLocalEnv(["development"])).toThrow(/lokal backend/);
  });

  test("tillater lokal utvikling", () => {
    process.env.KJEDEKLAR_ENV = "development";
    process.env.CONVEX_CLOUD_URL = "http://127.0.0.1:3210";
    expect(assertLocalEnv(["development"])).toBe("development");
  });
});
