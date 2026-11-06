import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

/** Negativ test: ESLint-regelen skal stoppe rå offentlige Convex-funksjoner. */
const eslint = new ESLint({ cwd: process.cwd() });

async function restrictedImportErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports");
}

const leak = `export const leak = BUILDER({ args: {}, handler: async (ctx: any) => ctx.db.query("memberships").collect() });`;

describe("ESLint: tenantvern", () => {
  test.each([
    ['import { query } from "../_generated/server";', "query"],
    ['import { mutation } from "./_generated/server";', "mutation"],
    ['import { action } from "../_generated/server";', "action"],
    ['import { queryGeneric } from "convex/server";', "queryGeneric"],
    ['import { mutationGeneric } from "convex/server";', "mutationGeneric"],
    ['import { actionGeneric } from "convex/server";', "actionGeneric"],
    ['import { httpActionGeneric } from "convex/server";', "httpActionGeneric"],
  ])("%s avvises i convex/", async (importLine, builder) => {
    const errors = await restrictedImportErrors(
      `${importLine}\n${leak.replace("BUILDER", builder)}\n`,
      "convex/organizations/probe.ts",
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  test("interne byggere og convex/lib er tillatt", async () => {
    expect(
      await restrictedImportErrors(
        'import { internalQuery } from "../_generated/server";\nexport const ok = internalQuery({ args: {}, handler: async () => null });\n',
        "convex/ops/probe.ts",
      ),
    ).toHaveLength(0);
    expect(
      await restrictedImportErrors(
        'import { query } from "../_generated/server";\nexport const builder = query;\n',
        "convex/lib/probe.ts",
      ),
    ).toHaveLength(0);
  });
});
