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

describe("ESLint: Better Auth-komponenten", () => {
  const readUsers =
    'import { components } from "../_generated/api";\nexport const users = components;\n';

  test.each(["convex/organizations/probe.ts", "convex/lib/probe.ts", "convex/ops/probe.ts"])(
    "direkte bruk av komponenten avvises i %s",
    async (filePath) => {
      expect((await restrictedImportErrors(readUsers, filePath)).length).toBeGreaterThan(0);
    },
  );

  test("convex/auth.ts er eneste sted som kobler til komponenten", async () => {
    expect(
      await restrictedImportErrors('import { components } from "./_generated/api";\nexport const c = components;\n', "convex/auth.ts"),
    ).toHaveLength(0);
  });

  test("convex/auth.ts kan fortsatt ikke lage rå offentlige funksjoner", async () => {
    expect(
      (await restrictedImportErrors('import { query } from "./_generated/server";\nexport const q = query;\n', "convex/auth.ts")).length,
    ).toBeGreaterThan(0);
  });
});

describe("ESLint: Next.js er bare en klient av offentlige funksjoner", () => {
  test.each([
    ['import { internal } from "@/convex/_generated/api";', "internal"],
    ['import { components } from "@/convex/_generated/api";', "components"],
    ['import { query } from "@/convex/_generated/server";', "query"],
    ['import { getOwned } from "@/convex/lib/tenant";', "getOwned"],
    ['import { createWorkspace } from "@/convex/ops/organizations";', "createWorkspace"],
    ['import { createAuth } from "@/convex/auth";', "createAuth"],
    ['import { internal } from "../../convex/_generated/api";', "internal"],
  ])("%s avvises i src/", async (importLine, name) => {
    const errors = await restrictedImportErrors(`${importLine}\nexport const x = ${name};\n`, "src/app/probe.tsx");
    expect(errors.length).toBeGreaterThan(0);
  });

  test("offentlige funksjoner og typer er tillatt i src/", async () => {
    expect(
      await restrictedImportErrors(
        'import { api } from "@/convex/_generated/api";\nimport type { Id } from "@/convex/_generated/dataModel";\nexport const x: [typeof api, Id<"organizations"> | null] = [api, null];\n',
        "src/app/probe.tsx",
      ),
    ).toHaveLength(0);
  });
});
