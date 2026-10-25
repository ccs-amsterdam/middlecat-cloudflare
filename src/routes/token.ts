import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { AppEnv } from "../env";
import getRequestBody from "../lib/getRequestBody";
import { authorizationCodeRequest, refreshTokenRequest, revokeRefreshToken, GrantError } from "../lib/serverSessions";

const app = new Hono<AppEnv>();

// Servers call these from their backend. CORS allows it from anywhere; no cookies are involved.
app.use("/api/token", cors({ origin: "*", allowMethods: ["POST"], allowHeaders: ["Content-Type", "Authorization"] }));
app.use("/api/revoke", cors({ origin: "*", allowMethods: ["POST"], allowHeaders: ["Content-Type", "Authorization"] }));

const authorizationCodeSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().max(500),
  code_verifier: z.string().min(43).max(128),
  redirect_uri: z.string().optional(),
  client_id: z.string().optional(),
});

const refreshTokenSchema = z.object({
  grant_type: z.literal("refresh_token"),
  refresh_token: z.string().max(500),
});

const bodySchema = z.discriminatedUnion("grant_type", [authorizationCodeSchema, refreshTokenSchema]);

/** Burst limit per session (the part of a code or refresh token before the dot), if the binding is configured */
async function rateLimited(env: AppEnv["Bindings"], token: string) {
  if (!env.RATE_LIMITER) return false;
  const { success } = await env.RATE_LIMITER.limit({ key: `token:${token.split(".")[0]}` });
  return !success;
}

app.post("/api/token", async (c) => {
  c.header("Cache-Control", "no-store");

  let rawBody: Record<string, unknown>;
  try {
    rawBody = await getRequestBody(c.req.raw);
  } catch {
    return c.json({ error: "invalid_request", error_description: "Invalid request body" }, 400);
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "invalid_request", error_description: "Invalid request body" }, 400);
  }
  const body = parsed.data;

  const token = body.grant_type === "authorization_code" ? body.code : body.refresh_token;
  if (await rateLimited(c.env, token)) return c.json({ error: "slow_down", error_description: "Too many requests" }, 429);

  try {
    if (body.grant_type === "authorization_code") {
      return c.json(
        await authorizationCodeRequest(c.env, {
          code: body.code,
          codeVerifier: body.code_verifier,
          redirectUri: body.redirect_uri,
          clientId: body.client_id,
        }),
      );
    }
    return c.json(await refreshTokenRequest(c.env, body.refresh_token));
  } catch (e: unknown) {
    if (e instanceof GrantError) return c.json({ error: e.error, error_description: e.message }, 400);
    throw e;
  }
});

// Token revocation (RFC 7009). Revoking a refresh token ends the session at the server.
// Access tokens are short-lived JWTs and can't be revoked. Unknown tokens are ignored, as the RFC requires.
app.post("/api/revoke", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await getRequestBody(c.req.raw);
  } catch {
    return c.json({ error: "invalid_request" }, 400);
  }
  if (typeof body.token !== "string" || !body.token) return c.json({ error: "invalid_request" }, 400);
  if (body.token.includes(".") && body.token.split(".").length === 2) {
    await revokeRefreshToken(c.env, body.token);
  }
  return c.body(null, 200);
});

export default app;
