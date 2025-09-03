import {
  getClientConfig,
  getSession,
  clientConfig,
} from "../../components/lib";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import * as client from "openid-client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const oidcConfig = await getClientConfig();
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") || headerList.get("host") || "localhost";
  const protocol = headerList.get("x-forwarded-proto") || "https";
  const currentUrl = new URL(
    `${protocol}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const tokenSet = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
    pkceCodeVerifier: session.code_verifier,
    expectedState: session.state,
  });

  // CLASSIC MIDDLECAT
  if (!("id_token" in tokenSet)) {
  }

  const { access_token } = tokenSet;
  session.isLoggedIn = true;
  session.access_token = access_token;
  const claims = tokenSet.claims()!;

  const { sub } = claims;
  // call userinfo endpoint to get user info
  const userinfo = await client.fetchUserInfo(oidcConfig, access_token, sub);
  // store userinfo in session
  session.userInfo = {
    sub: userinfo.sub,
    name: userinfo.given_name!,
    email: userinfo.email!,
    email_verified: userinfo.email_verified!,
  };

  await session.save();

  return Response.redirect(session.rd || clientConfig.post_login_route);
}
