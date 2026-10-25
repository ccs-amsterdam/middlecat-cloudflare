## Cat-in-the-middle authentication

MiddleCat is a login service for [AmCAT](https://github.com/ccs-amsterdam/amcat4) servers. It's a regular OpenID Connect (OIDC)
provider that works out of the box: a new AmCAT server can use it without registering anything, so you can try AmCAT
or run a small server without setting up authentication yourself. Users sign in with GitHub, Google or an email link.

MiddleCat has one restriction compared to a general-purpose OIDC provider: **a server can only sign users in to itself.**
The OIDC client is the server's own backend, on the same origin as the server (for AmCAT: the client is `https://amcat.nl`
and the server is `https://amcat.nl/api`). The backend runs the login flow and gives its frontend a session cookie.
That's how AmCAT is designed, and it's what makes client registration unnecessary when using MiddleCat for authentication (see [Security model](#security-model)).

## Why you probably shouldn't run your own MiddleCat

Middlecat is designed for easy onboarding of AmCAT servers, not for running your own OIDC provider. 

So if you do not want to use our MiddleCat server, you should not run your own MiddleCat server. Instead, you should use an established OIDC provider, like an institutional login (e.g. SURFconext in the Netherlands), a hosted provider like Auth0, or a self-hosted one like Authentik or Keycloak. 

# Using MiddleCat from a server

MiddleCat behaves like any OIDC provider. In AmCAT, set:

- `oidc_url`: the MiddleCat URL (without trailing slash). Everything else is found through discovery at
  `[oidc_url]/.well-known/openid-configuration`.
- `oidc_client_id`: the server's own URL (`host`). No client secret is needed.

What MiddleCat requires from a login request (authorization code flow):

- `client_id`: a URL with the same origin as the server.
- `resource`: the URL of the server's API (e.g. `https://amcat.nl/api`). This becomes the audience (`aud`) of the access token.
- `redirect_uri`: on the same origin, within the `resource` path (e.g. `https://amcat.nl/api/auth/callback`).
- PKCE with `S256`. A `state` (and `nonce` for the id_token) as usual.
- https, or http for servers on `localhost` (development).

Optional standard parameters: `prompt=none` (no user interaction: returns `login_required` or `consent_required` if needed;
since users don't stay signed in to MiddleCat, this usually returns `login_required`),
`prompt=login` (sign in again), `prompt=consent` (ask for confirmation again), and `max_age` (sign in again if the last login
is older). For high-stakes actions, a server can start a login with `max_age=300` and check `auth_time` in the id_token.

Tokens:

- The access token is a JWT with `iss` (the MiddleCat URL), `aud` (the `resource`), `sub` and `email` (the user's email),
  `email_verified`, `name`, `auth_time` and `exp`. It's valid for 10 minutes.
- The id_token also has `sid` (the session) and `picture`.
- Refresh tokens rotate (see [Security model](#security-model)). A session ends after 14 days without use.
- There's a userinfo endpoint, a token revocation endpoint (RFC 7009), and an end-session endpoint for logging out
  (RP-initiated logout, with `id_token_hint` and a `post_logout_redirect_uri` on the server's origin).

To verify tokens, a server must:

- get the keys from the `jwks_uri` in the discovery document, and pick the key by the token's `kid`. Keys rotate, so cache the
  JWKS for a few minutes and refetch it when a token has an unknown `kid`;
- check the signature (RS256), `exp`, `iss`, and **that `aud` is the server's own API URL**.

See [docs/resource-server-python.md](docs/resource-server-python.md) for a tested Python implementation, and the changes that
AmCAT's OIDC mode needs. [nextjs_demo_client](nextjs_demo_client) is a minimal example of a server that signs users in with
[openid-client](https://github.com/panva/openid-client).

## Limits

MiddleCat's free tier has daily limits (UTC days, see `src/lib/settings.ts`):

| | Everyone combined | Per server |
|---|---|---|
| Email logins | 1000 | 100 |
| GitHub logins | 5000 | 1000 (GitHub and Google combined) |
| Google logins | 5000 | |

A login counts when it starts (a sign-in email is sent, or the user goes to GitHub or Google). When a limit is reached,
users see a message saying so. Users who are already signed in, and token refreshes, are not affected.

If it's important that your users can always log in, ask the MiddleCat admins for a dedicated budget for your server.
A server with a budget only counts against its own budget, not against the free tier. There's nothing to register:
a budget applies to logins for the server's origin, which only that server can use.

# Security model

The login flow is the standard OIDC authorization code flow with PKCE. What a regular provider gets from client registration,
MiddleCat gets from the same-origin rule:

- **Codes only go to the server itself.** A registered client has fixed redirect URIs. In MiddleCat, the `redirect_uri` must be on the
  server's own origin, within its API path. A code can only ever be delivered to the server that the tokens are for, and PKCE ties it
  to the request that started the login. Codes can be used once, and when the server sends the `redirect_uri` again with the code exchange
  (as OIDC clients normally do), it must match.
- **Tokens only work at the server they're for.** The access token's `aud` is the server's API URL. One MiddleCat can serve many servers
  because a token for one server is rejected by the others, *provided that every server checks `aud`*.
- **A site can't pose as another site.** The `client_id` (the audience of the id_token) must be the server's own origin.

What is different from a regular provider:

- **No client secret.** Servers are public OIDC clients. For exchanging codes this doesn't matter (PKCE covers it). It does mean that
  a leaked refresh token can be used without also knowing a server secret. It still only gives access to that one server, and
  refresh tokens rotate, so using a stolen one is detected when the real user refreshes (see below), and ends the session.
- **Anyone can run a server.** MiddleCat doesn't vet servers, just as "Sign in with Google" works on any site. The first time a user
  signs in to a server, they see which server will receive their name and email address, and confirm. This is remembered per server.
- **No extra security features.** No multi-factor authentication, account recovery processes, audits or certifications. That's the
  real reason to use an established provider for serious servers.

Other measures:

- Only verified email addresses are passed on to servers. (GitHub accounts can have unverified addresses; those users have to
  verify the address at GitHub, or use another sign-in method.)
- Pages can't be framed (`frame-ancestors 'none'`, `X-Frame-Options: DENY`), so the sign-in confirmation can't be clickjacked.
  It's submitted with a same-origin form POST (CSRF protection).
- Signing keys rotate every 30 days, and are stored encrypted (see [Signing keys](#signing-keys)).
- Refresh tokens rotate. After a rotation, the previous token can be used again for 60 seconds and returns the same new token,
  so concurrent refreshes (e.g. from several browser tabs) don't break the session. Any other reuse of an old refresh token is
  treated as theft and ends the session.
- Authorization codes and refresh tokens are stored as SHA-256 hashes and compared in constant time.
- Logins are limited per day (see [Limits](#limits)) and email logins per IP address. `/authorize` and `/api/token` have burst limits.

## Personal data

MiddleCat stores as little as possible (see the privacy page at `/privacy`):

- Users don't stay signed in to MiddleCat: the MiddleCat login ends as soon as a server receives its code (signing in to a
  server again means signing in to MiddleCat again, which for GitHub and Google is usually just a redirect). On the
  dashboard, the login ends after 15 minutes without activity. Its data (email, name, picture, linked GitHub/Google account)
  is deleted within an hour after that.
- For each login at a server, the user's email, name and picture are encrypted with a key derived from the current refresh token
  (before that: the authorization code). MiddleCat only stores hashes of those tokens, so only the server holding the token can
  unlock them, when it refreshes. A keyed hash of the email address (HMAC) lets users find their sessions on the dashboard,
  and remembers which servers they confirmed.

Users can see and end their sessions, and "forget" servers, on the MiddleCat home page.

# Running MiddleCat

MiddleCat is a single [Hono](https://hono.dev) worker on Cloudflare Workers, with a D1 (SQLite) database.
Users sign in to MiddleCat itself with GitHub, Google or an email link, handled by [Better Auth](https://www.better-auth.com).
The OIDC provider part is MiddleCat's own code (`src/routes`, `src/lib`). See [docs/design.md](docs/design.md) for the design decisions.

## Install dependencies

```
pnpm install
```

## Set the environment variables

For local development the settings and secrets go in a `.dev.vars` file.
The easiest way to create this is to run `pnpm generate_env`, which generates the cryptographic secrets for you
(see `.dev.vars.example` for all options).

What you still need to add are the credentials for GitHub and/or Google login, and an email provider for email login.

```
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=[a big cryptographic pseudo random secret goes here]

KEY_ENCRYPTION_SECRET=[another big random secret, at least 32 characters]

GITHUB_ID=
GITHUB_SECRET=

GOOGLE_ID=
GOOGLE_SECRET=

EMAIL_FROM="MiddleCat <signin@yourdomain>"
RESEND_API_KEY=

MIDDLECAT_ADMINS=you@example.com
```

- `BETTER_AUTH_URL` is the public URL of your MiddleCat, and is used as the token issuer.
- `KEY_ENCRYPTION_SECRET` encrypts the token signing keys (MiddleCat creates and rotates them itself, see [Signing keys](#signing-keys)),
  and keys the email hashes. Changing it makes existing sessions disappear from users' dashboards, and servers ask for confirmation again.
- When you register the GitHub/Google OAuth apps, use `[BETTER_AUTH_URL]/api/auth/callback/github` and
  `[BETTER_AUTH_URL]/api/auth/callback/google` as callback URLs.
- Email: either enable Cloudflare Email Service (uncomment the `send_email` binding in `wrangler.jsonc`; this requires the Workers Paid
  plan and a domain onboarded to Cloudflare email) or set `RESEND_API_KEY`. Cloudflare is used if both are configured.
- `MIDDLECAT_ADMINS`: emails of the people who can open `/admin` (usage per server, and setting budgets).

## Local development

Wrangler emulates the D1 database locally. Apply the migrations:

```
pnpm migrate:up:local
```

Now run the dev server (on http://localhost:3000)

```
pnpm dev
```

(Email login only works with a configured email provider. The easiest way to test things is setting up a GitHub or Google ID.)

Run the tests with `pnpm test`.

## Deploying to Cloudflare

Create the D1 database (`pnpm exec wrangler d1 create middlecat_oidc`) and put its id in `wrangler.jsonc`.
Then set the secrets, apply the migrations and deploy:

```
pnpm exec wrangler secret put BETTER_AUTH_URL      # e.g. https://oidc.middlecat.net
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put KEY_ENCRYPTION_SECRET
pnpm exec wrangler secret put GITHUB_ID            # and GITHUB_SECRET, GOOGLE_ID, GOOGLE_SECRET, EMAIL_FROM, RESEND_API_KEY, MIDDLECAT_ADMINS
pnpm migrate:up
pnpm deploy
```

An hourly cron trigger rotates the signing keys and deletes expired data.

## Signing keys

MiddleCat manages its token signing keys itself (table `signingKey`):

- Every 30 days a new key starts signing. Each key is published in the JWKS (`/.well-known/jwks`) 30 days before it is used,
  and stays published until all tokens it signed have expired. Tokens carry the `kid` of their key.
- The cron trigger creates upcoming keys and removes old ones. Keys are also created on demand, so a fresh install just works.
- Private keys are encrypted with `KEY_ENCRYPTION_SECRET` (AES-GCM), so a database export doesn't contain usable keys.

**Emergency rotation** (e.g. a leaked key): run `pnpm keys:revoke`. All keys stop being published and used, and new keys are
created on the next request. Workers keep their loaded keys for up to 5 minutes, and servers cache the JWKS, so allow a few
minutes. If `KEY_ENCRYPTION_SECRET` itself leaked, set a new one (`wrangler secret put KEY_ENCRYPTION_SECRET`) and then run
`pnpm keys:revoke`. Until the revoke, token requests fail because the stored keys can't be decrypted.

## Legacy MiddleCat

The original MiddleCat (Next.js, at https://middlecat.net) keeps running for existing AmCAT servers that use it with `middlecat_url`.
This repository is the new MiddleCat, which new servers use as a regular OIDC provider. The two don't share data or keys.
