import { IronSession, SessionOptions, getIronSession } from "iron-session";
import { cookies } from "next/headers";
import * as client from "openid-client";

// normally set these with env vars
const api_url = "http://localhost:3000";
const app_url = "http://localhost:3000/demo_client";
const client_id = "http://localhost:3000";
const scope = "openid profile email";
const secret = "complex_password_at_least_32_characters_long";

export const clientConfig = {
  url: api_url,
  audience: api_url,
  client_id: client_id,
  scope: scope,
  redirect_uri: `${app_url}/auth/callback`,
  post_logout_redirect_uri: `${app_url}`,
  response_type: "code",
  grant_type: "authorization_code",
  post_login_route: `${app_url}`,
  code_challenge_method: "S256",
};

export interface SessionData {
  isLoggedIn: boolean;
  access_token?: string;
  code_verifier?: string;
  state?: string;
  userInfo?: {
    sub: string;
    name: string;
    email: string;
    email_verified: boolean;
  };
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
  access_token: undefined,
  code_verifier: undefined,
  state: undefined,
  userInfo: undefined,
};

export const sessionOptions: SessionOptions = {
  password: secret,
  cookieName: "next_js_session",
  cookieOptions: {
    // secure only works in `https` environments
    // if your localhost is not on `https`, then use: `secure: process.env.NODE_ENV === "production"`
    secure: process.env.NODE_ENV === "production",
  },
  ttl: 60 * 60 * 24 * 7, // 1 week
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookiesList = await cookies();
  const session = await getIronSession<SessionData>(
    cookiesList,
    sessionOptions,
  );
  if (!session.isLoggedIn) {
    session.access_token = defaultSession.access_token;
    session.userInfo = defaultSession.userInfo;
  }
  return session;
}

export async function getClientConfig() {
  return await client.discovery(
    new URL(clientConfig.url!),
    clientConfig.client_id!,
    undefined,
    undefined,
    {
      execute: [client.allowInsecureRequests],
    },
  );
}
