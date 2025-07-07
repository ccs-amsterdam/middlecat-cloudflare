function base64URLEncode(str: string): string {
  const b64 = window.btoa(str);
  const encoded = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return encoded;
}

function hexSecret(n: number) {
  return Array.from(window.crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createVerifier(): string {
  return hexSecret(32);
}

export async function createCodeChallenge(verrifier: string): Promise<string> {
  const hashArray = await crypto.subtle.digest({ name: "SHA-256" }, new TextEncoder().encode(verrifier));
  const uIntArray = new Uint8Array(hashArray);
  const numberArray = Array.from(uIntArray);
  const hashString = String.fromCharCode.apply(null, numberArray);
  return base64URLEncode(hashString);
}

export default async function pkce() {
  const codeVerifier = createVerifier();
  return {
    codeVerifier,
    codeChallenge: await createCodeChallenge(codeVerifier),
  };
}
