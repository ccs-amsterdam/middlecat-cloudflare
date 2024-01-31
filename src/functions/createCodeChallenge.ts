// https://dev.to/kleeut/building-a-zero-dependency-pkce-auth-client-8c6
// Because cloudflare edge runtime doesn't support crypto

function base64URLEncode(str: string): string {
  const b64 = btoa(str);
  const encoded = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return encoded;
}

export default async function createCodeChallenge(verrifier: string): Promise<string> {
  const hashArray = await crypto.subtle.digest({ name: "SHA-256" }, new TextEncoder().encode(verrifier));
  const uIntArray = new Uint8Array(hashArray);
  const numberArray = Array.from(uIntArray);
  const hashString = String.fromCharCode.apply(null, numberArray);
  return base64URLEncode(hashString);
}
