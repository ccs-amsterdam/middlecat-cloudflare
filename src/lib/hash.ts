/** SHA-256 as hex. Used to store code secrets and refresh tokens. */
export async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

type TimingSafeSubtle = SubtleCrypto & { timingSafeEqual?: (a: ArrayBufferView, b: ArrayBufferView) => boolean };

/** Constant time string comparison (for strings of equal length, such as hashes). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;

  // Cloudflare Workers provide crypto.subtle.timingSafeEqual
  const subtle = crypto.subtle as TimingSafeSubtle;
  if (subtle.timingSafeEqual) return subtle.timingSafeEqual(ea, eb);

  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}
