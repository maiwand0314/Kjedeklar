/**
 * Forsegling av lenker med engangstoken (reset/verifisering) før de sendes til
 * en planlagt e-postjobb. Argumentene til planlagte funksjoner lagres i Convex,
 * så tokenet skal aldri stå der i klartekst. AES-GCM med nøkkel avledet (HKDF)
 * fra BETTER_AUTH_SECRET. Bruker bare WebCrypto, så det virker både i V8- og
 * Node-runtime.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function sealKey(): Promise<CryptoKey> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET mangler.");
  const base = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, [
    "deriveKey",
  ]);
  return await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("kjedeklar"),
      info: encoder.encode("email-link-seal-v1"),
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function seal(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await sealKey(), encoder.encode(plaintext)),
  );
  return `${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
}

export async function unseal(sealed: string): Promise<string> {
  const [iv, ciphertext] = sealed.split(".");
  if (!iv || !ciphertext) throw new Error("Ugyldig forseglet verdi.");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(iv) },
    await sealKey(),
    fromBase64Url(ciphertext),
  );
  return decoder.decode(plaintext);
}

/** SHA-256 som hex. Brukes for invitasjonstoken; bare hashen lagres. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}
