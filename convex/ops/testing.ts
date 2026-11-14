import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";
import { writeAudit } from "../lib/audit";
import { assertLocalEnv } from "./guard";
import { ensurePasswordUser } from "./users";

/**
 * Testfixture for to tenants. Finnes bare på test-backend (KJEDEKLAR_ENV=test og
 * lokal URL). Unik suffix per testkjøring gjør reset unødvendig.
 *
 * - Bruker A: aktivt medlem av org A, inaktivt medlem av org C.
 * - Bruker B: aktivt medlem av org B og org C.
 */
export const createTenantFixture = internalAction({
  args: { suffix: v.string(), password: v.string() },
  returns: v.object({
    userA: v.object({ email: v.string(), userId: v.string() }),
    userB: v.object({ email: v.string(), userId: v.string() }),
    orgA: v.id("organizations"),
    orgB: v.id("organizations"),
    orgC: v.id("organizations"),
  }),
  handler: async (ctx, { suffix, password }) => {
    assertLocalEnv(["test"]);
    const emailA = `a-${suffix}@tenant-a.example`;
    const emailB = `b-${suffix}@tenant-b.example`;
    const userA = await ensurePasswordUser(ctx, { email: emailA, name: "Test A", password });
    const userB = await ensurePasswordUser(ctx, { email: emailB, name: "Test B", password });
    const { createWorkspace, setMembership } = internal.ops.organizations;
    const orgA: Id<"organizations"> = await ctx.runMutation(createWorkspace, {
      name: `Org A ${suffix}`, country: "NO", userId: userA,
    });
    const orgB: Id<"organizations"> = await ctx.runMutation(createWorkspace, {
      name: `Org B ${suffix}`, country: "NO", userId: userB,
    });
    // Org C eies av B; A får et inaktivt medlemskap der.
    const orgC: Id<"organizations"> = await ctx.runMutation(createWorkspace, {
      name: `Org C ${suffix}`, country: "NO", userId: userB,
    });
    await ctx.runMutation(setMembership, {
      organizationId: orgC, userId: userA, status: "inactive",
    });
    return {
      userA: { email: emailA, userId: userA },
      userB: { email: emailB, userId: userB },
      orgA, orgB, orgC,
    };
  },
});

/** Test: setter en invitasjon som utløpt. Bare på test-backend. */
export const expireInvitation = internalMutation({
  args: { invitationId: v.id("invitations") },
  returns: v.null(),
  handler: async (ctx, { invitationId }) => {
    assertLocalEnv(["test"]);
    await ctx.db.patch("invitations", invitationId, { expiresAt: Date.now() - 1000 });
    return null;
  },
});

/** Test: bruker med ubekreftet e-post (for å prøve Better Auths verifisering). */
export const createUnverifiedUser = internalAction({
  args: { email: v.string(), password: v.string() },
  returns: v.string(),
  handler: async (ctx, { email, password }) => {
    assertLocalEnv(["test"]);
    return await ensurePasswordUser(ctx, { email, name: "Ubekreftet", password, emailVerified: false });
  },
});

/**
 * Test: endrer navn og skriver audit. Med `fail: true` kastes en feil etter
 * audit-skrivingen i samme mutasjon. Uten feil lagres begge (beviser at koden
 * når fram til skrivingen); med feil lagres ingen av dem (rollback).
 */
export const auditRollbackProbe = internalMutation({
  args: { organizationId: v.id("organizations"), name: v.string(), fail: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { organizationId, name, fail }) => {
    assertLocalEnv(["test"]);
    const before = await ctx.db.get("organizations", organizationId);
    await ctx.db.patch("organizations", organizationId, { name });
    await writeAudit(ctx, {
      organizationId,
      actor: { type: "system" },
      eventType: "organization.renamed",
      entityType: "organization",
      entityId: organizationId,
      before,
      after: { ...before, name },
    });
    if (fail) throw new ConvexError({ code: "AUDIT_ROLLBACK_PROBE", message: "Bevisst feil etter audit-skriving" });
    return null;
  },
});

/**
 * Test: setter navnet på en importoppføring. Med tomt navn feiler oppføringen
 * når importen gjennomføres, så testen kan vise at stykket rulles tilbake og at
 * importen står som ikke fullført. Bare på test-backenden.
 */
export const setImportRowName = internalMutation({
  args: { rowId: v.id("importRows"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, { rowId, name }) => {
    assertLocalEnv(["test"]);
    const row = await ctx.db.get("importRows", rowId);
    if (!row) throw new ConvexError({ code: "NOT_FOUND", message: "Ukjent oppføring" });
    await ctx.db.patch("importRows", rowId, { values: { ...row.values, name } });
    return null;
  },
});

/**
 * Test: setter inn syntetiske leverandører med innkjøpsdata for en periode, til
 * belastningstest av screeningvurdering. Bare på test-backenden.
 */
export const seedSuppliersForRisk = internalMutation({
  args: { organizationId: v.id("organizations"), reportingPeriodId: v.id("reportingPeriods"), from: v.number(), count: v.number() },
  returns: v.null(),
  handler: async (ctx, { organizationId, reportingPeriodId, from, count }) => {
    assertLocalEnv(["test"]);
    const countrySets = [["XA"], ["XB", "XC"], ["XC"], [], ["XA", "XB", "XC"]];
    const codes = ["00.100", "00.150", "00.200", "99.999"];
    for (let i = from; i < from + count; i++) {
      const name = `Last ${String(i).padStart(5, "0")} AS`;
      const supplierId = await ctx.db.insert("suppliers", {
        organizationId, name, nameKey: name.toLowerCase(), status: "active", rowVersion: 1, createdAt: Date.now(), createdBy: "belastningstest",
        industryCodeSystem: "SN2007", industryCode: codes[i % codes.length],
      });
      await ctx.db.insert("supplierPeriods", {
        organizationId, supplierId, reportingPeriodId, productionCountries: countrySets[i % countrySets.length], upstreamUnknown: i % 2 === 0,
        purchaseCategory: i % 3 === 0 ? "demo-produkt-a" : "annet", spendOre: BigInt(i) * 100n, rowVersion: 1, updatedAt: Date.now(), updatedBy: "belastningstest",
      });
    }
    return null;
  },
});
