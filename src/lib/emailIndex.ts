// A keyed hash (HMAC-SHA256) of an email address, so a user's sessions and confirmed servers can be found
// without storing their email address. The key is derived from KEY_ENCRYPTION_SECRET, so the hashes can't
// be reversed by trying email addresses without that secret. (Changing KEY_ENCRYPTION_SECRET makes existing
// sessions disappear from the dashboard, and servers ask for confirmation again.)

const enc = (s: string) => new TextEncoder().encode(s);

let cached: { secret: string; key: Promise<CryptoKey> } | undefined;

function hmacKey(secret: string) {
  if (cached?.secret !== secret) {
    const key = (async () => {
      const base = await crypto.subtle.importKey("raw", enc(secret), "HKDF", false, ["deriveKey"]);
      return crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt: enc("middlecat-email-index"), info: enc("v1") },
        base,
        { name: "HMAC", hash: "SHA-256", length: 256 },
        false,
        ["sign"],
      );
    })();
    cached = { secret, key };
  }
  return cached.key;
}

export async function emailHash(env: { KEY_ENCRYPTION_SECRET: string }, email: string) {
  const key = await hmacKey(env.KEY_ENCRYPTION_SECRET);
  const mac = await crypto.subtle.sign("HMAC", key, enc(email.trim().toLowerCase()));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}
