// PKCE S256 code challenge: base64url(sha256(verifier))

function base64URLEncode(bytes: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export default async function createCodeChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest({ name: "SHA-256" }, new TextEncoder().encode(verifier));
  return base64URLEncode(new Uint8Array(hash));
}
