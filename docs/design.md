# MiddleCat design decisions

MiddleCat is the default login for new AmCAT servers: a standard OIDC provider that works without registration.
Serious servers are pointed to an established provider (institutional login, Auth0, Authentik, ...).
These are the decisions behind it, and why.

## Scope: servers only sign users in to themselves
- The OIDC client is the server's own backend, on the same origin as the server (AmCAT: client `https://amcat.nl`,
  resource `https://amcat.nl/api`). `redirect_uri` must be on that origin, within the resource path; `client_id` must
  be the server's URL (`src/lib/authorizeRequest.ts`).
- This is what makes registration unnecessary: codes can only be delivered to the server that the tokens are for,
  and PKCE ties them to the request that started the login. There are no client secrets (servers are public clients).
- No third-party clients, no native apps over localhost, no MiddleCat API keys. R/Python clients use AmCAT's own API keys.

## No registration, but budgets
- Unregistered servers work out of the box. The user confirms signing in to a server once (remembered per server).
- The free tier has hard daily limits (global, and per server). Admins can give a server a dedicated budget
  (`/admin`). No ownership proof is needed: a budget only applies to logins for that origin, which only that server can use.
- Logins are counted when they start (Better Auth `before` hook), attributed to a server via the `/authorize` callback URL.

## Not built (deliberately)
- Multi-factor authentication, server-owner roles, account recovery. Servers that need these should use an
  established provider; AmCAT's OIDC support makes switching a configuration change.
- Per-server signing keys: one issuer has one JWKS. Separation between servers comes from `aud`, which servers must check.

## Tokens
- Standard OIDC: access token (JWT, `typ: at+jwt`, `aud` = resource, `email`, `email_verified`, `auth_time`), id_token
  (`aud` = client_id, `sid`, `nonce`), rotating refresh tokens. Discovery, JWKS, userinfo, revocation (RFC 7009),
  RP-initiated logout, `prompt` (none/login/consent) and `max_age`.
- Only verified email addresses are passed on (AmCAT identifies users by email).
- Refresh token rotation with a 60 second grace period: reusing the previous token returns the same new token
  (concurrent refreshes from several tabs), any other reuse ends the session.
- Signing keys rotate every 30 days on a fixed schedule (one key per period, published a period ahead), stored encrypted
  with `KEY_ENCRYPTION_SECRET` (`src/lib/keys.ts`).

## Storing as little as possible
- Users don't stay signed in to MiddleCat: the login ends when a server receives its code (so on a shared computer, the
  next person can't sign in to servers as them), and dashboard logins end after 15 minutes without activity.
  Better Auth tables (the login to MiddleCat itself) are deleted within an hour after the login ends (hourly cron).
- Server sessions store the user's email, name and picture encrypted with a key derived from the current secret
  (authorization code, later the refresh token), of which only a hash is stored (`src/lib/secretBox.ts`). A database
  leak doesn't reveal who is signed in where. A keyed hash of the email (`src/lib/emailIndex.ts`) lets users list their
  sessions and remembers confirmed servers.

## Operations
- Single Hono worker on Cloudflare Workers with D1. Better Auth handles only the login to MiddleCat (GitHub, Google,
  magic link). Email via Cloudflare Email Service if configured, otherwise Resend.
- The legacy MiddleCat (Next.js, middlecat.net) keeps running for existing servers. This is a separate deployment with its
  own database and keys.
