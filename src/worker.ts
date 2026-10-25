import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { AppEnv, Bindings } from "./env";
import { getAuth } from "./auth";
import oidc from "./routes/oidc";
import token from "./routes/token";
import sessions from "./routes/sessions";
import authorize from "./routes/authorize";
import pages from "./routes/pages";
import logout from "./routes/logout";
import admin from "./routes/admin";
import { ensureKeys } from "./lib/keys";
import { cleanup } from "./lib/cleanup";

const app = new Hono<AppEnv>();

app.use(
  "*",
  secureHeaders({
    // No framing anywhere, so the consent screen can't be clickjacked
    xFrameOptions: "DENY",
    // Don't leak authorize request parameters to other sites (e.g. avatar image hosts)
    referrerPolicy: "no-referrer",
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
      // no form-action: the consent form redirects to the client's redirect_uri
    },
    crossOriginResourcePolicy: false, // jwks, configuration etc. are read cross-origin
  }),
);

// Better Auth: sign in to MiddleCat with GitHub, Google or email
app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth(c.env).handler(c.req.raw));

app.route("/", oidc);
app.route("/", token);
app.route("/", sessions);
app.route("/", authorize);
app.route("/", logout);
app.route("/", admin);
app.route("/", pages);

app.onError((err, c) => {
  if ("getResponse" in err && typeof err.getResponse === "function") return err.getResponse();
  console.error(err);
  return c.json({ error: "server_error" }, 500);
});

export default {
  fetch: app.fetch,
  // hourly cron (wrangler.jsonc): create upcoming signing keys, remove old ones, clean up (see lib/cleanup.ts)
  async scheduled(_controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.all([ensureKeys(env), cleanup(env)]));
  },
} satisfies ExportedHandler<Bindings>;
