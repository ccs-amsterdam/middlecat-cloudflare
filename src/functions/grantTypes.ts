import { createAccessToken, createIdToken } from "./createJWT";
import { amcatSessions } from "@/drizzle/schema";
import { getDb } from "@/drizzle/db";
import settings from "./settings";
import { InferSelectModel, and, eq } from "drizzle-orm";
import hexSecret from "./hexSecret";
import createCodeChallenge from "./createCodeChallenge";

const db = getDb();

export async function authorizationCodeRequest(
  code: string,
  codeVerifier: string,
  oidc: boolean,
) {
  // validate the authorization code grant, and if pass create
  // the access token and refresh token

  // const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const codeChallenge = await createCodeChallenge(codeVerifier);

  // our authorization code is actually the table id + auth code
  const [id, secret] = code.split(".");

  const [amcatSession] = await db
    .select()
    .from(amcatSessions)
    .where(and(eq(amcatSessions.id, id), eq(amcatSessions.secret, secret)))
    .limit(1);

  if (!amcatSession || !amcatSession.secret) {
    // if amcatSession doesn't have a secret, it means it doesn't use oauth
    throw new Error("Invalid token request");
  }

  if (
    codeChallenge !== amcatSession.codeChallenge ||
    !amcatSession.secretExpires ||
    amcatSession.secretExpires < new Date(Date.now())
  ) {
    // Reasons for deleting the amcatSession
    // - if codeChallenge failed, auth code could be compromised
    // - If secret already used (no secretExpires), could be that bad actor was first
    // - If the secret expired, the amcatSession can never be started anyway

    await db.delete(amcatSessions).where(eq(amcatSessions.id, amcatSession.id));
    throw new Error("Invalid token request");
  }

  // authorization code has now been validated. We remove the secret stuff
  // to indicate that it can no longer be used.
  await db
    .update(amcatSessions)
    .set({ secretExpires: null })
    .where(eq(amcatSessions.id, amcatSession.id));

  return await createTokens(amcatSession, oidc);
}

export async function refreshTokenRequest(
  sessionId: string,
  refreshToken: string,
  oidc: boolean,
) {
  // the refresh token that the client receives is actually the session id + refresh token
  //const [sessionId, refreshToken] = refresh_token.split(".");

  const [amcatSession] = await db
    .select()
    .from(amcatSessions)
    .where(eq(amcatSessions.id, sessionId))
    .limit(1);

  if (!amcatSession) {
    throw new Error("Invalid refreshtoken request");
  }

  if (amcatSession.expires < new Date(Date.now())) {
    if (amcatSession)
      await db.delete(amcatSessions).where(eq(amcatSessions.id, sessionId));
    throw new Error("Refreshtoken expired");
  }

  const isValid = amcatSession.refreshToken === refreshToken;
  const isPrevious =
    amcatSession.refreshPrevious &&
    amcatSession.refreshPrevious === refreshToken;
  if (!isValid && !isPrevious) {
    // If token is not valid nor the previous token, kill the entire session. This way
    // if a refresh token was stolen, the legitimate user will break the session
    await db.delete(amcatSessions).where(eq(amcatSessions.id, sessionId));
    throw new Error("Refreshtoken rotated");
  }

  if (amcatSession.refreshRotate) {
    // the new previous token should be the one used (refreshToken or refreshPrevious).
    // if not, the legitimate user and thief could take turns refreshing.
    const usedToken = isPrevious
      ? amcatSession.refreshPrevious
      : amcatSession.refreshToken;
    amcatSession.refreshToken = hexSecret(32);

    await db
      .update(amcatSessions)
      .set({
        refreshToken: amcatSession.refreshToken,
        refreshPrevious: usedToken,
      })
      .where(eq(amcatSessions.id, sessionId));
  }

  // if a session is a browser session, we keep the expiration date between a certain range.
  // this lets a frequent user keep their session alive, but without having to update the
  // expiration date on every request.
  if (amcatSession.type === "browser") {
    const expirationDate = amcatSession.expires;
    const minExpiration = new Date(
      Date.now() + 1000 * 60 * 60 * settings.browser.session_update_age_hours,
    );
    const maxExpiration = new Date(
      Date.now() + 1000 * 60 * 60 * settings.browser.session_max_age_hours,
    );

    if (expirationDate < minExpiration || expirationDate > maxExpiration) {
      await db
        .update(amcatSessions)
        .set({
          expires: new Date(
            Date.now() +
              1000 * 60 * 60 * settings.browser.session_max_age_hours,
          ),
        })
        .where(eq(amcatSessions.id, amcatSession.id));
    }
  }

  return await createTokens(amcatSession, oidc);
}

export async function createTokens(
  amcatSession: InferSelectModel<typeof amcatSessions>,
  OIDC: boolean,
) {
  const { email, name, image, clientId, resource } = amcatSession;

  const middlecat = process.env.NEXTAUTH_URL || "";

  // expire access tokens
  // (exp seems to commonly be in seconds)
  const expireMinutes = settings[amcatSession.type].access_expire_minutes;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * expireMinutes;

  // oauth typically uses expires_in in seconds as a relative offset (due to local time issues).
  // we subtract 5 seconds because of possible delay in setting expires_in and the client receiving it
  const expires_in = expireMinutes * 60 - 5;

  // the refresh token that the client receives is actually the session id + refresh token
  const refresh_token = amcatSession.id + "." + amcatSession.refreshToken;

  let access_token: string;
  let id_token: string | undefined = undefined;

  const token_type = "bearer";

  if (OIDC) {
    access_token = await createAccessToken({
      iss: middlecat,
      sub: email || "",
      aud: resource,
      azp: clientId,
      exp: exp,
      iat,
      scope: amcatSession.scope || "",
    });

    id_token = await createIdToken({
      iss: middlecat,
      sub: email || "",
      aud: clientId,
      exp: exp,
      iat,
      name: name || "",
      picture: image || "",
    });
  } else {
    access_token = await createAccessToken({
      clientId,
      resource,
      email: email || "",
      name: name || "",
      image: image || "",
      scope: amcatSession.scope || "",
      exp,
      middlecat,
    });
  }

  return { token_type, access_token, id_token, refresh_token, expires_in };
}

export async function killSessionRequest(sessionId: string) {
  //const body = req.body || {};
  //const [sessionId] = body.refreshToken.split(".");

  const [amcatSession] = await db
    .select()
    .from(amcatSessions)
    .where(eq(amcatSessions.id, sessionId))
    .limit(1);

  if (amcatSession) {
    await db.delete(amcatSessions).where(eq(amcatSessions.id, amcatSession.id));
    return { message: "Session killed (yay)" };
  }
  throw new Error("Invalid kill request");
}
