import { NextRequest } from "next/server";
import {
  getClientConfig,
  getSession,
  clientConfig,
} from "../../components/lib";
import * as client from "openid-client";

const resource_url = process.env.AMCAT_URL || "";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const session = await getSession();
  const code_verifier = client.randomPKCECodeVerifier();
  const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
  const oidcConfig = await getClientConfig();
  const parameters: Record<string, string> = {
    redirect_uri: clientConfig.redirect_uri,
    resource: resource_url,
    scope: clientConfig.scope!,
    code_challenge,
    code_challenge_method: clientConfig.code_challenge_method,
  };
  let state!: string;
  if (!oidcConfig.serverMetadata().supportsPKCE()) {
    state = client.randomState();
    parameters.state = state;
  }
  const redirectTo = client.buildAuthorizationUrl(oidcConfig, parameters);

  session.code_verifier = code_verifier;
  session.state = state;

  // login endpoint takes an optional "rd" query parameter to customize
  // the redirect from the callback endpoint
  const rd = searchParams.get("rd");
  if (rd) session.rd = searchParams.get("rd")!;

  await session.save();
  return Response.redirect(redirectTo.href);
}
