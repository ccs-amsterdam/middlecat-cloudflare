import { Context, Hono } from "hono";
import { csrf } from "hono/csrf";
import { AppEnv } from "../env";
import { enabledProviders, getSignedIn, signOut } from "../auth";
import { AuthorizeError, AuthorizeRequest, parseAuthorizeRequest } from "../lib/authorizeRequest";
import { createAuthorizationCode } from "../lib/serverSessions";
import { addConsent, hasConsent } from "../lib/consent";
import { emailHash } from "../lib/emailIndex";
import { getCreatedOn } from "../lib/userAgent";
import { ErrorMsg, Layout } from "../views/layout";
import { SignIn } from "../views/signin";

// The authorization endpoint. A user signs in to MiddleCat, confirms signing in to the server once (remembered
// per server), and is sent back to the server with an authorization code.
// The confirmation is a same-origin form POST, and pages can't be framed (see secure headers in worker.ts).
const app = new Hono<AppEnv>();

app.use("/authorize", csrf());

type SignedIn = NonNullable<Awaited<ReturnType<typeof getSignedIn>>>;

function parse(url: string): { req?: AuthorizeRequest; error?: string } {
  const params = new URL(url).searchParams;
  const keys = [...params.keys()];
  // OAuth parameters must not be repeated (RFC 6749 section 3.1)
  if (new Set(keys).size !== keys.length) return { error: "Request parameters cannot be repeated" };
  try {
    return { req: parseAuthorizeRequest(Object.fromEntries(params)) };
  } catch (e) {
    if (e instanceof AuthorizeError) return { error: e.message };
    throw e;
  }
}

function authorizePath(url: string) {
  const { pathname, search } = new URL(url);
  return pathname + search;
}

/** Where to return after signing in: the same request, without prompt=login (or it would ask again) */
function afterSignInPath(url: string) {
  const u = new URL(url);
  const prompt = (u.searchParams.get("prompt") || "").split(" ").filter((p) => p && p !== "login");
  if (prompt.length) u.searchParams.set("prompt", prompt.join(" "));
  else u.searchParams.delete("prompt");
  return u.pathname + u.search;
}

function errorPage(c: Context<AppEnv>, title: string, message: string, status: 400 | 429 = 400) {
  return c.html(
    <Layout title="Sign in">
      <ErrorMsg type={title}>{message}</ErrorMsg>
    </Layout>,
    status,
  );
}

/** Send an OAuth error to the server (only after the redirect_uri was validated) */
function redirectError(c: Context<AppEnv>, req: AuthorizeRequest, error: string) {
  const redirect = new URL(req.redirectUri);
  redirect.searchParams.set("error", error);
  if (req.state !== undefined) redirect.searchParams.set("state", req.state);
  return c.redirect(redirect.toString(), 302);
}

async function rateLimited(c: Context<AppEnv>) {
  if (!c.env.RATE_LIMITER) return false;
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const { success } = await c.env.RATE_LIMITER.limit({ key: `authorize:${ip}` });
  return !success;
}

function loginTooOld(req: AuthorizeRequest, signedIn: SignedIn) {
  return req.maxAge !== undefined && Date.now() - signedIn.session.createdAt.getTime() > req.maxAge * 1000;
}

/**
 * Create the authorization code, and send the user back to the server with it. The MiddleCat login ends here:
 * staying signed in has little use, and on a shared computer the next person could sign in to servers as this user.
 */
async function issueCode(c: Context<AppEnv>, req: AuthorizeRequest, signedIn: SignedIn, status: 302 | 303) {
  const { user, session } = signedIn;
  const code = await createAuthorizationCode(
    c.env,
    req,
    { email: user.email, name: user.name, image: user.image ?? null },
    session.createdAt,
    getCreatedOn(c.req.raw),
  );
  for (const cookie of await signOut(c.env, c.req.raw.headers)) c.header("Set-Cookie", cookie, { append: true });
  const redirect = new URL(req.redirectUri);
  redirect.searchParams.set("code", code);
  if (req.state !== undefined) redirect.searchParams.set("state", req.state);
  return c.redirect(redirect.toString(), status);
}

const unverifiedMessage = (email: string) =>
  `Your email address (${email}) is not verified by the service you signed in with. ` +
  "Verify it there (e.g. in your GitHub email settings), or sign in with another method.";

app.get("/authorize", async (c) => {
  const { req, error } = parse(c.req.url);
  if (!req) return errorPage(c, "Invalid sign-in request", error!);
  if (await rateLimited(c)) return errorPage(c, "Too many requests", "Please try again in a minute.", 429);

  const signedIn = await getSignedIn(c.env, c.req.raw.headers);
  const reauthenticate = !!signedIn && (req.prompt.has("login") || loginTooOld(req, signedIn));
  if (!signedIn || reauthenticate) {
    if (req.prompt.has("none")) return redirectError(c, req, "login_required");
    return c.html(
      <Layout title="Sign in" scripts={["/signin.js"]}>
        <div class="AuthorizeContainer">
          <SignIn
            providers={enabledProviders(c.env)}
            callbackURL={afterSignInPath(c.req.url)}
            notice={reauthenticate ? `${req.resourceUrl.host} asks you to sign in again.` : undefined}
          />
        </div>
      </Layout>,
    );
  }

  if (!signedIn.user.emailVerified) {
    return errorPage(c, "Email address not verified", unverifiedMessage(signedIn.user.email));
  }

  const consented = await hasConsent(c.env, await emailHash(c.env, signedIn.user.email), req.server);
  if (!consented || req.prompt.has("consent")) {
    if (req.prompt.has("none")) return redirectError(c, req, "consent_required");
    return c.html(
      <Layout title="Sign in" scripts={["/signin.js"]}>
        <div class="AuthorizeContainer">
          <ConfirmSignIn req={req} user={signedIn.user} action={authorizePath(c.req.url)} />
        </div>
      </Layout>,
    );
  }

  return issueCode(c, req, signedIn, 302);
});

// The user confirmed signing in to the server
app.post("/authorize", async (c) => {
  const { req, error } = parse(c.req.url);
  if (!req) return errorPage(c, "Invalid sign-in request", error!);

  const signedIn = await getSignedIn(c.env, c.req.raw.headers);
  // MiddleCat login expired (or too old) between showing and submitting the form: start again
  if (!signedIn || loginTooOld(req, signedIn)) return c.redirect(authorizePath(c.req.url), 303);
  if (!signedIn.user.emailVerified) {
    return errorPage(c, "Email address not verified", unverifiedMessage(signedIn.user.email));
  }

  await addConsent(c.env, await emailHash(c.env, signedIn.user.email), req.server);
  return issueCode(c, req, signedIn, 303);
});

interface ConfirmProps {
  req: AuthorizeRequest;
  user: { name?: string | null; email: string };
  action: string;
}

function ConfirmSignIn({ req, user, action }: ConfirmProps) {
  // The client is the server itself (same origin, see lib/authorizeRequest.ts)
  const serverHost = req.resourceUrl.host;
  const serverLabel = req.resourceUrl.host + req.resourceUrl.pathname.replace(/\/$/, "");

  const serverNote = req.localServer
    ? `This server runs on your own computer (${serverHost}). Only continue if you started it yourself.`
    : `${serverHost} will receive your name and email address. Only continue if you trust this server.`;

  return (
    <div class="ConfirmConnection">
      <div class="ConnectionDetails">
        <div class="User">
          <div class="UserName">
            {user.name || user.email}
            {user.name ? <span class="UserEmail">{user.email}</span> : null}
          </div>
        </div>
        <div class="ConfirmMessage">
          <span class="RequestsAccess">sign in to</span> <br />
          <b class="SecondaryColor">{serverLabel}</b>*
        </div>
      </div>
      <form method="post" action={action} class="ConnectionContainer" data-loading-form>
        <input type="hidden" name="consent" value="approve" />
        <button type="submit" class="Connection">
          Sign in
        </button>
        <p class="ClientNote">* {serverNote} You only need to confirm this once for this server.</p>
      </form>

      <div class="ButtonGroup">
        <button type="button" data-signout>
          Change user
        </button>
        <form method="get" action="/">
          <button type="submit">Manage sessions</button>
        </form>
      </div>
    </div>
  );
}

export default app;
