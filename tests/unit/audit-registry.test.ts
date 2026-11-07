import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { auditedMutations } from "../helpers/audited-mutations";
import { listConvexFunctions } from "../helpers/convex-functions";

const mutations = () => listConvexFunctions().filter((f) => f.kind === "mutation");

test("alle mutasjoner er vurdert for revisjonslogg", () => {
  expect(mutations().map((f) => f.path).sort()).toEqual(Object.keys(auditedMutations).sort());
});

test("mutasjoner merket som logget ligger i filer som skriver revisjonslogg", () => {
  for (const [path, classification] of Object.entries(auditedMutations)) {
    if (!("logged" in classification)) continue;
    const source = readFileSync(`convex/${path.split(":")[0]}.ts`, "utf8");
    expect(source, path).toMatch(/writeAudit\(|consumeInvitation\(/);
  }
});

test("unntak har en begrunnelse", () => {
  for (const [path, classification] of Object.entries(auditedMutations)) {
    if ("exempt" in classification) expect(classification.exempt.length, path).toBeGreaterThan(20);
  }
});
