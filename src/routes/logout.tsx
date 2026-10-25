import { Context, Hono } from "hono";
import { AppEnv, getIssuer } from "../env";
import { signOut } from "../auth";
import { verifyIdTokenHint } from "../lib/createJWT";
import { endSession } from "../lib/serverSessions";
import { isLoopback } from "../lib/authorizeRequest";
import { ErrorMsg, Layout } from "../views/layout";

// OIDC RP-initiated logout (end_session_endpoint). Signs the user out of MiddleCat, ends the server session the
// id_token belongs to (sid), and returns to post_logout_redirect_uri if it's on the server's own origin.
// With a valid id_token_hint this happens right away (the hint shows that the server asked for it). Without one,
// the user confirms, so other sites can't sign users out.
const app = new Hono<AppEnv>();

const LOGOUT_PARAMS = ["id_token_hint", "post_logout_redirect_uri", "client_id", "state", "confirm"] as const;
type LogoutParams = Partial<Record<(typeof LOGOUT_PARAMS)[number], string>>;

async function readParams(c: Context<AppEnv>): Promise<LogoutParams> {
  const params: LogoutParams = {};
  const source = c.req.method === "POST" ? await c.req.parseBody() : c.req.query();
  for (const name of LOGOUT_PARAMS) {
    const value = source[name];
    if (typeof value === "string" && value) params[name] = value;
  }
  return params;
}

/** post_logout_redirect_uri must be on the origin of the client (the server itself) */
function allowedRedirect(redirectUri: string | undefined, clientId: string | undefined) {
  if (!redirectUri || !clientId) return null;
  try {
    const redirect = new URL(redirectUri);
    const client = new URL(clientId);
    const safeScheme = redirect.protocol === "https:" || (redirect.protocol === "http:" && isLoopback(redirect));
    return safeScheme && redirect.origin === client.origin ? redirect : null;
  } catch {
    return null;
  }
}

async function logout(c: Context<AppEnv>) {
  const params = await readParams(c);
  const issuer = getIssuer(c.env);

  const hint = params.id_token_hint ? await verifyIdTokenHint(c.env, params.id_token_hint, issuer) : null;
  if (params.id_token_hint && !hint) {
    return c.html(
      <Layout title="Sign out">
        <ErrorMsg type="Invalid sign-out request">The id_token_hint is not valid.</ErrorMsg>
      </Layout>,
      400,
    );
  }
  const hintClient = typeof hint?.aud === "string" ? hint.aud : undefined;
  if (hintClient && params.client_id && params.client_id !== hintClient) {
    return c.html(
      <Layout title="Sign out">
        <ErrorMsg type="Invalid sign-out request">client_id doesn't match the id_token_hint.</ErrorMsg>
      </Layout>,
      400,
    );
  }
  const clientId = hintClient || params.client_id;
  const redirect = allowedRedirect(params.post_logout_redirect_uri, clientId);

  const sameOrigin = c.req.header("Origin") === new URL(issuer).origin;
  const confirmed = !!hint || (c.req.method === "POST" && params.confirm === "1" && sameOrigin);

  if (!confirmed) {
    return c.html(
      <Layout title="Sign out">
        <div class="Page">
          <h3>Sign out of MiddleCat?</h3>
          <form method="post" action="/logout" class="LogoutForm">
            <input type="hidden" name="confirm" value="1" />
            {params.post_logout_redirect_uri ? (
              <input type="hidden" name="post_logout_redirect_uri" value={params.post_logout_redirect_uri} />
            ) : null}
            {params.client_id ? <input type="hidden" name="client_id" value={params.client_id} /> : null}
            {params.state ? <input type="hidden" name="state" value={params.state} /> : null}
            <button type="submit">Sign out</button>
          </form>
        </div>
      </Layout>,
    );
  }

  if (typeof hint?.sid === "string") await endSession(c.env, hint.sid);
  for (const cookie of await signOut(c.env, c.req.raw.headers)) c.header("Set-Cookie", cookie, { append: true });

  if (redirect) {
    if (params.state) redirect.searchParams.set("state", params.state);
    return c.redirect(redirect.toString(), c.req.method === "POST" ? 303 : 302);
  }
  return c.html(
    <Layout title="Signed out">
      <div class="Page">
        <h3>You are signed out of MiddleCat</h3>
        <i>You can close this window</i>
      </div>
    </Layout>,
  );
}

app.get("/logout", logout);
app.post("/logout", logout);

export default app;
