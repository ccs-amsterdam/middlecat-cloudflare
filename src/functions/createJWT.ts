import * as jose from "jose";

interface MiddlecatAccessTokenPayload {
  clientId: string;
  resource: string;
  email: string;
  name: string;
  image: string;
  scope: string;
  exp: number;
  middlecat: string;
}

interface OIDCAccessTokenPayload {
  iss: string; // middlecat url
  sub: string; // email
  aud: string[] | string; // [api url, userinfo url]
  azp: string; // client id
  exp: number; // expiry date in seconds
  iat: number; // issued at date in seconds
  scope: string; // scopes
}

interface IdTokenPayload {
  iss: string; // middlecat url
  sub: string; // email
  aud: string; // client id
  exp: number; // expiry date in seconds
  iat: number; // issued at date in seconds
  name: string; // user's name
  picture: string;
}

// can only be called server-side (from api endpoints)

export async function createAccessToken(
  payload: MiddlecatAccessTokenPayload | OIDCAccessTokenPayload,
) {
  return createJWT(payload);
}

export async function createIdToken(payload: IdTokenPayload) {
  return createJWT(payload);
}

async function createJWT<T>(payload: T) {
  const alg = "RS256";
  const pkcs8 = process.env.PRIVATEKEY || "";
  if (!pkcs8 || !payload) return "";
  const privateKey = await jose.importPKCS8(pkcs8, alg);
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg })
    .sign(privateKey);
}
