/**
 * Bekreftelse av registeropplysninger mot lokal backend. Forhåndsvisningen
 * settes inn med admin key (som lookup-actionen gjør etter et Brreg-oppslag),
 * så testen ikke er avhengig av det ekte registeret.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { errorOf, runInternal, setupTwoTenants, type TwoTenants } from "../helpers/local-backend";
import { SYNTHETIC_REGISTRY_PROFILE } from "../helpers/public-functions";

const { confirm, current } = api.organizations.registry;

function storePreview(env: TwoTenants, organizationId: string, orgNumber = "920000002"): string {
  return runInternal<string>("organizations/registryInternal:storePreview", {
    organizationId,
    fetchedBy: env.fx.userA.userId,
    fetchedAt: Date.now(),
    profile: { ...SYNTHETIC_REGISTRY_PROFILE, orgNumber },
    payloadHash: "0".repeat(64),
    mappingVersion: "brreg-enhet-v1",
  });
}

describe("registeropplysninger mot lokal backend", () => {
  let env: TwoTenants;
  beforeAll(async () => {
    env = await setupTwoTenants();
  });

  test("bekreftet lagring og revisjonslogg; visningsnavnet beholdes", async () => {
    const { fx, a } = env;
    const snapshotId = storePreview(env, fx.orgA);
    await a.mutation(confirm, { organizationId: fx.orgA, snapshotId, expectedCurrentSnapshotId: null, useRegistryName: false });
    const after = await a.query(current, { organizationId: fx.orgA });
    expect(after).toMatchObject({ snapshotId, profile: { orgNumber: "920000002" } });
    expect(after.name).toMatch(/^Org A /);
    const log = await a.query(api.audit.queries.list, {
      organizationId: fx.orgA,
      entityType: "organization",
      paginationOpts: { numItems: 10, cursor: null },
    });
    const event = log.page.find((e) => e.eventType === "organization.registry_confirmed")!;
    expect(event.safeDiff).toMatchObject({ orgNumber: { to: "920000002" }, legalForm: { to: "AS" } });
  });

  test("utdatert visning overskriver ikke tidligere bekreftede verdier", async () => {
    const { fx, a } = env;
    const confirmedBefore = (await a.query(current, { organizationId: fx.orgA })).snapshotId;
    const newer = storePreview(env, fx.orgA, "931234560");
    const r = await errorOf(
      a.mutation(confirm, { organizationId: fx.orgA, snapshotId: newer, expectedCurrentSnapshotId: null, useRegistryName: false }),
    );
    expect(r.code).toBe("CONFLICT");
    expect((await a.query(current, { organizationId: fx.orgA })).snapshotId).toBe(confirmedBefore);
  });

  test("fremmed kunde kan ikke bekrefte eller lese en annen organisasjons opplysninger", async () => {
    const { fx, a, b } = env;
    const snapshotOfA = storePreview(env, fx.orgA);
    const attempts = [
      () => b.mutation(confirm, { organizationId: fx.orgB, snapshotId: snapshotOfA, expectedCurrentSnapshotId: null, useRegistryName: true }),
      () => b.mutation(confirm, { organizationId: fx.orgA, snapshotId: snapshotOfA, expectedCurrentSnapshotId: null, useRegistryName: true }),
      () => b.query(current, { organizationId: fx.orgA }),
    ];
    for (const attempt of attempts) expect((await errorOf(attempt())).code).toBe("NOT_FOUND");
    expect((await b.query(current, { organizationId: fx.orgB })).snapshotId).toBeNull();
    expect((await a.query(current, { organizationId: fx.orgA })).name).toMatch(/^Org A /);
  });

  test("lookup krever innlogget medlem før noe nettverkskall", async () => {
    const { fx, b, anonymous } = env;
    const args = { organizationId: fx.orgA, orgNumber: "920000002" };
    expect((await errorOf(anonymous.action(api.organizations.registry.lookup, args))).code).toBe("UNAUTHENTICATED");
    expect((await errorOf(b.action(api.organizations.registry.lookup, args))).code).toBe("NOT_FOUND");
  });
});
