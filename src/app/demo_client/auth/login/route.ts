import {
  getClientConfig,
  getSession,
  clientConfig,
} from "../../components/lib";
import * as client from "openid-client";

const resource_url = "http://localhost:3000/api/demo_resource";

export async function GET() {
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
  await session.save();
  return Response.redirect(redirectTo.href);
}
