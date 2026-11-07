/**
 * Registertester for tenantgrensen. De feiler når noen legger til en offentlig
 * funksjon, HTTP-rute, tabell eller indeks uten å vurdere tenantvernet.
 */
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import http from "../../convex/http";
import { invitationRules, tenantRules, userRules } from "../../convex/lib/rls";
import schema from "../../convex/schema";
import { listConvexFunctions, publicFunctions } from "../helpers/convex-functions";
import {
  reviewedHttpRoutes,
  reviewedPublicFunctions,
  type PublicFunctionReview,
} from "../helpers/public-functions";
import {
  addMembership,
  createOrganization,
  createUser,
  expectAppError,
  setupTest,
  twoTenants,
  type TestConvex,
} from "./setup";

/**
 * Indekser på kundetabeller som ikke starter med `organizationId`. Hver unntak
 * må begrunnes og stå i docs/decisions/0002-tenant-boundary.md.
 */
const INDEX_EXCEPTIONS: Record<string, string> = {
  "memberships.by_userId":
    "Organisasjonsvelgeren og userQuery slår opp innlogget brukers egne medlemskap før en organisasjon er valgt. Leses bare med brukerens egen id fra sesjonen.",
  "invitations.by_tokenHash":
    "Invitasjonslenken identifiserer invitasjonen før organisasjonen er kjent. Slås bare opp med SHA-256 av et 256-bits token, i invitasjonsbyggeklossene.",
};

describe("offentlige funksjoner", () => {
  test("alle offentlige funksjoner er gjennomgått og registrert", () => {
    expect(publicFunctions().map((f) => f.path)).toEqual(
      Object.keys(reviewedPublicFunctions).sort(),
    );
  });

  test("registeret stemmer med funksjonstype", () => {
    for (const f of publicFunctions()) {
      expect(reviewedPublicFunctions[f.path].kind, f.path).toBe(f.kind);
    }
  });

  test("alle offentlige funksjoner har returvalidator", () => {
    for (const f of publicFunctions()) {
      expect(f.returns, `${f.path} mangler returns`).not.toBeNull();
    }
  });

  test("tenantfunksjoner tar organisasjonskandidat som streng, andre grenser tar ingen", () => {
    for (const f of publicFunctions()) {
      const args = f.args as { type: string; value: Record<string, { fieldType: { type: string } }> };
      const candidate = args.value?.organizationId?.fieldType.type;
      const token = args.value?.token?.fieldType.type;
      const boundary = reviewedPublicFunctions[f.path].boundary;
      if (boundary === "tenant") {
        expect(candidate, f.path).toBe("string");
      } else {
        expect(candidate, f.path).toBeUndefined();
      }
      // Token-funksjoner tar tokenet som eneste tilgangsbevis.
      const tokenBoundary = boundary === "invitation" || boundary === "verification";
      expect(token, f.path).toBe(tokenBoundary ? "string" : undefined);
    }
  });

  test("offentlige actions finnes bare bak token-byggeklossene", () => {
    // tenantAction finnes ikke ennå. En annen offentlig action må få egen byggekloss først.
    const actions = listConvexFunctions().filter((f) => f.kind === "action" && f.visibility === "public");
    for (const f of actions) {
      expect(["invitation", "verification"], f.path).toContain(reviewedPublicFunctions[f.path]?.boundary);
    }
  });
});

type Caller = Pick<TestConvex, "query" | "mutation" | "action">;

async function call(t: Caller, review: PublicFunctionReview, args: Record<string, unknown>) {
  if (review.kind === "query") return t.query(review.ref, args);
  if (review.kind === "mutation") return t.mutation(review.ref, args);
  return t.action(review.ref, args);
}

describe.each(
  Object.entries(reviewedPublicFunctions).filter(([, r]) => r.boundary === "tenant" || r.boundary === "user"),
)("%s avviser uautorisert bruk", (_path, review) => {
  test("uten sesjon", async () => {
    const t = setupTest();
    const { orgA } = await twoTenants(t);
    const args = review.boundary === "tenant" ? { ...review.sampleArgs, organizationId: orgA } : review.sampleArgs;
    await expectAppError(call(t, review, args), "UNAUTHENTICATED");
  });

  if (review.boundary !== "tenant") return;

  test("fremmed, inaktiv, ugyldig og annen tabell gir samme NOT_FOUND", async () => {
    const t = setupTest();
    const { userA, orgB, membershipA } = await twoTenants(t);
    const orgC = await createOrganization(t, "Org C");
    await addMembership(t, orgC, userA.userId, "inactive");
    const asA = t.withIdentity(userA.identity);
    const candidates = [orgB, orgC, "ikke-en-id", membershipA, userA.userId];
    const errors = [];
    for (const organizationId of candidates) {
      const promise = call(asA, review, { ...review.sampleArgs, organizationId });
      await expectAppError(promise, "NOT_FOUND");
      errors.push(await promise.catch((e: { data: unknown }) => e.data));
    }
    // Identisk innhold: avslaget røper ikke hvilken kandidat som ble prøvd.
    for (const data of errors) expect(data).toEqual(errors[0]);
  });

  test("egen organisasjon fungerer, så avslagene over ikke skyldes feil argumenter", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const asA = t.withIdentity(userA.identity);
    const extra = review.prepareOwn
      ? await review.prepareOwn((fn) => t.run((ctx) => fn(ctx.db)), orgA, userA.userId)
      : {};
    const args = { ...review.sampleArgs, ...extra, organizationId: orgA };
    await expect(call(asA, review, args)).resolves.toBeDefined();
  });
});

describe("HTTP-ruter", () => {
  test("bare gjennomgåtte ruter finnes", () => {
    const routes = http
      .getRoutes()
      .map(([path, method]) => `${method} ${path}`)
      .sort();
    expect(routes).toEqual([...reviewedHttpRoutes].sort());
  });
});

describe("skjema og RLS-regler", () => {
  const tableNames = Object.keys(schema.tables).sort();

  test("hver tabell har eksplisitt regel for lesing, endring og opprettelse", () => {
    const scope = { organizationId: "x" as never };
    const invitationScope = { invitationId: "i" as never, organizationId: "x" as never, userId: "u" };
    for (const rules of [tenantRules(scope), userRules("u", new Set()), invitationRules(invitationScope)]) {
      expect(Object.keys(rules).sort()).toEqual(tableNames);
      for (const [table, rule] of Object.entries(rules)) {
        for (const op of ["read", "modify", "insert"] as const) {
          expect(typeof rule[op], `${table}.${op}`).toBe("function");
        }
      }
    }
  });

  test("tenantfunksjoner kan ikke opprette organisasjoner, endre fremmed organisasjon eller medlemskap", async () => {
    const t = setupTest();
    const { orgA, membershipA } = await twoTenants(t);
    const rules = tenantRules({ organizationId: orgA });
    await t.run(async (ctx) => {
      const org = (await ctx.db.get("organizations", orgA))!;
      const membership = (await ctx.db.get("memberships", membershipA))!;
      const empty = {} as Record<string, never>;
      // Egen organisasjon kan endres (navn); andres kan ikke.
      expect(await rules.organizations.modify(empty, org)).toBe(true);
      const other = tenantRules({ organizationId: "annen" as never });
      expect(await other.organizations.modify(empty, org)).toBe(false);
      expect(await rules.organizations.insert(empty, org)).toBe(false);
      expect(await rules.memberships.modify(empty, membership)).toBe(false);
      expect(await rules.memberships.insert(empty, membership)).toBe(false);
    });
  });

  test("kundetabeller har påkrevd organizationId, og indekser starter med den", () => {
    for (const [name, table] of Object.entries(schema.tables)) {
      if (name === "organizations") continue; // tenantroten
      const field = (table.validator.fields as Record<string, { kind: string; tableName?: string; isOptional: string }>)
        .organizationId;
      expect(field, `${name}.organizationId`).toMatchObject({
        kind: "id",
        tableName: "organizations",
        isOptional: "required",
      });
      for (const index of table[" indexes"]()) {
        const key = `${name}.${index.indexDescriptor}`;
        if (key in INDEX_EXCEPTIONS) continue;
        expect(index.fields[0], key).toBe("organizationId");
      }
    }
  });

  test("indeksunntakene finnes fortsatt (ellers skal de fjernes fra listen)", () => {
    const existing = new Set(
      Object.entries(schema.tables).flatMap(([name, table]) =>
        table[" indexes"]().map((i) => `${name}.${i.indexDescriptor}`),
      ),
    );
    for (const key of Object.keys(INDEX_EXCEPTIONS)) expect(existing.has(key), key).toBe(true);
  });
});

describe("brukerkontekst uten valgt organisasjon", () => {
  test("ser ikke andres medlemskap eller organisasjoner", async () => {
    const t = setupTest();
    const { userA, orgA } = await twoTenants(t);
    const mine = await t.withIdentity(userA.identity).query(api.organizations.queries.listMine, {});
    expect(mine).toEqual([{ id: orgA, name: "Org A" }]);
  });

  test("en bruker uten medlemskap ser ingenting", async () => {
    const t = setupTest();
    await twoTenants(t);
    const outsider = await createUser(t, "utenfor@ingen.example");
    const mine = await t.withIdentity(outsider.identity).query(api.organizations.queries.listMine, {});
    expect(mine).toEqual([]);
  });
});
