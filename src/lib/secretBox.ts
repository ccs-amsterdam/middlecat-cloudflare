import * as jose from "jose";

// Encrypt data with a key derived from a secret that we only store a hash of (an authorization code or refresh
// token). Only whoever presents the secret can decrypt it, so a database leak alone reveals nothing.
// Used for the user's info in a server session, and for the new refresh token during the grace period.

const enc = (s: string) => new TextEncoder().encode(s);

async function keyFrom(secret: string, context: string) {
  const base = await crypto.subtle.importKey("raw", enc(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc("middlecat-secret-box"), info: enc(context) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** context binds the ciphertext to its use (e.g. "<session id>:userinfo") */
export async function encryptWithSecret(secret: string, context: string, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(secret, context);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc(context) }, key, enc(plaintext));
  return `v1.${jose.base64url.encode(iv)}.${jose.base64url.encode(new Uint8Array(ciphertext))}`;
}

/** The plaintext, or null if it can't be decrypted with this secret */
export async function decryptWithSecret(secret: string, context: string, encrypted: string | null) {
  const [version, iv, ciphertext] = (encrypted || "").split(".");
  if (version !== "v1" || !iv || !ciphertext) return null;
  try {
    const key = await keyFrom(secret, context);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: jose.base64url.decode(iv), additionalData: enc(context) },
      key,
      jose.base64url.decode(ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
