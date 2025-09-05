import { NextResponse } from "next/server";
import * as jose from "jose";

let cachedJwk: {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  n: string;
  e: string;
} | null = null;

async function getJwk() {
  if (!cachedJwk) {
    const publicKey = process.env.NEXT_PUBLIC_PUBLICKEY || "";
    const keyLike = await jose.importSPKI(publicKey, "RS256");
    const jwk = await jose.exportJWK(keyLike);
    cachedJwk = {
      kty: "RSA",
      use: "sig",
      kid: "1",
      alg: "RS256",
      n: jwk.n,
      e: jwk.e,
    };
  }
  return cachedJwk;
}

export async function GET(req: Request) {
  const jwk = await getJwk();

  const jwks = {
    keys: [jwk],
  };

  return NextResponse.json(jwks, { status: 200 });
}
