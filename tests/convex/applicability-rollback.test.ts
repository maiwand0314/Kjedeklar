/**
 * Atomisk lagring: feiler revisjonsloggen, lagres heller ingen vurdering.
 * Egen fil fordi writeAudit byttes ut for hele filen.
 */
import { expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { SYNTHETIC_APPLICABILITY_INPUT } from "../helpers/public-functions";
import { setupTest, twoTenants } from "./setup";

vi.mock("../../convex/lib/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../convex/lib/audit")>()),
  writeAudit: async () => {
    throw new Error("Revisjonsloggen feilet (test)");
  },
}));

test("feil i revisjonsloggen ruller tilbake vurderingen", async () => {
  const t = setupTest();
  const fx = await twoTenants(t);
  await expect(
    t.withIdentity(fx.userA.identity).mutation(api.organizations.applicability.assess, {
      organizationId: fx.orgA,
      inputs: SYNTHETIC_APPLICABILITY_INPUT,
      confirmed: true,
    }),
  ).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await t.run((ctx) => ctx.db.query("applicabilityAssessments").collect())).toEqual([]);
});
