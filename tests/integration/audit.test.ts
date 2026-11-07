/**
 * Revisjonslogg mot lokal Convex-backend: atomisk med endringen, tenantisolert
 * og bare lesbar fra appen.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { errorOf, runInternal, setupTwoTenants, type TwoTenants } from "../helpers/local-backend";
import { publicFunctions } from "../helpers/convex-functions";

const list = api.audit.queries.list;
const page = { paginationOpts: { numItems: 50, cursor: null } };

describe("revisjonslogg mot lokal backend", () => {
  let env: TwoTenants;
  beforeAll(async () => {
    env = await setupTwoTenants();
  });

  test("endring og logg lagres sammen, med trygg diff", async () => {
    const { fx, a } = env;
    await a.mutation(api.organizations.mutations.rename, { organizationId: fx.orgA, name: `Omdøpt ${fx.orgA}` });
    const events = await a.query(list, { organizationId: fx.orgA, entityType: "organization", ...page });
    const renamed = events.page.find((e) => e.eventType === "organization.renamed")!;
    expect(renamed.entityId).toBe(fx.orgA);
    expect(Object.keys(renamed.safeDiff)).toEqual(["name"]);
    expect(renamed.safeDiff.name.to).toBe(`Omdøpt ${fx.orgA}`);
    expect(renamed.actor).toBe("Test A");
  });

  test("kastet feil etter audit-skriving ruller tilbake både endring og logg", async () => {
    const { fx, a } = env;
    const name = () => a.query(api.organizations.queries.current, { organizationId: fx.orgA }).then((o) => o.name);
    const renames = () =>
      a.query(list, { organizationId: fx.orgA, entityType: "organization", ...page }).then((r) => r.page.length);

    // Kontroll: uten feil lagres både navn og logglinje.
    const before = await renames();
    runInternal("ops/testing:auditRollbackProbe", { organizationId: fx.orgA, name: "Probe OK", fail: false });
    expect(await name()).toBe("Probe OK");
    expect(await renames()).toBe(before + 1);

    // Med feil etter audit-skrivingen lagres ingen av dem. Backenden skjuler
    // meldingen, men viser at det var en ConvexError (ikke miljøsperren).
    expect(() =>
      runInternal("ops/testing:auditRollbackProbe", { organizationId: fx.orgA, name: "Probe FEIL", fail: true }),
    ).toThrow(/ConvexError/);
    expect(await name()).toBe("Probe OK");
    expect(await renames()).toBe(before + 1);
  });

  test("fremmed kunde kan ikke lese loggen", async () => {
    const { fx, b } = env;
    expect((await errorOf(b.query(list, { organizationId: fx.orgA, ...page }))).code).toBe("NOT_FOUND");
    const own = await b.query(list, { organizationId: fx.orgB, ...page });
    expect(own.page.length).toBeGreaterThan(0); // fixturen logget opprettelse og medlemskap
    expect(JSON.stringify(own.page)).not.toContain(fx.orgA);
  });

  test("ingen offentlig funksjon kan endre loggen", () => {
    const writers = publicFunctions().filter((f) => f.path.startsWith("audit/") && f.kind !== "query");
    expect(writers).toEqual([]);
  });
});
