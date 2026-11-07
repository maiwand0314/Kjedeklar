import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { smtpConfig } from "../../convex/email/config";
import { seal, sha256Hex, unseal } from "../../convex/email/seal";
import { invitationEmail, resetPasswordEmail } from "../../convex/email/templates";
import {
  CLIENT_IP_HEADER,
  PROXY_SECRET_HEADER,
  sanitizeProxyHeaders,
} from "../../src/domain/auth-proxy";
import { safeNextPath } from "../../src/lib/safe-redirect";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("klarert klient-IP fra Next.js-proxyen", () => {
  const secret = "s".repeat(40);
  const headers = (extra: Record<string, string>) =>
    new Headers({ [CLIENT_IP_HEADER]: "203.0.113.9", ...extra });

  test("riktig hemmelighet beholder IP, men fjerner hemmeligheten", () => {
    const result = sanitizeProxyHeaders(headers({ [PROXY_SECRET_HEADER]: secret }), secret);
    expect(result.get(CLIENT_IP_HEADER)).toBe("203.0.113.9");
    expect(result.has(PROXY_SECRET_HEADER)).toBe(false);
  });

  test.each([
    ["mangler", {}],
    ["feil", { [PROXY_SECRET_HEADER]: "x".repeat(40) }],
    ["for kort prefiks", { [PROXY_SECRET_HEADER]: secret.slice(0, 39) }],
  ])("hemmelighet %s: IP-en forkastes", (_label, extra) => {
    expect(sanitizeProxyHeaders(headers(extra), secret).has(CLIENT_IP_HEADER)).toBe(false);
  });

  test("uten konfigurert eller for kort hemmelighet godtas ingen IP", () => {
    expect(sanitizeProxyHeaders(headers({ [PROXY_SECRET_HEADER]: "" }), undefined).has(CLIENT_IP_HEADER)).toBe(false);
    expect(sanitizeProxyHeaders(headers({ [PROXY_SECRET_HEADER]: "kort" }), "kort").has(CLIENT_IP_HEADER)).toBe(false);
  });
});

describe("forsegling av e-postlenker", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "test-hemmelighet-som-er-lang-nok-123";
  });

  test("tur–retur og ingen klartekst i forseglet verdi", async () => {
    const url = "http://localhost:3000/api/auth/reset-password/hemmelig-token-123";
    const sealed = await seal(url);
    expect(sealed).not.toContain("hemmelig-token-123");
    expect(await unseal(sealed)).toBe(url);
  });

  test("endret chiffertekst eller annen nøkkel avvises", async () => {
    const sealed = await seal("http://x.example/token");
    const [iv, ct] = sealed.split(".");
    const tampered = `${iv}.${ct.slice(0, -2)}${ct.endsWith("A") ? "B" : "A"}A`;
    await expect(unseal(tampered)).rejects.toThrow();
    process.env.BETTER_AUTH_SECRET = "en-helt-annen-hemmelighet-som-er-lang";
    await expect(unseal(sealed)).rejects.toThrow();
  });

  test("sha256Hex er stabil", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("e-postmaler", () => {
  test("invitasjon er norsk, har lenke og utløpstid i Oslo-tid", () => {
    const mail = invitationEmail({
      organizationName: "Nordlys AS",
      url: "http://localhost:3000/invitasjon/abc",
      expiresAt: Date.UTC(2026, 10, 14, 11, 0),
    });
    expect(mail.subject).toBe("Invitasjon til Nordlys AS i Kjedeklar");
    expect(mail.text).toContain("http://localhost:3000/invitasjon/abc");
    expect(mail.text).toContain("12:00");
  });

  test("reset sier at alle sesjoner logges ut", () => {
    expect(resetPasswordEmail("http://x.example/r").text).toContain("logget ut overalt");
  });
});

describe("SMTP-vern", () => {
  test("sender bare til Mailpit i lokale miljøer", () => {
    process.env.KJEDEKLAR_ENV = "development";
    process.env.SMTP_HOST = "mailpit";
    expect(smtpConfig().host).toBe("mailpit");
    process.env.SMTP_HOST = "smtp.ekte-leverandor.example";
    expect(() => smtpConfig()).toThrow(/Mailpit/);
  });

  test("nekter utenfor lokale miljøer", () => {
    process.env.KJEDEKLAR_ENV = "production";
    process.env.SMTP_HOST = "mailpit";
    expect(() => smtpConfig()).toThrow(/ikke aktivert/);
  });
});

describe("omdirigering etter innlogging", () => {
  test.each([
    ["/", "/"],
    ["/o/j97abc123", "/o/j97abc123"],
    ["/invitasjon", "/invitasjon"],
    [`/invitasjon/${"a".repeat(43)}`, "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/o/../../admin", "/"],
    [undefined, "/"],
    [["/o/x"], "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
