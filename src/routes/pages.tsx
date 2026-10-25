import { Hono } from "hono";
import { AppEnv } from "../env";
import { enabledProviders, getUser } from "../auth";
import { Layout, Loading } from "../views/layout";
import { SignIn } from "../views/signin";

const app = new Hono<AppEnv>();

/** Only allow relative callback paths, so the sign in page can't be used as an open redirect */
function safeCallback(url: string | undefined) {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) return "/";
  return url;
}

const errorMessages: Record<string, string> = {
  TOO_MANY_REQUESTS: "Too many attempts. Please try again later.",
  INVALID_TOKEN: "This sign in link is invalid or has already been used.",
  EXPIRED_TOKEN: "This sign in link has expired.",
};

app.get("/", async (c) => {
  const user = await getUser(c.env, c.req.raw.headers);
  if (!user)
    return c.html(
      <Layout scripts={["/signin.js"]}>
        <SignIn providers={enabledProviders(c.env)} callbackURL="/" />
      </Layout>,
    );

  return c.html(
    <Layout scripts={["/signin.js", "/dashboard.js"]}>
      <div class="Login fadeIn">
        <div>
          <h2 class="text-center">Your sessions</h2>
          <p>
            The servers you signed in to with MiddleCat. Ending a session signs you out of that server on that device.
          </p>
          <p class="SignedInAs">
            Signed in as <b>{user.email}</b>
          </p>
          <div class="SignIn">
            <button type="button" data-signout>
              sign out
            </button>
          </div>
        </div>
      </div>
      <div class="AmcatSessions">
        <div class="SessionData">
          <div class="SessionContainer">
            <div id="servers">
              <Loading />
            </div>
            <h4 class="hidden" id="servers-empty">
              - You haven't signed in to any servers -
            </h4>
          </div>
          <div class="SessionsError hidden" id="sessions-error">
            Could not fetch sessions
          </div>
        </div>
      </div>
      <div class="popup" id="popup"></div>
    </Layout>,
  );
});

app.get("/privacy", (c) => {
  return c.html(
    <Layout title="Privacy">
      <div class="Privacy">
        <h2>Privacy</h2>
        <p>
          MiddleCat lets you sign in to AmCAT servers. It stores as little about you as possible, and only for as long
          as needed.
        </p>
        <h3>While you are signed in to MiddleCat</h3>
        <p>
          Your email address, name and profile picture (from GitHub, Google, or the email address you entered), and
          the link to your GitHub or Google account. Your MiddleCat login ends as soon as you are signed in to a
          server (or, on this sessions page, after 15 minutes without activity), and this data is deleted within an
          hour after that.
        </p>
        <h3>For each server you sign in to</h3>
        <p>
          The server's address, a short description of your browser and operating system, and when you signed in.
          Your email address, name and profile picture are stored encrypted, so that only that server can unlock them
          when it renews your login. To show you your sessions, MiddleCat stores a code derived from your email
          address that can't be turned back into it. This is deleted when you or the server end the session, or
          after 14 days without use. If you confirmed signing in to a server, MiddleCat remembers this (with the
          same code) until you choose "forget" on the sessions page.
        </p>
        <h3>What servers receive</h3>
        <p>
          When you sign in to a server, it receives your email address, name and profile picture. What the server
          does with them is up to the server.
        </p>
        <h3>Other data</h3>
        <p>
          Daily counts of logins (without personal data), kept for a month. Your IP address, to prevent abuse,
          kept for at most a day.
        </p>
        <h3>Services we use</h3>
        <p>
          MiddleCat runs on Cloudflare, which keeps technical logs of requests for a limited time. If you sign in
          with GitHub or Google, they know you signed in to MiddleCat.
          Sign-in emails are sent by our email provider (Cloudflare or Resend).
        </p>
        <h3>Contact</h3>
        <p>[contact address]</p>
      </div>
    </Layout>,
  );
});

app.get("/signin", async (c) => {
  const callbackURL = safeCallback(c.req.query("callbackURL"));
  const error = c.req.query("error");
  return c.html(
    <Layout title="Sign in" scripts={["/signin.js"]}>
      <SignIn
        providers={enabledProviders(c.env)}
        callbackURL={callbackURL}
        error={error ? errorMessages[error] || "Could not sign in. Please try again." : undefined}
      />
    </Layout>,
  );
});

app.get("/email_sent", (c) => {
  return c.html(
    <Layout title="Check your email">
      <div class="Page">
        <div class="Container Narrow">
          <h3>Please check your email</h3>
          <p>
            We have sent you a link to sign-in and continue your session. <br />
          </p>
          <i>You can close this window</i>
        </div>
      </div>
    </Layout>,
  );
});

// The magic link in the email points here. The token is only used when the user clicks Continue,
// so email scanners that open links don't use it up.
app.get("/auth/email", (c) => {
  const token = c.req.query("token") || "";
  const callbackURL = safeCallback(c.req.query("callbackURL"));
  const errorCallbackURL = `/signin?callbackURL=${encodeURIComponent(callbackURL)}`;
  return c.html(
    <Layout title="Sign in">
      <main class="EmailSignin">
        <div>
          <form action="/api/auth/magic-link/verify" method="get">
            <h1>Email authentication confirmed</h1>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="callbackURL" value={callbackURL} />
            <input type="hidden" name="errorCallbackURL" value={errorCallbackURL} />
            <button type="submit">Continue</button>
          </form>
        </div>
      </main>
    </Layout>,
  );
});

export default app;
