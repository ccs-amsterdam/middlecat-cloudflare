# AmCAT authentication: recommendation

## Context
AmCAT servers default to MiddleCat (a central, registration-free OIDC provider). Users will tend to stay on
MiddleCat even for sensitive data, so the default has to be as safe as possible. Question: should AmCAT do its
own auth, should MiddleCat/our hosted IdP add 2FA, or should AmCAT add its own second factor?

Currently, AmCAT stores the IdP's access and refresh tokens in an encrypted session cookie in the browser (14 days),
and MiddleCat keeps server-side sessions and refresh tokens.

## Main risk
MiddleCat (or any IdP we host) is a single issuer trusted by every default AmCAT server. If it is compromised
(signing key, `KEY_ENCRYPTION_SECRET`, Cloudflare account, npm/Better Auth supply chain, the email provider that
sends its sign-in links), the attacker can create a valid login for any email on every server. 2FA inside the IdP
(MiddleCat+2FA, or Authentik) doesn't help here: it protects the user's account at the IdP, not the servers from
the IdP. A "stateless MiddleCat that vouches for emails" has the same problem, because the signing key is still
what matters.

## Recommendation: OIDC for identity, AmCAT for sessions and the second factor
1. **Keep OIDC** as the only external interface (MiddleCat by default, any IdP for those who want one). Don't build
   email/social login into AmCAT: per-server SMTP and Google/GitHub OAuth apps would become required onboarding
   steps, which is exactly the friction MiddleCat removes. AmCAT only needs its own SMTP for the second factor (see
   below). Plain login never depends on it.
2. **AmCAT owns the session** (an RP/application session, separate from the IdP's session). This is worth doing
   whatever is decided about the second factor; see [Why AmCAT should own sessions](#why-amcat-should-own-sessions).
   Use the id_token once at login (verify `iss`, `aud`, `exp`, `nonce`, `email_verified`), then issue AmCAT's own
   session cookie (HttpOnly, Secure, SameSite, idle + absolute timeout). No refresh tokens from the IdP are needed.
   - Sessions are stored in the database (only a hash of the session token) and checked on every request, together
     with the role lookup that already happens. Revocation is immediate. Update `last_seen` (idle timeout) at most
     once a minute. If this becomes a performance issue, add a short cache of the combined auth+role lookup for
     non-sensitive requests.
   - The absolute timeout also bounds offboarding: when an institution disables an account at its IdP, the AmCAT
     session ends at the latest at the absolute timeout, and a new session needs a new IdP login.
3. **AmCAT requires a local second factor for roles the server specifies**, e.g. `require_local_factor = admin | writer | all`.
   - A MiddleCat compromise is then no longer enough: the attacker also needs the user's factor on that server.
   - **The second factor requires SMTP.** Enrollment and recovery happen through an email that AmCAT sends itself
     (see below). A server that sets `require_local_factor` without SMTP configured refuses to start, rather than
     quietly not enforcing it.
   - **Passkeys (WebAuthn)** are the factor. Tied to the server's own origin (fits the same-origin model), resists
     phishing, and the server only stores public keys. Passkeys now sync through password managers and the
     phone/OS account, so most users can use them without extra hardware. Python: `py_webauthn`, frontend:
     `@simplewebauthn/browser`.
   - **Passwords are an optional later addition** (phase 3, see [Phases](#phases)), only if users really ask for
     a fallback. Most of the complexity in this design comes from passwords (generated vs. own passwords, lockout,
     rate limiting, recovery by email), not from passkeys. Keep the factor code behind a small interface (`enroll`,
     `verify`) so a password factor can be added without changing the flows.
   - Adding a factor requires an existing one, so an attacker can't add a factor for someone else.
   - Users can register more than one passkey (e.g. one synced through a password manager and a hardware security
     key), and the screens encourage it. That covers most lost-factor cases without an admin.
   - Ask for the factor again (step-up) for: creating API keys, changing users/roles, adding or removing factors,
     deleting indexes, server settings.
   - Not in the first version: skipping the local factor when an organization's own IdP enforces MFA (`acr`/`amr`).
     It needs a second step-up path (re-login at the IdP with `prompt=login&max_age=0`) and `acr`/`amr` are claims
     made by the IdP itself, so it would only be acceptable for an IdP trusted as much as the server. If added later,
     make it a server-wide mode, not per user. It would also be the only way for a server without SMTP to get a
     second factor.
4. **Simplify MiddleCat** once AmCAT owns sessions: drop refresh tokens, server sessions, the session dashboard and
   revocation/end-session. What remains: login → confirmation → code → tokens, plus budgets and confirmed-servers.
   Less state, less code, smaller attack surface. Keep investing in operational hardening (hardware keys on
   Cloudflare/GitHub, pinned dependencies, few dependencies, short single-use magic links bound to the browser
   that asked for them, keep sign-in links out of email provider logs where possible).

## Why AmCAT should own sessions
Moving the session from the browser cookie into AmCAT's database is a small step, and it's the usual pattern for
web apps that log in through OIDC. It is useful even if AmCAT never gets a second factor:

- **Revocation.** Today a stolen session cookie stays valid until it expires. With database sessions, an admin or
  the user can end a session immediately (someone leaves a project, a laptop is stolen, suspicious activity).
- **The server sets its own timeouts**, e.g. shorter for admin roles, instead of depending on how each IdP handles
  token lifetimes and refresh tokens, which differs between providers.
- **Logs tied to users and sessions.** Every request belongs to a known session: which user, when they logged in,
  through which IdP, from which IP/browser. So an audit log can show who did what (deleted an index, changed a
  role, created an API key), and after an incident you can see exactly what one session did and end it. Users can
  see their own active sessions and recent logins.
- **MiddleCat becomes stateless.** No refresh tokens or sessions on MiddleCat means less to steal, less code, and
  lower Cloudflare costs. Of all the measures here, this reduces the impact of a MiddleCat compromise the most for
  servers without a second factor: the attacker can't take over existing sessions, only start new logins, which
  show up in each server's login log.
- **A MiddleCat outage** doesn't log anyone out or break token refreshes during the day.
- **A foundation for the rest:** step-up, the second factor, and API keys created from a session all need a session
  that AmCAT controls.

## Why not just trust the OIDC provider?
The simpler alternative is to rely fully on the IdP: warn that servers with sensitive data should use an IdP that
enforces 2FA, and use MiddleCat only for simple servers (or drop MiddleCat altogether). That is what most software
does, and it is a reasonable choice for a server that has such an IdP. As the default it falls short:

- **People stay on the default.** A warning in the docs doesn't change what a researcher does in practice.
- **"An IdP with 2FA" is hard to get for small servers.** Registering a server with an institution's login system
  (e.g. SURFconext) takes paperwork per server. With Google login, 2FA depends on whether the user turned it on.
  Running your own Keycloak or Authentik moves the complexity to every server admin, which is more work than AmCAT
  supporting passkeys once.
- **AmCAT can't check it.** Whether an IdP enforces 2FA is only visible through `acr`/`amr` claims, which IdPs
  don't fill in consistently. "Use an IdP with 2FA" stays advice that nobody can verify.
- **Dropping MiddleCat** solves the security problem, but removes the reason AmCAT is easy to start with.

What the OIDC provider is still for, once AmCAT has a second factor:
- It is used at **every login**, also for roles with a second factor: OIDC login + passkey. AmCAT's SMTP is only
  used to enroll or recover a factor, so a low-volume SMTP server is enough. The passkey protects against an IdP
  compromise, and the OIDC login protects against a stolen passkey: each covers for the other.
- **MiddleCat** proves control of a mailbox. AmCAT could do that itself by sending magic links, but then every login
  needs an email from every server. MiddleCat gives one login across servers, no per-login email, and no SMTP
  needed to get started. For roles without a second factor, it is all that's needed.
- **An institution's own IdP** adds more than identity: offboarding (someone who leaves can't log in anymore), the
  institution's own login rules, and later possibly its own MFA (`acr`/`amr`).
- Onboarding path: a server starts with MiddleCat and no setup. When it needs a second factor, it adds a small SMTP
  server and sets `require_local_factor`.

## Phases
Each phase is useful on its own, so it's possible to stop after any of them.

1. **AmCAT sessions and a stateless MiddleCat.**
   - AmCAT sessions in the database (see above), with a sessions overview for users and admins, and an audit log.
   - Remove refresh tokens and server sessions from MiddleCat.
   - Clearly document that servers with sensitive data need phase 2, or an IdP that enforces 2FA.
2. **Passkeys for roles that need a second factor.**
   - `require_local_factor`, SMTP settings, and refusing to start without SMTP when a factor is required.
   - Enrollment by email when the factor is first needed, multiple passkeys per user, admin reset, step-up, and
     notifications of factor changes.
   - No passwords, so no recovery by email.
3. **Later, only if users really ask for it: a password fallback.**
   - Generated passwords (optionally own passwords), with `allowed_factors` and `password_recovery`. See
     [Password fallback (phase 3)](#password-fallback-phase-3).

## Enrollment and recovery by email
Whoever first logs in as an email address could register its second factor (trust on first use). To close that gap,
enrolling requires two things from two independent parties: a valid OIDC login for that email **and** a one-time
link that AmCAT emailed to that address through its own SMTP. An attacker who can forge OIDC logins (e.g. via a
MiddleCat compromise) never sees that email.

- **Enrollment happens when it's first needed.** Roles are granted directly, also roles that require a second
  factor; there are no pending roles or invitation links. The first time a user without a factor does something
  that needs it, AmCAT says "check your email" and sends a setup link to the user's verified address. So the
  moment of enrollment doesn't depend on when someone was invited, and the inviter never handles a link.
- **The link.**
  - `https://<server>/enroll#<token>`. The fragment keeps the token out of server logs and Referer headers. The
    frontend passes it to the API.
  - Token: only a hash is stored, single use, expires after about an hour, tied to one email address. Requesting a
    new link invalidates the old one. Requests are rate-limited per user.
  - The link only works when logged in (via OIDC) as that same email. If it's opened in another browser, the user
    logs in there first. If the logged-in email differs, show a clear message ("this link is for x@uni.nl, you are
    logged in as y@uni.nl").
  - Email content: plain text, with the server URL and what the link does. Say that the link only works when logged
    in as that address, and that unexpected emails can be ignored.
- **SMTP settings.** The server's own SMTP (e.g. a university relay or a transactional mail service): host, port,
  username, password, from-address, STARTTLS/TLS. SPF/DKIM for the from-domain matter for deliverability. The same
  SMTP is used for notifications: the user gets an email whenever a factor is added, removed or recovered.
- **The first admin:** a CLI command on the server, e.g. `amcat4 enroll admin@uni.nl`, which sends the link, or
  prints it. Printing is fine here: shell access to the server is already fully trusted.
- **Guests** (access via `guest_role`, no explicit role) don't need a second factor.

### Recovery
- **Passkeys are never recovered by email.** A lost passkey goes through a server admin. The admin removes the
  user's factors (one button in the admin screen), and the next time the user needs a factor they enroll a new one
  through the normal email flow. The admin should confirm the request through another channel first (e.g. in
  person or by phone), because until the user re-enrolls, the mailbox is enough to enroll.
- The enrollment screen says: "for security reasons you can't reset a lost passkey yourself; recovery is only
  possible via the server administrators. Register a second passkey to avoid this."
- Later option, if admins on large servers become a bottleneck: a backup user who can start a reset for someone.
  The reset is the same as an admin reset (factors removed, the user re-enrolls through their own mailbox).
  Choosing a backup user requires the user's own factor. The backup user needs a second factor and confirms with it.
  The user is notified and the reset is logged. Possibly not for server admins.

### Password fallback (phase 3)
Only if users really ask for it. Design for when it's added:

- The enrollment form suggests a random password generated by AmCAT (about 128 bits, grouped for readability) and
  uses `autocomplete` attributes so the browser or password manager saves it for this server. Where the server
  allows it, users can choose their own password instead (minimum length, hashed with argon2, rate limiting and
  lockout).
- The server decides what's allowed:
  - `allowed_factors = passkey` or `passkey, password`;
  - whether own passwords are allowed, or only generated ones;
  - `password_recovery = email | admin`.
  The default stays passkeys only. Servers with sensitive data should stay on passkeys only, because a user's choice
  of factor protects the server's data, not just their own account. The security description for data stewards
  says which mode the server runs in.
- Within what the server allows, the user chooses at enrollment. Switching to another factor requires the current
  one, so an attacker can't pick a weaker factor for someone else. A generated password can also serve as a backup
  next to a passkey.
- **Recovery by email** (if `password_recovery = email`): the user logs in via OIDC, clicks "forgot password", and
  receives a link through the same flow as enrollment, which lets them set a new password.
  - Only available if **all** of the user's factors are passwords. If the user has any passkey, recovery goes
    through an admin. Otherwise someone with only the mailbox could use password recovery to get around a passkey.
  - Recovery ends all of the user's sessions, is logged, and the user is notified.
  - Consider not offering email recovery for the server admin role.
  - What this means: a password with email recovery is protection by **two parties** rather than two factors. It
    protects against a compromised IdP, but not against a compromised mailbox (for MiddleCat users, the mailbox gives
    both the OIDC login and the recovery email). A passkey, or a password with `password_recovery = admin`, protects
    against both. See the table below.
- With `password_recovery = admin`, a forgotten password goes through an admin like a lost passkey. Users can always
  change their password while logged in (with the current one).

## What this protects against
For a user with a role that requires a second factor and who has already enrolled one. "OIDC login" means a
MiddleCat magic link for MiddleCat users. The password columns only apply once the phase 3 fallback is added.

| Scenario | Passkey | Password, admin recovery | Password, email recovery |
|---|---|---|---|
| IdP compromised (e.g. MiddleCat's signing key, Cloudflare account, supply chain): attacker can forge a login for any email | Safe | Safe | Safe |
| User's mailbox compromised | Safe | Safe | **Not safe**: the attacker logs in via a magic link and recovers the password |
| AmCAT's SMTP compromised | Safe: the attacker gets links but still needs an OIDC login as the user | Safe | Safe |
| Phishing site that relays the login | Safe: passkeys are bound to the server's origin | **Partly**: a password typed into the fake site is lost; a saved generated password won't autofill on the wrong domain | **Partly**: same |
| Password reused from another leaked site | Safe | Safe with generated passwords; own passwords rely on rate limiting | Same |
| Leak of AmCAT's auth tables (e.g. a backup) | Safe: only public keys and hashed session tokens are stored | Session tokens are hashed. Generated passwords can't be cracked; own passwords can be attacked offline | Same |
| Malicious project admin, or a server admin's account taken over | Can change roles, but can't enroll or recover a factor for someone else: links only go to the user's own mailbox. Removing someone's factors is logged, and the user is notified | Same | Same |
| Session cookie stolen from the user's browser (infostealer) | **Not safe** until the session ends; limited by idle/absolute timeouts, step-up for sensitive actions, and revocation | Same | Same |
| Malware in control of the user's device | **Not safe** while the user is logged in | **Not safe** | **Not safe** |
| User lost or forgot the factor | Recovery via a server admin, or a second passkey | Recovery via a server admin | User recovers it themselves |
| The AmCAT server itself compromised | Out of scope: it holds the data | | |

Users who haven't enrolled a factor yet are protected against an IdP compromise (the attacker can't get the
enrollment email), but not against a compromised mailbox: the mailbox gives both the OIDC login and the enrollment
link. This is an accepted risk; it is limited to the window before enrollment (or after an admin reset).

Without a second factor (phase 1 only), an IdP compromise or a compromised mailbox is enough to log in as the user.
AmCAT sessions still limit the damage: existing sessions can't be taken over through MiddleCat, new logins show up
in the login log, and sessions can be ended immediately.

## Notes on the protocol
- AmCAT is a public OIDC client using PKCE, without a client secret, and MiddleCat uses the server's URL as
  `client_id`. That's in line with current specs (OAuth 2.1, PKCE, IndieAuth, the IETF draft "OAuth Client ID
  Metadata Document"). A secret wouldn't help against the main risk.
- Open point: without a secret, anyone can start logins attributed to a server, and logins are counted when they
  start, so a script could use up a server's budget or the free tier. Consider counting completed logins, or
  rate-limiting starts per IP.
- Session-cookie theft (infostealers) after login is not solved by any option. Device-bound cookies with a
  non-extractable WebCrypto key in IndexedDB were considered and dropped: the key is still stored in the browser
  profile, so copying the profile copies the key. Mitigate with short idle timeouts, step-up for sensitive actions,
  and API keys with expiry/scopes that can only be created with step-up.

## Rejected
- MiddleCat + 2FA: more state and responsibility, still a single point of failure for all servers.
- Hosted Authentik + CLI registration: same single point, more ops, more attack surface, and registration friction.
- AmCAT doing all auth itself: much more friction, and a central email verifier is still needed in practice.
- Relying fully on the IdP, with a warning to use one with 2FA for sensitive data: see
  [Why not just trust the OIDC provider?](#why-not-just-trust-the-oidc-provider). Still a valid choice per server,
  but not as the default.
- TOTP as a local factor: somewhat better than a password against phishing, but more work for users and to build
  (an encrypted shared secret, rate limiting, replay protection, QR enrollment). Passkeys are better for users and
  safer.
- A second factor without SMTP, where the inviter is shown the enrollment link and passes it on: the inviter then
  holds the link, so an inviter together with an OIDC compromise could enroll a factor for someone else. It also
  ties enrollment to the moment of invitation.
- Invitations with pending roles for roles that require a second factor: no longer needed once enrollment is done
  by email when the factor is first needed.
- Email recovery for passkeys, or for users who have a passkey: it would make the mailbox enough to get around the
  passkey.

## Next steps (when implementing)
- Phase 1:
  - AmCAT (`backend/amcat4/auth/`): sessions in the database after OIDC login, replacing the IdP tokens in the
    session cookie; a sessions overview with revocation; an audit log of logins, role changes, API key creation and
    other sensitive actions, tied to the session.
  - MiddleCat (`src/routes`, `src/lib`): remove refresh tokens/sessions after AmCAT no longer uses them; update
    README/design.md.
- Phase 2 (AmCAT):
  - Passkeys, the `require_local_factor` setting, SMTP settings, and refusing to start when a second factor is
    required without SMTP.
  - Enrollment by email, notifications of factor changes, admin factor reset, and the enroll CLI.
  - Step-up on sensitive endpoints.
  - Add factor changes, enrollment emails and step-ups to the audit log.
- Phase 3 (only if needed): the password fallback, `allowed_factors` and `password_recovery`.
- A one-page security description for data stewards. It covers:
  - where identity comes from;
  - the session and its timeouts;
  - the second factor for privileged roles (and, if added, which password mode and recovery mode is allowed);
  - step-up;
  - enrollment by email;
  - recovery;
  - what is logged;
  - the table above.
