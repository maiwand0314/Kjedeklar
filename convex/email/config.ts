/**
 * SMTP-konfigurasjon. I oppgave 03 er bare Mailpit tillatt: utenfor lokale
 * miljøer (KJEDEKLAR_ENV=development/test) nekter vi å sende, til en godkjent
 * EU/EØS-leverandør er satt opp i oppgave 25.
 */
const LOCAL_SMTP_HOSTS = new Set(["mailpit", "localhost", "127.0.0.1", "host.docker.internal"]);

export type SmtpConfig = { host: string; port: number; from: string };

export function smtpConfig(): SmtpConfig {
  const env = process.env.KJEDEKLAR_ENV;
  if (env !== "development" && env !== "test") {
    throw new Error("E-postleverandør er ikke aktivert for dette miljøet (se oppgave 25).");
  }
  const host = process.env.SMTP_HOST ?? "";
  if (!LOCAL_SMTP_HOSTS.has(host)) {
    throw new Error("Lokalt miljø kan bare sende til Mailpit.");
  }
  const port = Number(process.env.SMTP_PORT ?? "1025");
  const from = process.env.EMAIL_FROM ?? "Kjedeklar <ikke-svar@kjedeklar.localhost>";
  return { host, port, from };
}

export function siteUrl(): string {
  const url = process.env.SITE_URL;
  if (!url) throw new Error("SITE_URL mangler.");
  return url.replace(/\/+$/, "");
}
