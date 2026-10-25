import { env, exports } from "cloudflare:workers";
import { describe, expect, it, beforeAll } from "vitest";
import { cleanup } from "../src/lib/cleanup";
import { countLogin } from "../src/lib/usage";
import settings from "../src/lib/settings";
import type { Bindings } from "../src/env";

const BASE = "http://localhost:3000";
// like AmCAT: the server's backend is the client, on the same origin as the resource
const CLIENT = "https://amcat.example";
const RESOURCE = "https://amcat.example/api";
const REDIRECT = "https://amcat.example/api/auth/callback";

let cookie = "";

function fetchWorker(path: string, init?: RequestInit) {
  return exports.default.fetch(new Request(BASE + path, { redirect: "manual", ...init }));
}

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  return { verifier, challenge };
}

/** Sign in a user by creating a Better Auth session and its signed cookie */
async function signIn(
  id: string,
  email: string,
  opts: { verified?: boolean; loginAgoMs?: number } = {},
): Promise<string> {
  const now = Date.now();
  const unique = crypto.randomUUID();
  const token = `session-token-${unique}`;
  await env.DB1.prepare(
    "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT (id) DO UPDATE SET emailVerified = excluded.emailVerified",
  )
    .bind(id, "Test User", email, opts.verified === false ? 0 : 1, now, now)
    .run();
  await env.DB1.prepare(
    "INSERT INTO session (id, expiresAt, token, createdAt, updatedAt, userId) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(`s-${unique}`, now + 3600_000, token, now - (opts.loginAgoMs ?? 0), now, id)
    .run();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.BETTER_AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token)));
  return `better-auth.session_token=${encodeURIComponent(token + "." + btoa(String.fromCharCode(...sig)))}`;
}

function authorizeQuery(params: Record<string, string>) {
  return "/authorize?" + new URLSearchParams(params).toString();
}

async function authorizeParams(params: Record<string, string> = {}) {
  const { verifier, challenge } = await pkce();
  const query = {
    client_id: CLIENT,
    redirect_uri: REDIRECT,
    resource: RESOURCE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...params,
  };
  return { path: authorizeQuery(query), verifier };
}

function confirm(path: string, userCookie = cookie) {
  return fetchWorker(path, {
    method: "POST",
    headers: { cookie: userCookie, origin: BASE, "content-type": "application/x-www-form-urlencoded" },
    body: "consent=approve",
  });
}

/** Sign in to MiddleCat and run /authorize (confirming), returns the code. This ends the MiddleCat login. */
async function getCode(params: Record<string, string> = {}, userCookie?: string) {
  const { path, verifier } = await authorizeParams(params);
  const res = await confirm(path, userCookie ?? (await signIn("u1", "test@example.com")));
  expect(res.status).toBe(303);
  const location = new URL(res.headers.get("location")!);
  return { code: location.searchParams.get("code")!, verifier, location };
}

async function token(body: Record<string, string>) {
  const res = await fetchWorker("/api/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  return { status: res.status, body: (await res.json()) as Record<string, string> };
}

async function session(userCookie?: string) {
  const { code, verifier } = await getCode({}, userCookie);
  const t = await token({ grant_type: "authorization_code", code, code_verifier: verifier });
  expect(t.status).toBe(200);
  return t.body;
}

function claims(jwt: string) {
  return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
}

beforeAll(async () => {
  cookie = await signIn("u1", "test@example.com");
});

describe("/authorize request validation", () => {
  async function expectError(params: Record<string, string>, message: string) {
    const { path } = await authorizeParams(params);
    const res = await fetchWorker(path, { headers: { cookie } });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain(message);
  }

  it("rejects a redirect_uri on another origin than the resource", async () => {
    await expectError(
      { client_id: "https://evil.example", redirect_uri: "https://evil.example/api/auth/callback" },
      "redirect_uri must be on the same origin as the resource",
    );
  });

  it("rejects a redirect_uri outside the resource path", async () => {
    await expectError({ redirect_uri: "https://amcat.example/other/callback" }, "redirect_uri must be within the resource path");
    await expectError({ redirect_uri: "https://amcat.example/apix/callback" }, "redirect_uri must be within the resource path");
  });

  it("rejects a client_id that isn't the server's URL", async () => {
    await expectError({ client_id: "Some R package" }, "client_id must be the URL of the server");
    await expectError({ client_id: "https://other.example" }, "client_id must be the URL of the server");
  });

  it("doesn't let a site get id_tokens for another site's client_id", async () => {
    await expectError(
      {
        client_id: "https://victim-app.example",
        redirect_uri: "https://evil.example/api/callback",
        resource: "https://evil.example/api",
      },
      "client_id must be the URL of the server",
    );
  });

  it("rejects plain http, except for servers on localhost", async () => {
    await expectError(
      { client_id: "http://amcat.example", redirect_uri: "http://amcat.example/api/cb", resource: "http://amcat.example/api" },
      "must use https",
    );
    const { code } = await getCode({
      client_id: "http://localhost:5000",
      redirect_uri: "http://localhost:5000/api/auth/callback",
      resource: "http://localhost:5000/api",
    });
    expect(code).toBeTruthy();
  });

  it("rejects unsupported prompt values and repeated parameters", async () => {
    await expectError({ prompt: "select_account" }, "prompt=select_account is not supported");
    const res = await fetchWorker("/authorize?client_id=a&client_id=b", { headers: { cookie } });
    expect(res.status).toBe(400);
  });
});

describe("/authorize sign-in flow", () => {
  it("can't be framed", async () => {
    const { path } = await authorizeParams();
    const res = await fetchWorker(path, { headers: { cookie } });
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("asks for confirmation once per server, then signs in directly", async () => {
    const user = await signIn("u-consent", "consent@example.com");
    const { path } = await authorizeParams({ state: "s1" });
    const first = await fetchWorker(path, { headers: { cookie: user } });
    expect(first.status).toBe(200);
    expect(await first.text()).toContain("will receive your name and email address");

    expect((await confirm(path, user)).status).toBe(303);

    // the next time (after signing in to MiddleCat again), no confirmation is needed
    const { path: again } = await authorizeParams({ state: "s2" });
    const second = await fetchWorker(again, { headers: { cookie: await signIn("u-consent", "consent@example.com") } });
    expect(second.status).toBe(302);
    const location = new URL(second.headers.get("location")!);
    expect(location.origin + location.pathname).toBe(REDIRECT);
    expect(location.searchParams.get("code")).toBeTruthy();
    expect(location.searchParams.get("state")).toBe("s2");

    // prompt=consent asks again
    const { path: consentAgain } = await authorizeParams({ prompt: "consent" });
    const third = await fetchWorker(consentAgain, { headers: { cookie: await signIn("u-consent", "consent@example.com") } });
    expect(third.status).toBe(200);
    expect(await third.text()).toContain("will receive your name and email address");
  });

  it("ends the MiddleCat login when the server gets its code", async () => {
    const user = await signIn("u-once", "once@example.com");
    const { path } = await authorizeParams();
    const res = await confirm(path, user);
    expect(res.status).toBe(303);
    expect(res.headers.getSetCookie().some((c) => c.startsWith("better-auth.session_token=;"))).toBe(true);
    const logins = await env.DB1.prepare("SELECT count(*) AS n FROM session WHERE userId = 'u-once'").first<{ n: number }>();
    expect(logins!.n).toBe(0);
    // signing in to the server again requires signing in to MiddleCat again
    const { path: again } = await authorizeParams();
    const next = await fetchWorker(again, { headers: { cookie: user } });
    expect(await next.text()).toContain("Sign in with");
  });

  it("rejects confirmation POSTs from other origins", async () => {
    const { path } = await authorizeParams();
    const headers = { cookie, "content-type": "application/x-www-form-urlencoded" };
    expect((await fetchWorker(path, { method: "POST", headers: { ...headers, origin: "https://evil.example" } })).status).toBe(403);
    expect((await fetchWorker(path, { method: "POST", headers })).status).toBe(403);
  });

  it("returns login_required and consent_required errors for prompt=none", async () => {
    const { path } = await authorizeParams({ prompt: "none", state: "x" });
    const notSignedIn = await fetchWorker(path);
    expect(notSignedIn.status).toBe(302);
    const loc = new URL(notSignedIn.headers.get("location")!);
    expect(loc.searchParams.get("error")).toBe("login_required");
    expect(loc.searchParams.get("state")).toBe("x");

    const user = await signIn("u-none", "none@example.com");
    const notConfirmed = await fetchWorker(path, { headers: { cookie: user } });
    expect(new URL(notConfirmed.headers.get("location")!).searchParams.get("error")).toBe("consent_required");
  });

  it("asks to sign in again for prompt=login, and returns without it", async () => {
    const { path } = await authorizeParams({ prompt: "login" });
    const res = await fetchWorker(path, { headers: { cookie } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("asks you to sign in again");
    const callback = /data-callback-url="([^"]+)"/.exec(html)![1].replace(/&amp;/g, "&");
    expect(callback.startsWith("/authorize?")).toBe(true);
    expect(new URL(callback, BASE).searchParams.has("prompt")).toBe(false);
  });

  it("asks to sign in again when the login is older than max_age", async () => {
    await getCode({}, await signIn("u-old", "old@example.com")); // confirm the server
    const user = await signIn("u-old", "old@example.com", { loginAgoMs: 2 * 3600_000 });
    const { path: strict } = await authorizeParams({ max_age: "300" });
    const res = await fetchWorker(strict, { headers: { cookie: user } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("asks you to sign in again");

    const { path: lenient } = await authorizeParams({ max_age: String(3 * 3600) });
    expect((await fetchWorker(lenient, { headers: { cookie: user } })).status).toBe(302);
  });

  it("refuses users without a verified email address", async () => {
    const user = await signIn("u-unverified", "unverified@example.com", { verified: false });
    const { path } = await authorizeParams();
    const res = await fetchWorker(path, { headers: { cookie: user } });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("is not verified");
    expect((await confirm(path, user)).status).toBe(400);
  });
});

describe("/api/token", () => {
  it("issues standard OIDC tokens", async () => {
    const { code, verifier } = await getCode({ nonce: "n-1", scope: "openid profile email" });
    const t = await token({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT,
      client_id: CLIENT,
    });
    expect(t.status).toBe(200);
    const id = claims(t.body.id_token);
    expect(id).toMatchObject({ aud: CLIENT, iss: BASE, nonce: "n-1", sub: "test@example.com", email_verified: true });
    expect(id.sid).toBe(t.body.refresh_token.split(".")[0]);
    expect(typeof id.auth_time).toBe("number");
    const access = claims(t.body.access_token);
    expect(access).toMatchObject({ aud: RESOURCE, azp: CLIENT, iss: BASE, email: "test@example.com", email_verified: true });
    expect(access.auth_time).toBe(id.auth_time);

    const userinfo = await fetchWorker("/api/userinfo", { headers: { authorization: `Bearer ${t.body.access_token}` } });
    expect(await userinfo.json()).toMatchObject({ sub: "test@example.com", email: "test@example.com", name: "Test User" });
    const idAsAccess = await fetchWorker("/api/userinfo", { headers: { authorization: `Bearer ${t.body.id_token}` } });
    expect(idAsAccess.status).toBe(401);
  });

  it("kills the session when a code is replayed", async () => {
    const { code, verifier } = await getCode();
    const first = await token({ grant_type: "authorization_code", code, code_verifier: verifier });
    expect(first.status).toBe(200);
    expect((await token({ grant_type: "authorization_code", code, code_verifier: verifier })).status).toBe(400);
    expect((await token({ grant_type: "refresh_token", refresh_token: first.body.refresh_token })).status).toBe(400);
  });

  it("rejects a wrong redirect_uri or client_id at token exchange, and kills the code", async () => {
    const wrongValues: Record<string, string>[] = [
      { redirect_uri: "https://amcat.example/api/other" },
      { client_id: "https://other.example" },
    ];
    for (const wrong of wrongValues) {
      const { code, verifier } = await getCode();
      const res = await token({ grant_type: "authorization_code", code, code_verifier: verifier, ...wrong });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_grant");
      expect((await token({ grant_type: "authorization_code", code, code_verifier: verifier })).status).toBe(400);
    }
  });

  it("rejects a wrong code_verifier", async () => {
    const { code } = await getCode();
    const res = await token({ grant_type: "authorization_code", code, code_verifier: (await pkce()).verifier });
    expect(res.status).toBe(400);
  });

  it("kills the session when an old refresh token is reused", async () => {
    const t0 = await session();
    const t1 = await token({ grant_type: "refresh_token", refresh_token: t0.refresh_token });
    expect(t1.status).toBe(200);
    expect(t1.body.refresh_token).not.toBe(t0.refresh_token);
    const t2 = await token({ grant_type: "refresh_token", refresh_token: t1.body.refresh_token });
    expect(t2.status).toBe(200);
    // t0 is neither the current nor the previous token anymore
    expect((await token({ grant_type: "refresh_token", refresh_token: t0.refresh_token })).status).toBe(400);
    expect((await token({ grant_type: "refresh_token", refresh_token: t2.body.refresh_token })).status).toBe(400);
  });

  it("doesn't store email addresses or tokens in the clear", async () => {
    const { code, verifier } = await getCode();
    const t = await token({ grant_type: "authorization_code", code, code_verifier: verifier });
    const [id, refreshToken] = t.body.refresh_token.split(".");
    const row = await env.DB1.prepare("SELECT * FROM serverSession WHERE id = ?").bind(id).first();
    const stored = JSON.stringify(row);
    expect(stored).not.toContain("test@example.com");
    expect(stored).not.toContain("Test User");
    expect(stored).not.toContain(refreshToken);
    expect(stored).not.toContain(code.split(".")[1]);
  });
});

describe("refresh token grace period", () => {
  it("gives concurrent refreshes with the same token the same new token", async () => {
    const t0 = (await session()).refresh_token;
    const results = await Promise.all([1, 2, 3].map(() => token({ grant_type: "refresh_token", refresh_token: t0 })));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    const tokens = new Set(results.map((r) => r.body.refresh_token));
    expect(tokens.size).toBe(1);
    const [t1] = tokens;
    expect(t1).not.toBe(t0);
    expect((await token({ grant_type: "refresh_token", refresh_token: t1 })).status).toBe(200);
  });

  it("returns the same new token when the previous token is reused within the grace period", async () => {
    const t0 = (await session()).refresh_token;
    const first = await token({ grant_type: "refresh_token", refresh_token: t0 });
    const again = await token({ grant_type: "refresh_token", refresh_token: t0 });
    expect(again.status).toBe(200);
    expect(again.body.refresh_token).toBe(first.body.refresh_token);
    expect(claims(again.body.access_token).email).toBe("test@example.com");
  });

  it("kills the session when the previous token is reused after the grace period", async () => {
    const t0 = (await session()).refresh_token;
    const first = await token({ grant_type: "refresh_token", refresh_token: t0 });
    await env.DB1.prepare("UPDATE serverSession SET rotatedAt = rotatedAt - ? WHERE id = ?")
      .bind((settings.refresh_grace_seconds + 60) * 1000, t0.split(".")[0])
      .run();
    expect((await token({ grant_type: "refresh_token", refresh_token: t0 })).status).toBe(400);
    expect((await token({ grant_type: "refresh_token", refresh_token: first.body.refresh_token })).status).toBe(400);
  });
});

describe("revocation and logout", () => {
  it("revokes a refresh token (RFC 7009)", async () => {
    const t = await session();
    const revoke = (value: string) =>
      fetchWorker("/api/revoke", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: value }).toString(),
      });
    expect((await revoke("not-a-token")).status).toBe(200);
    expect((await revoke(t.refresh_token)).status).toBe(200);
    expect((await token({ grant_type: "refresh_token", refresh_token: t.refresh_token })).status).toBe(400);
  });

  it("logs out with an id_token_hint: ends the server session and the MiddleCat login", async () => {
    const t = await session(await signIn("u-logout", "logout@example.com"));
    const user = await signIn("u-logout", "logout@example.com");
    const params = new URLSearchParams({
      id_token_hint: t.id_token,
      post_logout_redirect_uri: "https://amcat.example/",
      state: "bye",
    });
    const res = await fetchWorker(`/logout?${params}`, { headers: { cookie: user } });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://amcat.example/?state=bye");
    expect((await token({ grant_type: "refresh_token", refresh_token: t.refresh_token })).status).toBe(400);
    const loggedIn = await env.DB1.prepare("SELECT count(*) AS n FROM session WHERE userId = 'u-logout'").first<{
      n: number;
    }>();
    expect(loggedIn!.n).toBe(0);
  });

  it("doesn't redirect to another origin after logout", async () => {
    const t = await session();
    const params = new URLSearchParams({ id_token_hint: t.id_token, post_logout_redirect_uri: "https://evil.example/" });
    const res = await fetchWorker(`/logout?${params}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("You are signed out");
  });

  it("asks for confirmation without an id_token_hint", async () => {
    const user = await signIn("u-logout2", "logout2@example.com");
    const res = await fetchWorker("/logout?post_logout_redirect_uri=https://amcat.example/", { headers: { cookie: user } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Sign out of MiddleCat?");
    const count = () =>
      env.DB1.prepare("SELECT count(*) AS n FROM session WHERE userId = 'u-logout2'").first<{ n: number }>();
    expect((await count())!.n).toBe(1);
    // the confirmation form only works from MiddleCat itself
    const cross = await fetchWorker("/logout", {
      method: "POST",
      headers: { cookie: user, origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" },
      body: "confirm=1",
    });
    expect(await cross.text()).toContain("Sign out of MiddleCat?");
    expect((await count())!.n).toBe(1);
  });
});

describe("dashboard", () => {
  it("lists sessions per server, ends sessions and forgets servers", async () => {
    const t = await session(await signIn("u-dash", "dash@example.com"));
    const user = await signIn("u-dash", "dash@example.com");
    const list = async () => {
      const res = await fetchWorker("/api/sessions", { headers: { cookie: user } });
      const body = (await res.json()) as { servers: { server: string; confirmed: boolean; sessions: { id: string }[] }[] };
      return body.servers;
    };
    const servers = await list();
    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({ server: "https://amcat.example", confirmed: true });
    expect(servers[0].sessions.map((s) => s.id)).toEqual([t.refresh_token.split(".")[0]]);

    const del = await fetchWorker(`/api/sessions/${servers[0].sessions[0].id}`, {
      method: "DELETE",
      headers: { cookie: user, origin: BASE },
    });
    expect(del.status).toBe(200);
    expect((await token({ grant_type: "refresh_token", refresh_token: t.refresh_token })).status).toBe(400);

    const forget = await fetchWorker(`/api/servers/${encodeURIComponent("https://amcat.example")}`, {
      method: "DELETE",
      headers: { cookie: user, origin: BASE },
    });
    expect(forget.status).toBe(200);
    expect(await list()).toHaveLength(0);
    // confirmation is asked again
    const { path } = await authorizeParams();
    const res = await fetchWorker(path, { headers: { cookie: user } });
    expect(await res.text()).toContain("will receive your name and email address");
  });

  it("requires sign-in, and same origin for changes", async () => {
    expect((await fetchWorker("/api/sessions")).status).toBe(401);
    const cross = await fetchWorker("/api/sessions/x", { method: "DELETE", headers: { cookie, origin: "https://evil.example" } });
    expect(cross.status).toBe(403);
  });
});

describe("login limits", () => {
  const e = env as unknown as Bindings;
  const day = () => new Date().toISOString().slice(0, 10);

  it("limits logins per server on the free tier", async () => {
    const server = "https://busy.example";
    await env.DB1.prepare("INSERT OR REPLACE INTO usageCounter (bucket, day, count) VALUES (?, ?, ?)")
      .bind(`server:${server}:email`, day(), settings.limits.perServer.email)
      .run();
    expect(await countLogin(e, "email", server)).toContain("daily login limit");
    expect(await countLogin(e, "github", server)).toBeNull();
  });

  it("uses a server's own budget instead of the free tier", async () => {
    const server = "https://approved.example";
    await env.DB1.prepare(
      "INSERT INTO serverBudget (server, emailPerDay, socialPerDay, approvedBy, approvedAt) VALUES (?, 1000, 1000, 'admin', 0)",
    )
      .bind(server)
      .run();
    await env.DB1.prepare("INSERT OR REPLACE INTO usageCounter (bucket, day, count) VALUES (?, ?, ?)")
      .bind(`server:${server}:email`, day(), settings.limits.perServer.email + 10)
      .run();
    const globalCount = () =>
      env.DB1.prepare("SELECT count FROM usageCounter WHERE bucket = 'global:email'").first<{ count: number }>();
    const before = (await globalCount())?.count ?? 0;
    expect(await countLogin(e, "email", server)).toBeNull();
    expect((await globalCount())?.count ?? 0).toBe(before);
  });

  it("enforces the global free-tier limit on sign-in, with a clear message", async () => {
    await env.DB1.prepare("INSERT OR REPLACE INTO usageCounter (bucket, day, count) VALUES ('global:github', ?, ?)")
      .bind(day(), settings.limits.global.github)
      .run();
    const res = await fetchWorker("/api/auth/sign-in/social", {
      method: "POST",
      headers: { origin: BASE, "content-type": "application/json" },
      body: JSON.stringify({ provider: "github", callbackURL: "/" }),
    });
    expect(res.status).toBe(429);
    expect(((await res.json()) as { message: string }).message).toContain("free tier is at capacity");
  });
});

describe("cleanup", () => {
  it("deletes users without an active MiddleCat login, and expired sessions", async () => {
    await signIn("u-active", "active@example.com");
    await signIn("u-inactive", "inactive@example.com");
    await env.DB1.prepare("UPDATE session SET expiresAt = ? WHERE userId = 'u-inactive'").bind(Date.now() - 1000).run();
    const t = await session();
    const id = t.refresh_token.split(".")[0];
    await env.DB1.prepare("UPDATE serverSession SET expires = ? WHERE id = ?").bind(Date.now() - 1000, id).run();

    await cleanup(env as unknown as Bindings);

    const users = await env.DB1.prepare("SELECT id FROM user WHERE id IN ('u-active', 'u-inactive')").all();
    expect(users.results.map((r) => r.id)).toEqual(["u-active"]);
    expect(await env.DB1.prepare("SELECT id FROM serverSession WHERE id = ?").bind(id).first()).toBeNull();
  });
});

describe("admin", () => {
  it("is only available to admins, who can set budgets", async () => {
    expect((await fetchWorker("/admin", { headers: { cookie } })).status).toBe(404);
    const admin = await signIn("u-admin", "admin@example.com");
    expect((await fetchWorker("/admin", { headers: { cookie: admin } })).status).toBe(200);
    const res = await fetchWorker("/admin/budget", {
      method: "POST",
      headers: { cookie: admin, origin: BASE, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ server: "https://big.example/api", emailPerDay: "500", socialPerDay: "5000" }).toString(),
    });
    expect(res.status).toBe(303);
    const row = await env.DB1.prepare("SELECT * FROM serverBudget WHERE server = 'https://big.example'").first();
    expect(row).toMatchObject({ emailPerDay: 500, socialPerDay: 5000, approvedBy: "admin@example.com" });
  });
});

describe("discovery", () => {
  it("serves openid-configuration with all endpoints", async () => {
    const res = await fetchWorker("/.well-known/openid-configuration");
    const config = (await res.json()) as Record<string, unknown>;
    expect(config).toMatchObject({
      issuer: BASE,
      authorization_endpoint: `${BASE}/authorize`,
      token_endpoint: `${BASE}/api/token`,
      revocation_endpoint: `${BASE}/api/revoke`,
      end_session_endpoint: `${BASE}/logout`,
      code_challenge_methods_supported: ["S256"],
    });
  });

  it("serves a jwks that contains the signing key", async () => {
    const res = await fetchWorker("/.well-known/jwks");
    const { keys } = (await res.json()) as { keys: { kid: string }[] };
    const t = await session();
    const header = JSON.parse(atob(t.access_token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")));
    expect(keys.map((k) => k.kid)).toContain(header.kid);
  });
});
