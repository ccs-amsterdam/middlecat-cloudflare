import { NextResponse } from "next/server";
import * as jose from "jose";

const publicKey = process.env.NEXT_PUBLIC_PUBLICKEY || "";
const keyLike = await jose.importSPKI(publicKey, "RS256");
const jwk = await jose.exportJWK(keyLike);
const n = jwk.n;
const e = jwk.e;

export async function GET() {
  const jwks = {
    keys: [
      {
        kty: "RSA",
        use: "sig",
        kid: "1",
        alg: "RS256",
        n,
        e,
      },
    ],
  };

  return NextResponse.json(jwks, { status: 200 });
}
