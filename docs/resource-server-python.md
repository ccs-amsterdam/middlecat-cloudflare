# Using MiddleCat from a Python resource server (AmCAT)

MiddleCat is a regular OIDC provider. A resource server such as AmCAT uses it like any other provider:
set `oidc_url` to the MiddleCat URL, and verify tokens the standard way:

1. Get the provider metadata from `[issuer]/.well-known/openid-configuration` (endpoints and `jwks_uri`).
2. Get the public keys from `jwks_uri` (standard JWKS).
3. Verify each token with the key matching the `kid` in its header, and validate `iss`, `aud` and `exp`.

The MiddleCat-specific approach (`middlecat_url`, the public key from `/api/configuration`, classic tokens) is legacy.

## Key rotation

MiddleCat rotates its signing keys every 30 days. The JWKS contains the next, current and previous keys: a new key
is published 30 days before it signs, and an old key stays published until its tokens have expired. A verifier
handles this if it:

- looks up keys by `kid`, and never hardcodes or pins a key;
- caches the JWKS for a short time (5 minutes), not forever;
- refetches the JWKS when it sees an unknown `kid`, at most once per 30 seconds (so random `kid`s can't make it
  hammer the provider).

After an emergency rotation (all keys revoked), tokens with a new `kid` trigger a refetch, and the revoked keys
are gone from the JWKS within the cache time.

## What to check

| Check | Why |
|---|---|
| Signature with the key for the token's `kid`, algorithm `RS256` only | Never accept the algorithm from the token itself |
| `exp` | Access tokens live 10 to 60 minutes |
| `iss` equals the issuer (the MiddleCat URL, no trailing slash) | The token comes from the provider you trust |
| **`aud` equals this server's resource URL** | **Essential.** One MiddleCat serves many servers. The audience stops a client that a user authorized for another server from using that token on yours. It must be exactly the `resource` the client requested (AmCAT requests `[host]/api`). |

MiddleCat access tokens contain the user's email as `sub` and `email`, and their name as `name`.

## Verifier

Uses [joserfc](https://jose.authlib.org) (the successor of `authlib.jose`, which is deprecated) and `httpx`:

```
pip install joserfc httpx
```

```python
import asyncio
import time
from typing import Any

import httpx
from joserfc import jws, jwt
from joserfc.errors import JoseError
from joserfc.jwk import KeySet


class InvalidToken(ValueError):
    pass


class OIDCVerifier:
    """
    Verify access tokens from an OIDC provider (MiddleCat or any other), with support for key rotation:
    the JWKS is cached for a few minutes and refetched when a token has an unknown kid.
    """

    METADATA_TTL = 3600  # seconds
    JWKS_TTL = 300  # keep short, so revoked keys aren't trusted for long
    REFETCH_COOLDOWN = 30  # minimum time between refetches for unknown kids

    def __init__(self, issuer: str, audience: str, http: httpx.AsyncClient):
        self.issuer = issuer.rstrip("/")
        self.audience = audience
        self.http = http
        self._metadata: dict[str, Any] | None = None
        self._metadata_fetched = 0.0
        self._keys: KeySet | None = None
        self._keys_fetched = 0.0
        self._lock = asyncio.Lock()

    async def metadata(self) -> dict[str, Any]:
        """The provider's discovery document (endpoints, jwks_uri, ...)"""
        if self._metadata is None or time.monotonic() - self._metadata_fetched > self.METADATA_TTL:
            r = await self.http.get(f"{self.issuer}/.well-known/openid-configuration")
            r.raise_for_status()
            metadata = r.json()
            if metadata.get("issuer") != self.issuer:
                raise InvalidToken(f"Provider reports issuer {metadata.get('issuer')}, expected {self.issuer}")
            self._metadata, self._metadata_fetched = metadata, time.monotonic()
        return self._metadata

    async def _key_set(self, kid: str | None) -> KeySet:
        async with self._lock:
            age = time.monotonic() - self._keys_fetched
            expired = self._keys is None or age > self.JWKS_TTL
            unknown_kid = self._keys is not None and kid is not None and not _has_kid(self._keys, kid)
            if expired or (unknown_kid and age > self.REFETCH_COOLDOWN):
                r = await self.http.get((await self.metadata())["jwks_uri"])
                r.raise_for_status()
                self._keys, self._keys_fetched = KeySet.import_key_set(r.json()), time.monotonic()
            assert self._keys is not None
            return self._keys

    async def verify(self, token: str) -> dict[str, Any]:
        """Return the claims of a valid access token, or raise InvalidToken"""
        try:
            kid = jws.extract_compact(token.encode()).headers().get("kid")
            keys = await self._key_set(kid)
            if kid is not None and not _has_kid(keys, kid):
                raise InvalidToken(f"Unknown signing key {kid}")
            decoded = jwt.decode(token, keys, algorithms=["RS256"])
            # decode() only checks the signature. The claims must be validated explicitly.
            jwt.JWTClaimsRegistry(
                leeway=30,
                iss={"essential": True, "value": self.issuer},
                aud={"essential": True, "value": self.audience},
                exp={"essential": True},
            ).validate(decoded.claims)
        except JoseError as e:
            raise InvalidToken(str(e)) from e
        return decoded.claims


def _has_kid(keys: KeySet, kid: str) -> bool:
    try:
        keys.get_by_kid(kid)
        return True
    except (ValueError, KeyError, JoseError):
        return False
```

Usage in AmCAT:

```python
verifier = OIDCVerifier(issuer=settings.oidc_url, audience=settings.host.rstrip("/") + "/api", http=http())
endpoints = await verifier.metadata()   # authorization_endpoint, token_endpoint, ...
claims = await verifier.verify(access_token)
email = claims["email"]
```

This code was tested against MiddleCat: valid tokens pass; tokens for another server (`aud`), tampered tokens and
garbage are rejected; an unknown `kid` triggers a refetch after the cooldown and is rejected within it.

## Changes needed in AmCAT

These came out of running AmCAT's OIDC code paths (`backend/amcat4/auth/oauth.py`, `backend/amcat4/api/auth_helpers.py`,
master as of 2026-10-25) against MiddleCat.

1. **Verify claims, and use the actual keys** (`auth_helpers.verify_oidc_token`). Today:
   - `get_oidc_jwks()` returns the `jwks_uri` *string*, which is then passed to authlib as the key. authlib tries to
     read it as a PEM key and fails ("Unable to load PEM file"), so every OIDC token is rejected.
   - Even with the right keys, authlib's `JsonWebToken.decode()` only checks the signature. Claims are only validated
     by calling `claims.validate()`, which is never called. So `exp`, `iss` and `aud` are not checked: **tokens issued
     for other servers would be accepted**.
   - `aud` is compared with `host`, but `oauth_login` requests `resource=[host]/api`, so MiddleCat sets `aud` to
     `[host]/api`. Compare with `[host]/api` (as `verify_middlecat_token` already does).
   - `@alru_cache(maxsize=1)` caches the metadata and keys forever, so key rotation would break verification.

   Replace both functions with the `OIDCVerifier` above.
2. **Use discovery for the endpoints** (`oauth.py`, there's a TODO for this). Today `OIDC_URL` itself is used as the
   authorization endpoint *and* the token endpoint. Use `authorization_endpoint` and `token_endpoint` from
   `await verifier.metadata()`. (For MiddleCat these are `[issuer]/authorize` and `[issuer]/api/token`.)
   Also URL-encode the authorization parameters (`urlencode(params)`); `oauth_login` currently joins them unencoded.
3. **Send the same `redirect_uri` in the token exchange as in the authorization request** (`oauth_callback`).
   Login uses `[host]/api/auth/callback`, but the token exchange sends `[client_url]/auth/callback`. MiddleCat
   rejects this with `invalid_grant` and invalidates the code (tested). Other strict providers reject it too.
4. **Logout** (`oauth_logout`): `[OIDC_URL]/logout` is not a standard path. Use `end_session_endpoint` from
   discovery (MiddleCat has one), with `id_token_hint` and `post_logout_redirect_uri` (on the server's own origin).
   MiddleCat then ends the session and the MiddleCat login, and redirects back. If the provider has a
   `revocation_endpoint`, also revoke the refresh token there (`POST token=<refresh_token>`).
5. **Configuration**:
   - `oidc_url` = the MiddleCat URL without trailing slash (it must equal the token `iss`).
   - `oidc_client_id` = `host`. MiddleCat requires the `client_id` to be the server's own URL, and the `redirect_uri`
     to be on the same origin, within the `resource` path (`[host]/api/auth/callback` is). No registration is needed.
   - No client secret is needed: MiddleCat clients are public clients (PKCE). Leave `oidc_client_secret` empty;
     MiddleCat ignores a `client_secret` if one is sent.
   - Minor: `if OIDC_URL and not (OIDC_ID or OIDC_SECRET)` only raises when *both* are missing, while the
     message says both are required.
6. **Email claim**: MiddleCat access tokens include `email`. Some other providers don't (e.g. Auth0 by default).
   For those, get the email from the `userinfo_endpoint` instead of failing.
7. **Check `email_verified`.** AmCAT identifies users by email, so it must only accept verified addresses. Some
   providers let users enter any address (e.g. Auth0 with email/password signup, unless verification is enforced), so
   someone could sign up with another person's address. Reject tokens (or userinfo responses) without
   `email_verified: true`. MiddleCat only issues tokens for verified addresses and includes the claim.

With fixes 1 to 3, AmCAT's OIDC login was tested end to end against MiddleCat (authorization, token exchange,
refresh, and concurrent refreshes as from several browser tabs).

Optional: for high-stakes actions (e.g. deleting an index), AmCAT can ask the user to sign in again by starting a login
with `max_age=300` (or `prompt=login`), and checking that the id_token's `auth_time` is recent.

## Legacy MiddleCat

The original MiddleCat (at https://middlecat.net) keeps running for existing servers that use `middlecat_url`. New servers
use the new MiddleCat as a regular OIDC provider (`oidc_url`). Both use their own signing keys, so nothing changes for
existing servers.
