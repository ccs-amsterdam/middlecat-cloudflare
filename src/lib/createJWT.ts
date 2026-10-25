import * as jose from "jose";
import { getKeySet } from "./keys";
import { Bindings } from "../env";

const alg = "RS256";

type AccessTokenPayload = {
  iss: string; // middlecat url
  sub: string; // email
  aud: string; // resource (the server's API url)
  azp: string; // client id
  client_id: string; // client id (RFC 9068)
  exp: number; // expiry date in seconds
  iat: number; // issued at date in seconds
  auth_time: number; // when the user signed in to MiddleCat (seconds)
  scope: string;
  email: string; // same as sub. Resource servers (e.g. AmCAT) read the email claim
  email_verified: boolean;
  name: string;
};

type IdTokenPayload = {
  iss: string; // middlecat url
  sub: string; // email
  aud: string; // client id
  exp: number;
  iat: number;
  auth_time: number;
  sid: string; // server session id, used for logout
  name: string;
  picture: string;
  email: string;
  email_verified: boolean;
  nonce?: string;
};

export async function createAccessToken(env: Bindings, payload: AccessTokenPayload) {
  // typ at+jwt (RFC 9068) distinguishes access tokens from id tokens
  return createJWT(env, payload, "at+jwt");
}

export async function createIdToken(env: Bindings, payload: IdTokenPayload) {
  return createJWT(env, payload);
}

async function createJWT<T extends jose.JWTPayload>(env: Bindings, payload: T, typ?: string) {
  const { signing } = await getKeySet(env);
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg, kid: signing.kid, ...(typ ? { typ } : {}) })
    .sign(signing.privateKey);
}

export async function verifyAccessToken(env: Bindings, token: string, issuer: string) {
  const { jwkSet } = await getKeySet(env);
  const { payload } = await jose.jwtVerify(token, jwkSet, { issuer, typ: "at+jwt", algorithms: [alg] });
  return payload;
}

/**
 * Verify an id_token_hint (at logout). It must be signed by us, but may be expired.
 * Returns the claims, or null if it isn't a valid id token of this issuer.
 */
export async function verifyIdTokenHint(env: Bindings, token: string, issuer: string) {
  const { jwkSet } = await getKeySet(env);
  try {
    const { payload, protectedHeader } = await jose.jwtVerify(token, jwkSet, {
      issuer,
      algorithms: [alg],
      // expired id tokens are fine as a hint
      currentDate: new Date(0),
    });
    if (protectedHeader.typ === "at+jwt") return null;
    return payload;
  } catch {
    return null;
  }
}
