import { readFileSync } from "node:fs";

/** Syntetisk Enhetsregister-svar for et org.nr., fra kontraktsfixturen (navn og næringskode kan overstyres). */
export function enhetBody(orgNumber: string, overrides: Record<string, unknown> = {}) {
  const base = JSON.parse(readFileSync("tests/fixtures/brreg/enhet-aksjeselskap.json", "utf8"));
  return JSON.stringify({ ...base, organisasjonsnummer: orgNumber, ...overrides });
}

export type FakeReply = { status: number; body?: string } | "hang" | "network";

/**
 * Falsk Brreg: svar per org.nr., i rekkefølge (det siste gjentas). Ukjent org.nr. gir 404.
 * `calls` teller hvert oppslag per org.nr., så tester kan se at retry stopper.
 */
export function fakeBrreg(replies: Record<string, FakeReply[]>) {
  const calls: Record<string, number> = {};
  const impl = (async (url: string, init?: RequestInit) => {
    const orgNumber = String(url).split("/").pop()!;
    const list = replies[orgNumber] ?? [{ status: 404 }];
    const reply = list[Math.min(calls[orgNumber] ?? 0, list.length - 1)];
    calls[orgNumber] = (calls[orgNumber] ?? 0) + 1;
    if (reply === "network") throw new TypeError("nettverksfeil");
    if (reply === "hang") {
      return await new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))),
      );
    }
    return new Response(reply.body ?? "", { status: reply.status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}
