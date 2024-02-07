import * as jose from "jose";

interface AccessTokenPayload {
  clientId: string;
  resource: string;
  email: string;
  name: string;
  image: string;
  scope: string;
  exp: number;
  middlecat: string;
}

// can only be called server-side (from api endpoints)

export async function createAccessToken(payload: AccessTokenPayload) {
  return createJWT(payload);
}

async function createJWT(payload: Record<string, any>) {
  const alg = "RS256";
  const pkcs8 = process.env.PRIVATEKEY || "";
  if (!pkcs8 || !payload) return "";
  const privateKey = await jose.importPKCS8(pkcs8, alg);
  return await new jose.SignJWT(payload).setProtectedHeader({ alg }).sign(privateKey);
}
