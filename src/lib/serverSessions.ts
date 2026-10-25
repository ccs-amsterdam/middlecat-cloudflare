import { InferSelectModel, and, eq, isNotNull, lt, or } from "drizzle-orm";
import { createAccessToken, createIdToken } from "./createJWT";
import { serverSession } from "../drizzle/schema";
import { getDb } from "../drizzle/db";
import settings from "./settings";
import hexSecret from "./hexSecret";
import createCodeChallenge from "./createCodeChallenge";
import { safeEqual, sha256Hex } from "./hash";
import { decryptWithSecret, encryptWithSecret } from "./secretBox";
import { emailHash } from "./emailIndex";
import { Bindings, getIssuer } from "../env";
import { AuthorizeRequest } from "./authorizeRequest";

type ServerSession = InferSelectModel<typeof serverSession>;

export interface UserInfo {
  email: string;
  name: string;
  image: string | null;
}

/** Error that is returned to the client as an OAuth error response */
export class GrantError extends Error {
  constructor(
    public error: "invalid_request" | "invalid_grant",
    message: string,
  ) {
    super(message);
  }
}

// The user's info is encrypted with the current secret (authorization code, later the refresh token)
const userInfoContext = (id: string) => `${id}:userinfo`;
const successorContext = (id: string) => `${id}:successor`;

async function readUserInfo(secret: string, s: ServerSession): Promise<UserInfo | null> {
  const json = await decryptWithSecret(secret, userInfoContext(s.id), s.userInfoEncrypted);
  return json ? JSON.parse(json) : null;
}

function sessionExpires() {
  return new Date(Date.now() + 1000 * 60 * 60 * settings.session_max_age_hours);
}

/**
 * Create a session for an approved /authorize request, and return the authorization code.
 * The code is the session id + a secret, of which only the hash is stored.
 */
export async function createAuthorizationCode(
  env: Bindings,
  req: AuthorizeRequest,
  user: UserInfo,
  authTime: Date,
  createdOn: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const secret = hexSecret(32);

  await getDb(env)
    .insert(serverSession)
    .values({
      id,
      server: req.server,
      resource: req.resource,
      clientId: req.clientId,
      scope: req.scope,
      emailHash: await emailHash(env, user.email),
      userInfoEncrypted: await encryptWithSecret(secret, userInfoContext(id), JSON.stringify(user)),
      authTime,
      codeChallenge: req.codeChallenge,
      codeSecretHash: await sha256Hex(secret),
      codeExpires: new Date(Date.now() + 1000 * 60 * settings.code_expire_minutes),
      redirectUri: req.redirectUri,
      nonce: req.nonce,
      // the real refresh token is created when the code is exchanged
      refreshTokenHash: await sha256Hex(hexSecret(32)),
      createdOn,
      createdAt: new Date(),
      expires: sessionExpires(),
    });

  return id + "." + secret;
}

export async function authorizationCodeRequest(
  env: Bindings,
  params: { code: string; codeVerifier: string; redirectUri?: string; clientId?: string },
) {
  const db = getDb(env);
  const [id, secret] = params.code.split(".");
  if (!id || !secret) throw new GrantError("invalid_grant", "Invalid authorization code");

  const [s] = await db.select().from(serverSession).where(eq(serverSession.id, id)).limit(1);
  if (!s || !safeEqual(await sha256Hex(secret), s.codeSecretHash)) {
    throw new GrantError("invalid_grant", "Invalid authorization code");
  }

  const codeChallenge = await createCodeChallenge(params.codeVerifier);
  const wrongRedirect = params.redirectUri !== undefined && params.redirectUri !== s.redirectUri;
  const wrongClient = params.clientId !== undefined && params.clientId !== s.clientId;
  const user = await readUserInfo(secret, s);

  if (
    !safeEqual(codeChallenge, s.codeChallenge) ||
    wrongRedirect ||
    wrongClient ||
    !user ||
    !s.codeExpires ||
    s.codeExpires < new Date()
  ) {
    // Reasons for deleting the session
    // - if codeChallenge, redirect_uri or client_id are wrong, the auth code could be compromised
    // - If the code was already used (no codeExpires), could be that bad actor was first
    // - If the code expired, the session can never be started anyway
    await db.delete(serverSession).where(eq(serverSession.id, s.id));
    throw new GrantError("invalid_grant", "Invalid authorization code");
  }

  // Use the code. This is conditional, so that concurrent requests with the same code can't both succeed.
  const refreshToken = hexSecret(32);
  const consumed = await db
    .update(serverSession)
    .set({
      codeExpires: null,
      refreshTokenHash: await sha256Hex(refreshToken),
      userInfoEncrypted: await encryptWithSecret(refreshToken, userInfoContext(s.id), JSON.stringify(user)),
    })
    .where(and(eq(serverSession.id, s.id), isNotNull(serverSession.codeExpires)))
    .returning({ id: serverSession.id });
  if (consumed.length === 0) {
    await db.delete(serverSession).where(eq(serverSession.id, s.id));
    throw new GrantError("invalid_grant", "Invalid authorization code");
  }

  return await createTokens(env, s, user, refreshToken, s.nonce);
}

/** Look up a refresh token (session id + secret), and whether it's the current or the previous one */
async function checkRefreshToken(env: Bindings, refresh_token: string) {
  const [id, token] = refresh_token.split(".");
  if (!id || !token) return null;

  const [s] = await getDb(env).select().from(serverSession).where(eq(serverSession.id, id)).limit(1);
  // a session of which the code wasn't exchanged yet has no refresh token
  if (!s || s.codeExpires) return null;

  const given = await sha256Hex(token);
  const isCurrent = safeEqual(given, s.refreshTokenHash);
  const isPrevious = !!s.refreshPreviousHash && safeEqual(given, s.refreshPreviousHash);
  return { s, token, isCurrent, isPrevious };
}

async function killSession(env: Bindings, id: string, message: string): Promise<never> {
  await getDb(env).delete(serverSession).where(eq(serverSession.id, id));
  throw new GrantError("invalid_grant", message);
}

export async function refreshTokenRequest(env: Bindings, refresh_token: string) {
  const db = getDb(env);
  const check = await checkRefreshToken(env, refresh_token);
  if (!check) throw new GrantError("invalid_grant", "Invalid refresh token");
  const { s, token, isCurrent, isPrevious } = check;

  if (s.expires < new Date()) await killSession(env, s.id, "Refresh token expired");

  // If the token is neither the current nor the previous token, kill the entire session. This way
  // if a refresh token was stolen, the legitimate user will break the session
  if (!isCurrent && !isPrevious) await killSession(env, s.id, "Refresh token was already used");

  let refreshToken: string;
  let user: UserInfo | null;

  if (isCurrent) {
    user = await readUserInfo(token, s);
    if (!user) return killSession(env, s.id, "Invalid refresh token");

    // Rotate. The update only succeeds if no other request rotated this token in the meantime.
    const next = hexSecret(32);
    const rotated = await db
      .update(serverSession)
      .set({
        refreshTokenHash: await sha256Hex(next),
        refreshPreviousHash: await sha256Hex(token),
        rotatedAt: new Date(),
        refreshNextEncrypted: await encryptWithSecret(token, successorContext(s.id), next),
        userInfoEncrypted: await encryptWithSecret(next, userInfoContext(s.id), JSON.stringify(user)),
      })
      .where(and(eq(serverSession.id, s.id), eq(serverSession.refreshTokenHash, s.refreshTokenHash)))
      .returning({ id: serverSession.id });

    if (rotated.length > 0) {
      refreshToken = next;
    } else {
      // a concurrent request rotated this token first: this is now a reuse within the grace period
      const recheck = await checkRefreshToken(env, refresh_token);
      if (!recheck?.isPrevious) return killSession(env, s.id, "Refresh token was already used");
      ({ refreshToken, user } = await graceSuccessor(env, recheck.s, token));
    }
  } else {
    // the previous token: only within the grace period after rotation, and it gets the same new token
    ({ refreshToken, user } = await graceSuccessor(env, s, token));
  }

  // keep a frequently used session alive, without updating the expiration date on every request
  const minExpiration = new Date(Date.now() + 1000 * 60 * 60 * settings.session_update_age_hours);
  if (s.expires < minExpiration) {
    await db.update(serverSession).set({ expires: sessionExpires() }).where(eq(serverSession.id, s.id));
  }

  return await createTokens(env, s, user, refreshToken);
}

/**
 * The new refresh token for a reuse of the previous token within the grace period.
 * Outside the grace period, a reuse means the token was probably stolen: kill the session.
 */
async function graceSuccessor(env: Bindings, s: ServerSession, previousToken: string) {
  const rotatedAt = s.rotatedAt?.getTime();
  const inGrace = rotatedAt !== undefined && Date.now() - rotatedAt <= settings.refresh_grace_seconds * 1000;
  const next = inGrace ? await decryptWithSecret(previousToken, successorContext(s.id), s.refreshNextEncrypted) : null;
  const user = next ? await readUserInfo(next, s) : null;
  if (!next || !user) return killSession(env, s.id, "Refresh token was already used");
  return { refreshToken: next, user };
}

export async function createTokens(
  env: Bindings,
  s: ServerSession,
  user: UserInfo,
  refreshToken: string,
  nonce?: string | null,
) {
  const iss = getIssuer(env);
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * settings.access_expire_minutes;
  const auth_time = Math.floor(s.authTime.getTime() / 1000);

  const access_token = await createAccessToken(env, {
    iss,
    sub: user.email,
    aud: s.resource,
    azp: s.clientId,
    client_id: s.clientId,
    exp,
    iat,
    auth_time,
    scope: s.scope,
    email: user.email,
    email_verified: true,
    name: user.name,
  });

  const id_token = await createIdToken(env, {
    iss,
    sub: user.email,
    aud: s.clientId,
    exp,
    iat,
    auth_time,
    sid: s.id,
    name: user.name,
    picture: user.image || "",
    email: user.email,
    email_verified: true,
    ...(nonce ? { nonce } : {}),
  });

  return {
    token_type: "Bearer",
    access_token,
    id_token,
    // the refresh token that the client receives is the session id + the secret
    refresh_token: s.id + "." + refreshToken,
    // oauth uses expires_in in seconds as a relative offset (due to local time issues).
    // we subtract 5 seconds because of possible delay in setting expires_in and the client receiving it
    expires_in: settings.access_expire_minutes * 60 - 5,
  };
}

/** Revoke a refresh token (RFC 7009): ends the session. Invalid tokens are ignored, as the RFC requires. */
export async function revokeRefreshToken(env: Bindings, refresh_token: string) {
  const check = await checkRefreshToken(env, refresh_token);
  if (check && (check.isCurrent || check.isPrevious)) {
    await getDb(env).delete(serverSession).where(eq(serverSession.id, check.s.id));
  }
}

/** End a session by id (logout with an id_token_hint, or from the dashboard) */
export async function endSession(env: Bindings, id: string, emailHashValue?: string) {
  const where = emailHashValue
    ? and(eq(serverSession.id, id), eq(serverSession.emailHash, emailHashValue))
    : eq(serverSession.id, id);
  const deleted = await getDb(env).delete(serverSession).where(where).returning({ id: serverSession.id });
  return deleted.length > 0;
}

/** Remove expired sessions, and authorizations of which the code was never used */
export async function deleteExpiredSessions(env: Bindings) {
  const now = new Date();
  await getDb(env)
    .delete(serverSession)
    .where(or(lt(serverSession.expires, now), lt(serverSession.codeExpires, now)));
}
