/** Bakgrunnsjobber: idempotent opprettelse, forsøk med ventetid, sluttstatus, tillatte handlere og tenantvern. */
import type { WorkId } from "@convex-dev/workpool";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SYNTHETIC_JOB, SYNTHETIC_SUPPLIER_DOC } from "../helpers/public-functions";
import { expectAppError, setupTest, twoTenants } from "./setup";

const { enqueue } = api.jobs.mutations;
const { get, list } = api.jobs.queries;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  process.env.KJEDEKLAR_ENV = "test";
});

type Fixture = Awaited<ReturnType<typeof twoTenants>>;
async function start() {
  const t = setupTest();
  const fx = await twoTenants(t);
  /** En leverandør som referanse. `control` styrer testhandleren (se convex/jobs/testHandler.ts). */
  const supplier = (organizationId: Fixture["orgA"], control?: string) =>
    t.run((ctx) =>
      ctx.db.insert("suppliers", {
        organizationId,
        ...SYNTHETIC_SUPPLIER_DOC,
        ...(control && { externalKey: control }),
        createdAt: Date.now(),
        createdBy: "oppsett",
      }),
    );
  const a = t.withIdentity(fx.userA.identity);
  const b = t.withIdentity(fx.userB.identity);
  const submit = (inputRef: string, idempotencyKey = "nøkkel-1", type = "test.probe") =>
    a.mutation(enqueue, { organizationId: fx.orgA, type, inputRef, idempotencyKey });
  /** Kjører køen til den er tom, med falske klokker så ventetiden mellom forsøk ikke tar tid. */
  const drain = () => t.finishAllScheduledFunctions(vi.runAllTimers);
  const jobs = () => t.run((ctx) => ctx.db.query("jobs").collect());
  const audit = async () => (await t.run((ctx) => ctx.db.query("auditEvents").collect())).filter((e) => e.entityType === "job");
  return { t, fx, a, b, supplier, submit, drain, jobs, audit };
}

/** Én testjobb for en leverandør med gitt styring, kjørt til køen er tom. */
async function ran(control?: string) {
  const env = await start();
  const inputRef = await env.supplier(env.fx.orgA, control);
  const { jobId } = await env.submit(inputRef);
  await env.drain();
  const [job] = await env.jobs();
  return { ...env, inputRef, jobId, job };
}
const events = async (env: { audit: () => Promise<{ eventType: string }[]> }) => (await env.audit()).map((e) => e.eventType);

describe("opprettelse", () => {
  test("dobbel innsending gir én jobb, og den kjøres én gang", async () => {
    const env = await start();
    const inputRef = await env.supplier(env.fx.orgA);
    const first = await env.submit(inputRef);
    const second = await env.submit(inputRef);
    expect(first.created).toBe(true);
    expect(second).toEqual({ jobId: first.jobId, created: false });
    expect(await env.jobs()).toMatchObject([
      { _id: first.jobId, organizationId: env.fx.orgA, type: "test.probe", inputRef, idempotencyKey: "nøkkel-1", status: "queued", attempts: 0, maxAttempts: 3, createdBy: env.fx.userA.userId },
    ]);

    await env.drain();
    // Et tredje kall etter at jobben er ferdig gir fortsatt samme jobb, uten ny kjøring.
    expect(await env.submit(inputRef)).toEqual({ jobId: first.jobId, created: false });
    await env.drain();
    const [job] = await env.jobs();
    expect(job).toMatchObject({ status: "succeeded", attempts: 1, finishedAt: expect.any(Number) });
    expect(job).not.toHaveProperty("errorCode");
    expect((await env.audit()).map((e) => [e.eventType, e.entityId, e.actorType])).toEqual([
      ["job.created", first.jobId, "user"],
      ["job.succeeded", first.jobId, "system"],
    ]);
  });

  test("annen nøkkel og annen organisasjon gir egne jobber", async () => {
    const env = await start();
    const inputRef = await env.supplier(env.fx.orgA);
    const { jobId } = await env.submit(inputRef);
    const other = await env.submit(inputRef, "nøkkel-2");
    const inB = await env.b.mutation(enqueue, { organizationId: env.fx.orgB, type: "test.probe", inputRef: await env.supplier(env.fx.orgB), idempotencyKey: "nøkkel-1" });
    expect(new Set([jobId, other.jobId, inB.jobId]).size).toBe(3);
    expect([other.created, inB.created]).toEqual([true, true]);
    // Samme nøkkel for en annen leverandør er en forveksling, ikke samme jobb.
    await expectAppError(env.submit(await env.supplier(env.fx.orgA), "nøkkel-1"), "CONFLICT");
    expect(await env.jobs()).toHaveLength(3);
  });

  test("bare tillatte typer: ukjent type og innebygde navn avvises, og ingenting lagres", async () => {
    const env = await start();
    const inputRef = await env.supplier(env.fx.orgA);
    for (const type of ["ukjent", "", "constructor", "__proto__", "toString", "hasOwnProperty", "TEST.PROBE"]) {
      await expectAppError(env.submit(inputRef, "nøkkel-1", type), "INVALID_INPUT");
    }
    for (const key of ["", " mellomrom-først", "x".repeat(201)]) await expectAppError(env.submit(inputRef, key), "INVALID_INPUT");
    expect(await env.jobs()).toEqual([]);
    expect(await env.audit()).toEqual([]);
  });

  test("testtypen finnes ikke utenfor lokale testmiljø", async () => {
    const env = await start();
    const inputRef = await env.supplier(env.fx.orgA);
    for (const value of ["production", "development", ""]) {
      process.env.KJEDEKLAR_ENV = value;
      await expectAppError(env.submit(inputRef), "INVALID_INPUT");
    }
    expect(await env.jobs()).toEqual([]);
  });

  test("fremmed, ugyldig og feil type referanse avvises av getOwned", async () => {
    const env = await start();
    const foreign = await env.supplier(env.fx.orgB);
    for (const inputRef of [foreign, "ikke-en-id", env.fx.orgA]) await expectAppError(env.submit(inputRef), "NOT_FOUND");
    // B kan heller ikke opprette en jobb i A sin organisasjon.
    await expectAppError(env.b.mutation(enqueue, { organizationId: env.fx.orgA, type: "test.probe", inputRef: foreign, idempotencyKey: "k" }), "NOT_FOUND");
    expect(await env.jobs()).toEqual([]);
  });
});

describe("forsøk og sluttstatus", () => {
  test("feil prøves på nytt med ventetid og lykkes når feilen går over", async () => {
    const env = await start();
    const inputRef = await env.supplier(env.fx.orgA, "jobtest:fail-2");
    const before = Date.now();
    const { jobId } = await env.submit(inputRef);

    // Første forsøk feiler: jobben venter på neste forsøk, med feilkode og tidligste tidspunkt.
    // Klokken flyttes i små steg (under ventetiden på 100 ms) til køen har kjørt forsøket.
    for (let step = 0; step < 40 && (await env.jobs())[0].attempts === 0; step++) {
      await vi.advanceTimersByTimeAsync(1);
      await env.t.finishInProgressScheduledFunctions();
    }
    for (let step = 0; step < 40 && (await env.jobs())[0].status === "running"; step++) {
      await vi.advanceTimersByTimeAsync(1);
      await env.t.finishInProgressScheduledFunctions();
    }
    const waiting = (await env.jobs())[0];
    expect(waiting).toMatchObject({ status: "queued", attempts: 1, errorCode: "PROBE_FAILED" });
    expect(waiting.runAfter).toBeGreaterThanOrEqual(before + 100);
    expect(await events(env)).toEqual(["job.created"]);

    await env.drain();
    const [job] = await env.jobs();
    expect(job).toMatchObject({ _id: jobId, status: "succeeded", attempts: 3 });
    expect(job).not.toHaveProperty("errorCode");
    // Ventetiden øker: minst 100 ms før andre forsøk og 200 ms før tredje.
    expect(job.finishedAt! - before).toBeGreaterThanOrEqual(300);
    expect(await events(env)).toEqual(["job.created", "job.succeeded"]);
  });

  test("etter maks antall forsøk får jobben sluttstatus med feilkode", async () => {
    const { job, jobId, ...env } = await ran("jobtest:fail-always");
    expect(job).toMatchObject({ status: "failed", attempts: 3, maxAttempts: 3, errorCode: "PROBE_FAILED", finishedAt: expect.any(Number) });
    const log = await env.audit();
    expect(log.map((e) => e.eventType)).toEqual(["job.created", "job.failed"]);
    expect(log[1]).toMatchObject({ entityId: jobId, actorType: "system" });
    // Bare statusen endres i siste hendelse; forsøk og feilkode var alt registrert.
    expect(log[1].safeDiff).toEqual({ status: { from: "queued", to: "failed" } });
    // Køen er tom: ingen flere forsøk kommer.
    await env.drain();
    expect((await env.jobs())[0].attempts).toBe(3);
  });

  test("feil som ikke skal prøves på nytt gir sluttstatus etter ett forsøk", async () => {
    const { job, ...env } = await ran("jobtest:fatal");
    expect(job).toMatchObject({ status: "failed", attempts: 1, errorCode: "PROBE_FATAL" });
    expect(await events(env)).toEqual(["job.created", "job.failed"]);
  });

  test("uventet feil prøves på nytt og ender med en nøytral feilkode, uten feilmeldingen", async () => {
    const { job, ...env } = await ran("jobtest:crash");
    expect(job).toMatchObject({ status: "failed", attempts: 3, errorCode: "UNEXPECTED" });
    expect(JSON.stringify([job, await env.audit()])).not.toContain("Uventet feil i testhandleren");
  });

  test("resultat i feil form skrives ikke, og jobben feiler uten nye forsøk", async () => {
    const { job, ...env } = await ran("jobtest:bad-output");
    expect(job).toMatchObject({ status: "failed", attempts: 1, errorCode: "INVALID_OUTPUT" });
    expect(await events(env)).toEqual(["job.created", "job.failed"]);
  });
});

describe("idempotent resultat", () => {
  test("resultatet skrives én gang, også når handleren kjører eller svarer flere ganger", async () => {
    const { t, jobId, inputRef, ...env } = await ran();
    const snapshot = { jobs: await env.jobs(), audit: await env.audit() };
    // Samme forsøk leverer resultatet en gang til, og hele handleren kjøres på nytt.
    await t.mutation(internal.jobs.internal.complete, { jobId, output: { echoed: inputRef } });
    await t.action(internal.jobs.run.run, { jobId });
    await t.mutation(internal.jobs.internal.attemptFailed, { jobId, attempt: 1, errorCode: "FOR_SENT" });
    await t.mutation(internal.jobs.internal.completed, { workId: "x" as WorkId, context: { jobId }, result: { kind: "failed", error: "for sent" } });
    await env.drain();
    expect({ jobs: await env.jobs(), audit: await env.audit() }).toEqual(snapshot);
  });

  test("et resultat som kommer etter sluttstatus «failed», skrives ikke", async () => {
    const { t, jobId, inputRef, ...env } = await ran("jobtest:fail-always");
    await t.mutation(internal.jobs.internal.complete, { jobId, output: { echoed: inputRef } });
    expect((await env.jobs())[0]).toMatchObject({ status: "failed", errorCode: "PROBE_FAILED" });
    expect(await events(env)).toEqual(["job.created", "job.failed"]);
  });

  test("et gammelt forsøk som melder feil etter at et nyere har startet, overskriver ikke", async () => {
    const env = await start();
    const inputRef = await env.supplier(env.fx.orgA);
    const jobId = await env.t.run((ctx) =>
      ctx.db.insert("jobs", { organizationId: env.fx.orgA, inputRef, ...SYNTHETIC_JOB, status: "running", attempts: 2, createdBy: "oppsett" }),
    );
    await env.t.mutation(internal.jobs.internal.attemptFailed, { jobId, attempt: 1, errorCode: "GAMMELT" });
    expect((await env.jobs())[0]).toMatchObject({ status: "running", attempts: 2 });
    expect((await env.jobs())[0]).not.toHaveProperty("errorCode");
  });
});

describe("handler og tenant fra den lagrede jobben", () => {
  /** En jobb satt rett inn i tabellen, slik en eldre eller manipulert rad ville sett ut. */
  const stored = (env: Awaited<ReturnType<typeof start>>, fields: { type?: string; inputRef: string; organizationId?: Id<"organizations"> }) =>
    env.t.run((ctx) => ctx.db.insert("jobs", { organizationId: env.fx.orgA, ...SYNTHETIC_JOB, ...fields, createdBy: "oppsett" }));

  test("ukjent handler på en lagret jobb gir sluttstatus uten at noe kjøres", async () => {
    const env = await start();
    const jobId = await stored(env, { type: "slettet.type", inputRef: await env.supplier(env.fx.orgA) });
    await env.t.action(internal.jobs.run.run, { jobId });
    expect((await env.jobs())[0]).toMatchObject({ status: "failed", attempts: 0, errorCode: "UNKNOWN_HANDLER" });
    expect(await events(env)).toEqual(["job.failed"]);
  });

  test("referanse som er slettet eller tilhører en annen organisasjon, stopper jobben før arbeidet", async () => {
    const env = await start();
    const deleted = await env.supplier(env.fx.orgA);
    const first = await env.submit(deleted, "slettet");
    await env.t.run((ctx) => ctx.db.delete("suppliers", deleted));
    // Jobben sier organisasjon A, men referansen er B sin leverandør: tenant tas fra jobben, ikke fra referansen.
    const foreign = await stored(env, { inputRef: await env.supplier(env.fx.orgB, "jobtest:ok") });
    await env.t.action(internal.jobs.run.run, { jobId: foreign });
    await env.drain();
    expect((await env.jobs()).map((j) => [j._id, j.status, j.attempts, j.errorCode])).toEqual([
      [first.jobId, "failed", 0, "INPUT_NOT_FOUND"],
      [foreign, "failed", 0, "INPUT_NOT_FOUND"],
    ]);
    // Resultat for en jobb med fremmed referanse skrives heller ikke.
    const late = await stored(env, { inputRef: await env.supplier(env.fx.orgB) });
    await env.t.mutation(internal.jobs.internal.complete, { jobId: late, output: { echoed: "x" } });
    expect((await env.jobs()).find((j) => j._id === late)).toMatchObject({ status: "failed", errorCode: "INPUT_NOT_FOUND" });
  });

  test("forsøk utover maks starter ikke, selv om køen skulle kalle igjen", async () => {
    const env = await start();
    const jobId = await env.t.run(async (ctx) =>
      ctx.db.insert("jobs", { organizationId: env.fx.orgA, inputRef: await ctx.db.insert("suppliers", { organizationId: env.fx.orgA, ...SYNTHETIC_SUPPLIER_DOC, createdAt: 0, createdBy: "oppsett" }), ...SYNTHETIC_JOB, attempts: 3, createdBy: "oppsett" }),
    );
    await env.t.action(internal.jobs.run.run, { jobId });
    expect((await env.jobs())[0]).toMatchObject({ status: "failed", attempts: 3, errorCode: "MAX_ATTEMPTS" });
  });
});

describe("status", () => {
  test("leses bare av rett organisasjon", async () => {
    const { fx, a, b, jobId } = await ran();
    const own = await a.query(get, { organizationId: fx.orgA, jobId });
    expect(own).toMatchObject({ id: jobId, type: "test.probe", status: "succeeded", attempts: 1, maxAttempts: 3 });
    expect(Object.keys(own).sort()).toEqual(["attempts", "createdAt", "finishedAt", "id", "maxAttempts", "runAfter", "status", "type"]);
    expect((await a.query(list, { organizationId: fx.orgA })).map((j) => j.id)).toEqual([jobId]);
    for (const organizationId of [fx.orgB, fx.orgA]) await expectAppError(b.query(get, { organizationId, jobId }), "NOT_FOUND");
    for (const candidate of ["ikke-en-id", fx.orgA]) await expectAppError(a.query(get, { organizationId: fx.orgA, jobId: candidate }), "NOT_FOUND");
    expect(await b.query(list, { organizationId: fx.orgB })).toEqual([]);
    await expectAppError(b.query(list, { organizationId: fx.orgA }), "NOT_FOUND");
  });
});
