import type { NextApiRequest, NextApiResponse } from "next";
import { createAccessToken } from "./createJWT";
import { randomBytes } from "crypto";
import db, { amcatSessions, users } from "@/drizzle/schema";
import { createHash } from "crypto";
import settings from "./settings";
import { InferSelectModel, and, eq, isNull } from "drizzle-orm";

export async function authorizationCodeRequest(
  res: NextApiResponse,
  req: NextApiRequest
) {
  // validate the authorization code grant, and if pass create
  // the access token and refresh token
  const { code, code_verifier } = req.body;

  const codeChallenge = createHash("sha256")
    .update(code_verifier)
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
    return res.status(401).send({ message: "Invalid token request" });
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
    return res.status(401).send({ message: "Invalid token request" });
  }

  // authorization code has now been validated. We remove the secret stuff
  // to indicate that it can no longer be used.
  await db
    .update(amcatSessions)
    .set({ secretExpires: null })
    .where(eq(amcatSessions.id, amcatSession.id));

  await createTokens(res, req, amcatSession, user);
}

export async function refreshTokenRequest(
  res: NextApiResponse,
  req: NextApiRequest
) {
  // the refresh token that the client receives is actually the session id + refresh token
  const [sessionId, refreshToken] = req.body.refresh_token.split(".");

  const [{ amcatSession, user }] = await db
    .select()
    .from(amcatSessions)
    .where(eq(amcatSessions.id, sessionId))
    .leftJoin(users, eq(amcatSessions.email, users.email))
    .limit(1);

  if (!amcatSession || !user || amcatSession.expires < new Date(Date.now())) {
    if (amcatSession)
      await db.delete(amcatSessions).where(eq(amcatSessions.id, sessionId));
    return res.status(401).send({ message: "Invalid refreshtoken request" });
  }

  const isValid = amcatSession.refreshToken === refreshToken;
  const isPrevious =
    amcatSession.refreshPrevious &&
    amcatSession.refreshPrevious === refreshToken;

  if (!isValid && !isPrevious) {
    // If token is not valid nor the previous token, kill the entire session. This way
    // if a refresh token was stolen, the legitimate user will break the session
    await db.delete(amcatSessions).where(eq(amcatSessions.id, sessionId));
    return res.status(401).send({ message: "Invalid refreshtoken request" });
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
      Date.now() + 1000 * 60 * 60 * settings.browser.session_min_expire_hours
    );
    const maxExpiration = new Date(
      Date.now() + 1000 * 60 * 60 * settings.browser.session_max_expire_hours
    );

    if (expirationDate < minExpiration || expirationDate > maxExpiration) {
      await db
        .update(amcatSessions)
        .set({
          expires: new Date(
            Date.now() +
              1000 * 60 * 60 * settings.browser.session_max_expire_hours
          ),
        })
        .where(eq(amcatSessions.id, amcatSession.id));
    }
  }

  await createTokens(res, req, amcatSession, user);
}

export async function createTokens(
  res: NextApiResponse,
  req: NextApiRequest,
  amcatSession: InferSelectModel<typeof amcatSessions>,
  user: InferSelectModel<typeof users>
) {
  const { clientId, resource } = amcatSession;
  const { email, name, image } = user;

  // middlecat should always be on https, but exception for localhost
  const host = req.headers.host || "";
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

  res.status(200).json({
    token_type: "bearer",
    access_token,
    refresh_token,
    refresh_rotate,
    expires_in,
  });
}

export async function killSessionRequest(
  res: NextApiResponse,
  req: NextApiRequest
) {
  const refreshToken = req.body.refresh_token;
  const [sessionId] = refreshToken.split(".");

  const [amcatSession] = await db
    .select()
    .from(amcatSessions)
    .where(eq(amcatSessions.id, sessionId))
    .limit(1);

  if (amcatSession) {
    await db.delete(amcatSessions).where(eq(amcatSessions.id, amcatSession.id));
    return res.status(201).send({ message: "Session killed (yay)" });
  }
  return res.status(401).send({ message: "Invalid kill request" });
}
