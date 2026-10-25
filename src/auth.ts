import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb } from "./drizzle/db";
import * as schema from "./drizzle/schema";
import { Bindings, getIssuer } from "./env";
import { countLogin, LoginKind, serverFromCallback } from "./lib/usage";
import { emailConfigured, sendEmail } from "./lib/email";

// Better Auth only handles signing in users to MiddleCat itself (GitHub, Google, email magic link).
// The OIDC provider part (authorize, token, ...) is our own, in routes/.

const brandColor = "#38c7b9";
const buttonText = "#000";

function createAuth(env: Bindings) {
  const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};
  if (env.GITHUB_ID && env.GITHUB_SECRET)
    socialProviders.github = { clientId: env.GITHUB_ID, clientSecret: env.GITHUB_SECRET };
  if (env.GOOGLE_ID && env.GOOGLE_SECRET)
    socialProviders.google = { clientId: env.GOOGLE_ID, clientSecret: env.GOOGLE_SECRET };

  const plugins = [];
  if (emailConfigured(env)) {
    plugins.push(
      magicLink({
        expiresIn: 60 * 15,
        storeToken: "hashed",
        // limits sending emails per IP address
        rateLimit: { window: 60 * 10, max: 5 },
        sendMagicLink: ({ email, url }) => sendMagicLinkEmail(env, email, url),
      }),
    );
  }

  return betterAuth({
    baseURL: getIssuer(env),
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(env), {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    // The MiddleCat login itself. It ends when a server receives its code (see routes/authorize.tsx), so it
    // mostly matters for the dashboard: it ends after 15 minutes without activity. The expiry is moved forward
    // when the login is used, at most once a minute.
    session: {
      expiresIn: 60 * 15,
      updateAge: 60,
    },
    account: {
      // same user for all providers with the same (verified) email
      accountLinking: { enabled: true, trustedProviders: ["github", "google"] },
      encryptOAuthTokens: true,
    },
    socialProviders,
    plugins,
    hooks: {
      // daily login limits (see lib/usage.ts)
      before: createAuthMiddleware(async (ctx) => {
        let kind: LoginKind | undefined;
        if (ctx.path === "/sign-in/magic-link") kind = "email";
        else if (ctx.path === "/sign-in/social" && ["github", "google"].includes(ctx.body?.provider)) {
          kind = ctx.body.provider;
        }
        if (!kind) return;
        const server = serverFromCallback(ctx.body?.callbackURL, getIssuer(env));
        const error = await countLogin(env, kind, server);
        if (error) throw new APIError("TOO_MANY_REQUESTS", { message: error });
      }),
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

let cached: { env: Bindings; auth: Auth } | undefined;

/** Better Auth instance for the current environment (bindings are only available per request) */
export function getAuth(env: Bindings): Auth {
  if (cached?.env !== env) cached = { env, auth: createAuth(env) };
  return cached.auth;
}

/** The user signed in to MiddleCat and their login session, or null */
export async function getSignedIn(env: Bindings, headers: Headers) {
  return await getAuth(env).api.getSession({ headers });
}

/** The user that is signed in to MiddleCat, or null */
export async function getUser(env: Bindings, headers: Headers) {
  return (await getSignedIn(env, headers))?.user ?? null;
}

/** Sign out of MiddleCat. Returns the Set-Cookie headers that clear the login cookies. */
export async function signOut(env: Bindings, headers: Headers): Promise<string[]> {
  try {
    const res = await getAuth(env).api.signOut({ headers, asResponse: true });
    return res.headers.getSetCookie();
  } catch {
    return []; // not signed in
  }
}

export function enabledProviders(env: Bindings) {
  return {
    email: emailConfigured(env),
    github: !!(env.GITHUB_ID && env.GITHUB_SECRET),
    google: !!(env.GOOGLE_ID && env.GOOGLE_SECRET),
  };
}

async function sendMagicLinkEmail(env: Bindings, email: string, url: string) {
  // Link to a confirmation page instead of directly to the verify endpoint, because
  // email scanners that follow links would otherwise use up the token.
  const verifyURL = new URL(url);
  const signInURL = new URL(`/auth/email?${verifyURL.searchParams}`, getIssuer(env));
  const escapedHost = signInURL.host.replace(/\./g, "&#8203;.");
  const href = escapeHtml(signInURL.toString());

  await sendEmail(env, {
    to: email,
    subject: `Sign in to MiddleCat`,
    text: `Sign in to '${signInURL.host}' by following this link: ${signInURL} \n\n. If you did not request this email you can safely ignore it.`,
    html: `<body style="background: #f9f9f9;"><table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: #fff; max-width: 600px; margin: auto; border-radius: 10px;"> <tr> <td align="center" style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;"> Sign in to <strong>${escapedHost}</strong></td></tr><tr> <td align="center" style="padding: 20px 0;"> <table border="0" cellspacing="0" cellpadding="0"> <tr> <td align="center" style="border-radius: 5px;" bgcolor="${brandColor}"><a href="${href}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${brandColor}; display: inline-block; font-weight: bold;">Sign in</a></td></tr></table> </td></tr><tr> <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;"> If you did not request this email you can safely ignore it. </td></tr></table></body>`,
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
