/// <reference types="vite/client" />
import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import { components } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";

export const modules = import.meta.glob([
  "../../convex/**/*.ts",
  "../../convex/**/*.js",
  "!../../convex/**/*.d.ts",
]);

export function setupTest() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t, "betterAuth");
  return t;
}

export type TestConvex = ReturnType<typeof setupTest>;

/** Oppretter en Better Auth-bruker med sesjon direkte i komponenten. */
export async function createUser(
  t: TestConvex,
  email: string,
  opts: { sessionExpiresInMs?: number } = {},
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const user = (await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: { name: email, email, emailVerified: true, createdAt: now, updatedAt: now },
      },
    })) as { _id: string };
    const session = (await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: {
          userId: user._id,
          token: `token-${email}`,
          expiresAt: now + (opts.sessionExpiresInMs ?? 3_600_000),
          createdAt: now,
          updatedAt: now,
        },
      },
    })) as { _id: string };
    return {
      userId: user._id,
      identity: { subject: user._id, sessionId: session._id },
    };
  });
}

export async function createOrganization(
  t: TestConvex,
  name: string,
  status: "active" | "inactive" = "active",
): Promise<Id<"organizations">> {
  return await t.run((ctx) =>
    ctx.db.insert("organizations", { name, country: "NO", status }),
  );
}

export async function addMembership(
  t: TestConvex,
  organizationId: Id<"organizations">,
  userId: string,
  status: "active" | "inactive" = "active",
): Promise<Id<"memberships">> {
  return await t.run((ctx) =>
    ctx.db.insert("memberships", { organizationId, userId, role: "admin", status }),
  );
}

/** To tenants: A og B, hver med sin admin. */
export async function twoTenants(t: TestConvex) {
  const userA = await createUser(t, "a@tenant-a.example");
  const userB = await createUser(t, "b@tenant-b.example");
  const orgA = await createOrganization(t, "Org A");
  const orgB = await createOrganization(t, "Org B");
  const membershipA = await addMembership(t, orgA, userA.userId);
  const membershipB = await addMembership(t, orgB, userB.userId);
  return { userA, userB, orgA, orgB, membershipA, membershipB };
}

export async function expectAppError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (error) {
    const data = (error as { data?: { code?: string } }).data;
    if (data?.code !== code) {
      throw new Error(`Forventet ${code}, fikk ${JSON.stringify(data ?? String(error))}`);
    }
    return;
  }
  throw new Error(`Forventet ${code}, men kallet lyktes`);
}
