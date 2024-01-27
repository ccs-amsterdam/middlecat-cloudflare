import { createAccessToken } from "./createJWT";
import { randomBytes } from "crypto";
import db, { amcatSessions, users } from "@/drizzle/schema";
import { createHash } from "crypto";
import settings from "./settings";
import { InferSelectModel, and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function authorizationCodeRequest(
  host: string,
  code: string,
  codeVerifier: string
) {
  // validate the authorization code grant, and if pass create
  // the access token and refresh token

  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // our authorization code is actually the table id + auth code
  const [id, secret] = code.split(".");

  const [{ amcatSession, user }] = await db
    .select()
    .from(amcatSessions)
    .where(and(eq(amcatSessions.id, id), eq(amcatSessions.secret, secret)))
    .leftJoin(users, eq(amcatSessions.email, users.email))
    .limit(1);

  if (!amcatSession || !user || !amcatSession.secret) {
    // if amcatSession doesn't have a secret, it means it doesn't use oauth
    return NextResponse.json(
      { message: "Invalid token request" },
      { status: 404 }
    );
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
    return NextResponse.json(
      { message: "Invalid token request" },
      { status: 401 }
    );
  }

  // authorization code has now been validated. We remove the secret stuff
  // to indicate that it can no longer be used.
  await db
    .update(amcatSessions)
    .set({ secretExpires: null })
    .where(eq(amcatSessions.id, amcatSession.id));

  await createTokens(host, amcatSession, user);
}

export async function refreshTokenRequest(
  host: string,
  sessionId: string,
  refreshToken: string
) {
  // the refresh token that the client receives is actually the session id + refresh token
  //const [sessionId, refreshToken] = refresh_token.split(".");

  const [{ amcatSession, user }] = await db
    .select()
    .from(amcatSessions)
    .where(eq(amcatSessions.id, sessionId))
    .leftJoin(users, eq(amcatSessions.email, users.email))
    .limit(1);

  if (!amcatSession || !user || amcatSession.expires < new Date(Date.now())) {
    if (amcatSession)
      await db.delete(amcatSessions).where(eq(amcatSessions.id, sessionId));
    return NextResponse.json(
      { message: "Invalid refreshtoken request" },
      { status: 401 }
    );
  }

  const isValid = amcatSession.refreshToken === refreshToken;
  const isPrevious =
    amcatSession.refreshPrevious &&
    amcatSession.refreshPrevious === refreshToken;

  if (!isValid && !isPrevious) {
    // If token is not valid nor the previous token, kill the entire session. This way
    // if a refresh token was stolen, the legitimate user will break the session
    await db.delete(amcatSessions).where(eq(amcatSessions.id, sessionId));
    return NextResponse.json(
      { message: "Invalid refreshtoken request" },
      { status: 401 }
    );
  }

  if (amcatSession.refreshRotate) {
    // the new previous token should be the one used (refreshToken or refreshPrevious).
    // if not, the legitimate user and thief could take turns refreshing.
    const usedToken = isPrevious
      ? amcatSession.refreshPrevious
      : amcatSession.refreshToken;
    amcatSession.refreshToken = randomBytes(32).toString("hex");

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
      Date.now() + 1000 * 60 * 60 * settings.browser.session_update_age_hours
    );
    const maxExpiration = new Date(
      Date.now() + 1000 * 60 * 60 * settings.browser.session_max_age_hours
    );

    if (expirationDate < minExpiration || expirationDate > maxExpiration) {
      await db
        .update(amcatSessions)
        .set({
          expires: new Date(
            Date.now() + 1000 * 60 * 60 * settings.browser.session_max_age_hours
          ),
        })
        .where(eq(amcatSessions.id, amcatSession.id));
    }
  }

  await createTokens(host, amcatSession, user);
}

export async function createTokens(
  host: string,
  amcatSession: InferSelectModel<typeof amcatSessions>,
  user: InferSelectModel<typeof users>
) {
  const { clientId, resource } = amcatSession;
  const { email, name, image } = user;

  // middlecat should always be on https, but exception for localhost
  const protocol = /^localhost/.test(host) ? "http://" : "https://";
  const middlecat = protocol + host;

  // expire access tokens
  // (exp seems to commonly be in seconds)
  const expireMinutes = settings[amcatSession.type].access_expire_minutes;
  const exp = Math.floor(Date.now() / 1000) + 60 * expireMinutes;

  const access_token = createAccessToken({
    clientId,
    resource,
    email: email || "",
    name: name || "",
    image: image || "",
    exp,
    middlecat,
  });

  // oauth typically uses expires_in in seconds as a relative offset (due to local time issues).
  // we subtract 5 seconds because of possible delay in setting expires_in and the client receiving it
  const expires_in = expireMinutes * 60 - 5;

  // the refresh token that the client receives is actually the session id + refresh token
  const refresh_token = amcatSession.id + "." + amcatSession.refreshToken;
  const refresh_rotate = amcatSession.refreshRotate;

  return NextResponse.json(
    {
      token_type: "bearer",
      access_token,
      refresh_token,
      refresh_rotate,
      expires_in,
    },
    { status: 200 }
  );
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
    return NextResponse.json(
      { message: "Session killed (yay)" },
      { status: 200 }
    );
  }
  return NextResponse.json(
    { message: "Invalid kill request" },
    { status: 401 }
  );
}
