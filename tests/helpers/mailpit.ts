/**
 * Leser e-post fra lokal Mailpit (docker compose: mailpit). Bare syntetiske
 * adresser; ingen ekte mottakere.
 */
const MAILPIT = "http://127.0.0.1:8025";

type Summary = { ID: string; Subject: string; To: { Address: string }[] };

export async function messagesTo(address: string): Promise<Summary[]> {
  const query = encodeURIComponent(`to:"${address}"`);
  const response = await fetch(`${MAILPIT}/api/v1/search?query=${query}&limit=50`);
  if (!response.ok) throw new Error(`Mailpit svarte ${response.status}`);
  return ((await response.json()) as { messages: Summary[] }).messages ?? [];
}

/** Venter på en e-post til adressen med emne som inneholder teksten, og returnerer teksten. */
export async function waitForEmail(
  address: string,
  subjectIncludes: string,
  opts: { timeoutMs?: number; notIds?: string[] } = {},
): Promise<{ id: string; subject: string; text: string }> {
  const deadline = Date.now() + (opts.timeoutMs ?? 20_000);
  while (Date.now() < deadline) {
    const match = (await messagesTo(address)).find(
      (m) => m.Subject.includes(subjectIncludes) && !opts.notIds?.includes(m.ID),
    );
    if (match) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${match.ID}`)).json()) as {
        Text: string;
      };
      return { id: match.ID, subject: match.Subject, text: message.Text };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Ingen e-post «${subjectIncludes}» til ${address}`);
}

/** Første lenke i teksten som starter med prefikset. */
export function linkIn(text: string, prefix: string): string {
  const match = text.match(/https?:\/\/\S+/g)?.find((u) => u.startsWith(prefix));
  if (!match) throw new Error(`Fant ingen lenke som starter med ${prefix}`);
  return match;
}

/** Token fra en lenke på formen `<app>/<sti>#token=...`. */
export function fragmentTokenFrom(text: string, path: string): string {
  const url = new URL(linkIn(text, "http"));
  if (url.pathname !== path) throw new Error(`Lenken går til ${url.pathname}, ikke ${path}`);
  if (url.search) throw new Error("Lenken har query-parametre; token skal bare stå i fragmentet");
  const token = new URLSearchParams(url.hash.slice(1)).get("token");
  if (!token) throw new Error("Fant ikke token i fragmentet");
  return token;
}

export const invitationTokenFrom = (text: string) => fragmentTokenFrom(text, "/invitasjon");

/** Unik syntetisk adresse per test. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@mailtest.example`;
}
