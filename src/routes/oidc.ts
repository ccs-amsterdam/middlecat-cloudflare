import { Hono } from "hono";
import { cors } from "hono/cors";
import { AppEnv, getIssuer } from "../env";
import { verifyAccessToken } from "../lib/createJWT";
import { getKeySet } from "../lib/keys";

const app = new Hono<AppEnv>();

// these are public and used by servers from anywhere
app.use("/.well-known/*", cors({ origin: "*", allowMethods: ["GET", "POST"] }));
app.use("/api/userinfo", cors({ origin: "*", allowMethods: ["GET", "POST"], allowHeaders: ["Authorization"] }));

function openidConfiguration(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/api/token`,
    userinfo_endpoint: `${issuer}/api/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks`,
    revocation_endpoint: `${issuer}/api/revoke`,
    end_session_endpoint: `${issuer}/logout`,
    scopes_supported: ["openid", "profile", "email"],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    prompt_values_supported: ["none", "login", "consent"],
    // Servers are public clients (PKCE), identified by their URL. See lib/authorizeRequest.ts
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    claims_supported: [
      "iss",
      "sub",
      "aud",
      "exp",
      "iat",
      "auth_time",
      "nonce",
      "sid",
      "name",
      "picture",
      "email",
      "email_verified",
    ],
  };
}

app.on(["GET", "POST"], "/.well-known/openid-configuration", (c) => {
  return c.json(openidConfiguration(getIssuer(c.env)));
});

app.get("/.well-known/jwks", async (c) => {
  // contains the next, current and previous keys. Verifiers should look up keys by kid, and refetch
  // when they see an unknown kid. A short cache time limits how long a revoked key stays trusted.
  const { jwks } = await getKeySet(c.env);
  c.header("Cache-Control", "public, max-age=900");
  return c.json(jwks);
});

// The claims come from the access token itself: MiddleCat doesn't keep user details (see lib/cleanup.ts)
app.on(["GET", "POST"], "/api/userinfo", async (c) => {
  const authorization = c.req.header("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const unauthorized = () => {
    c.header("WWW-Authenticate", 'Bearer error="invalid_token"');
    return c.json({ error: "invalid_token" }, 401);
  };
  if (!match) return unauthorized();

  let payload;
  try {
    payload = await verifyAccessToken(c.env, match[1].trim(), getIssuer(c.env));
  } catch {
    return unauthorized();
  }
  if (typeof payload.sub !== "string" || !payload.sub) return unauthorized();

  c.header("Cache-Control", "no-store");
  return c.json({
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
  });
});

export default app;
