/**
 * Bakgrunnsjobber mot lokal backend med ekte innloggede brukere: køen (workpool)
 * kjører jobbene, forsøk og sluttstatus virker med korte testgrenser, og status
 * er isolert mellom organisasjoner. At de interne jobbfunksjonene ikke kan
 * kalles fra en klient, dekkes av tenancy.test.ts (én probe per intern funksjon).
 */
import { beforeAll, describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { clientWithToken, errorOf, setupTwoTenants, type TwoTenants } from "../helpers/local-backend";

const { enqueue } = api.jobs.mutations;
const { get, list } = api.jobs.queries;
const createSupplier = api.suppliers.mutations.create;

describe("bakgrunnsjobber mot lokal backend", () => {
  let env: TwoTenants;
  let twoTabs: TwoTenants["a"][];
  beforeAll(async () => {
    env = await setupTwoTenants();
    twoTabs = [env.a, clientWithToken(env.sessionA.token)];
  });

  const org = () => ({ organizationId: env.fx.orgA });
  /** En leverandør som referanse. `control` styrer testhandleren (se convex/jobs/testHandler.ts). */
  const supplier = (name: string, control?: string) => env.a.mutation(createSupplier, { ...org(), name, ...(control && { externalKey: control }) });
  /** Venter til jobben har sluttstatus. Testtypen har korte grenser, så dette tar under et par sekunder. */
  async function finished(jobId: string) {
    for (let i = 0; i < 150; i++) {
      const job = await env.a.query(get, { ...org(), jobId });
      if (job.status === "succeeded" || job.status === "failed") return job;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Jobben fikk ikke sluttstatus innen 15 sekunder");
  }

  test("dobbel innsending fra to faner gir én jobb, som kjøres én gang og logges", async () => {
    const inputRef = await supplier("Jobb OK AS");
    const args = { ...org(), type: "test.probe", inputRef, idempotencyKey: "dobbel" };
    const [first, second] = await Promise.all(twoTabs.map((tab) => tab.mutation(enqueue, args)));
    expect(second.jobId).toBe(first.jobId);
    expect([first.created, second.created].sort()).toEqual([false, true]);

    const job = await finished(first.jobId);
    expect(job).toMatchObject({ type: "test.probe", status: "succeeded", attempts: 1, maxAttempts: 3 });
    expect(job.errorCode).toBeUndefined();
    // Et nytt kall etterpå gir samme jobb og ingen ny kjøring. Samme nøkkel for en annen leverandør avvises.
    expect(await env.a.mutation(enqueue, args)).toEqual({ jobId: first.jobId, created: false });
    expect((await errorOf(env.a.mutation(enqueue, { ...args, inputRef: await supplier("Jobb Annen AS") }))).code).toBe("CONFLICT");
    expect((await env.a.query(list, org())).filter((j) => j.id === first.jobId)).toHaveLength(1);

    const log = await env.a.query(api.audit.queries.list, { ...org(), entityType: "job", paginationOpts: { numItems: 20, cursor: null } });
    expect(log.page.filter((e) => e.entityId === first.jobId).map((e) => [e.eventType, e.actor === "Kjedeklar (system)"])).toEqual([
      ["job.succeeded", true],
      ["job.created", false],
    ]);
  });

  test("feil prøves på nytt med ventetid: forbigående feil lykkes, varig feil får sluttstatus etter maks forsøk", async () => {
    const [transient, permanent, fatal] = await Promise.all([
      supplier("Jobb Feiler Én Gang AS", "jobtest:fail-1"),
      supplier("Jobb Feiler Alltid AS", "jobtest:fail-always"),
      supplier("Jobb Fatal AS", "jobtest:fatal"),
    ]);
    const started = Date.now();
    const ids = await Promise.all(
      [transient, permanent, fatal].map(
        async (inputRef, i) => (await env.a.mutation(enqueue, { ...org(), type: "test.probe", inputRef, idempotencyKey: `forsøk-${i}` })).jobId,
      ),
    );
    const [recovered, exhausted, stopped] = await Promise.all(ids.map(finished));
    expect(recovered).toMatchObject({ status: "succeeded", attempts: 2 });
    expect(recovered.errorCode).toBeUndefined();
    expect(exhausted).toMatchObject({ status: "failed", attempts: 3, maxAttempts: 3, errorCode: "PROBE_FAILED" });
    expect(stopped).toMatchObject({ status: "failed", attempts: 1, errorCode: "PROBE_FATAL" });
    // To ventetider (rundt 100 og 200 ms) før tredje forsøk.
    expect(exhausted.finishedAt! - started).toBeGreaterThanOrEqual(250);
    // Sluttstatusen står: ingen flere forsøk kommer.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(await env.a.query(get, { ...org(), jobId: ids[1] })).toEqual(exhausted);
  });

  test("status er isolert mellom organisasjoner, og fremmed referanse eller ukjent type gir ingen jobb", async () => {
    const { fx, a, b, anonymous } = env;
    const inputRef = await supplier("Jobb Isolert AS");
    const { jobId } = await a.mutation(enqueue, { ...org(), type: "test.probe", inputRef, idempotencyKey: "isolert" });
    await finished(jobId);
    const before = await a.query(list, org());

    for (const organizationId of [fx.orgB, fx.orgA]) {
      expect(await errorOf(b.query(get, { organizationId, jobId }))).toMatchObject({ code: "NOT_FOUND", data: { code: "NOT_FOUND", message: "Ikke funnet." } });
      // B kan ikke opprette en jobb for A sin leverandør, verken i egen eller i A sin organisasjon.
      expect((await errorOf(b.mutation(enqueue, { organizationId, type: "test.probe", inputRef, idempotencyKey: "kapret" }))).code).toBe("NOT_FOUND");
    }
    expect((await errorOf(b.query(list, { organizationId: fx.orgA }))).code).toBe("NOT_FOUND");
    expect(await b.query(list, { organizationId: fx.orgB })).toEqual([]);

    for (const type of ["ukjent", "constructor", "jobs/run:run"]) {
      expect((await errorOf(a.mutation(enqueue, { ...org(), type, inputRef, idempotencyKey: "type" }))).code).toBe("INVALID_INPUT");
    }
    for (const call of [() => anonymous.query(get, { ...org(), jobId }), () => anonymous.query(list, org()), () => anonymous.mutation(enqueue, { ...org(), type: "test.probe", inputRef, idempotencyKey: "anonym" })]) {
      expect((await errorOf(call())).code).toBe("UNAUTHENTICATED");
    }
    expect(await a.query(list, org())).toEqual(before);
  });
});
