/**
 * Atomisk lagring: feiler revisjonsloggen, lagres verken periode eller profil.
 * Egen fil fordi writeAudit byttes ut for hele filen.
 */
import { expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { SYNTHETIC_PERIOD, SYNTHETIC_PROFILE_ANSWERS } from "../helpers/public-functions";
import { setupTest, twoTenants } from "./setup";

vi.mock("../../convex/lib/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../convex/lib/audit")>()),
  writeAudit: async () => {
    throw new Error("Revisjonsloggen feilet (test)");
  },
}));

test("feil i revisjonsloggen ruller tilbake ny rapportperiode", async () => {
  const t = setupTest();
  const fx = await twoTenants(t);
  await expect(
    t.withIdentity(fx.userA.identity).mutation(api.organizations.reportingPeriods.create, { organizationId: fx.orgA, ...SYNTHETIC_PERIOD }),
  ).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await t.run((ctx) => ctx.db.query("reportingPeriods").collect())).toEqual([]);
});

test("feil i revisjonsloggen ruller tilbake ny profilversjon", async () => {
  const t = setupTest();
  const fx = await twoTenants(t);
  const periodId = await t.run((ctx) =>
    ctx.db.insert("reportingPeriods", { organizationId: fx.orgA, ...SYNTHETIC_PERIOD, status: "open", createdAt: Date.now(), createdBy: fx.userA.userId }),
  );
  await expect(
    t.withIdentity(fx.userA.identity).mutation(api.organizations.businessProfile.save, {
      organizationId: fx.orgA,
      reportingPeriodId: periodId,
      answers: SYNTHETIC_PROFILE_ANSWERS,
      confirmed: true,
      expectedRevision: 0,
    }),
  ).rejects.toThrow(/Revisjonsloggen feilet/);
  expect(await t.run((ctx) => ctx.db.query("businessProfileRevisions").collect())).toEqual([]);
});
