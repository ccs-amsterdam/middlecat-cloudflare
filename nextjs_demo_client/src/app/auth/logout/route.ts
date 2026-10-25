import { defaultSession, getClientConfig, getSession, clientConfig } from "../../components/lib";
import * as client from "openid-client";

// RP-initiated logout: MiddleCat ends this session and the MiddleCat login, and redirects back
export async function GET() {
  const session = await getSession();
  const openIdClientConfig = await getClientConfig();
  const endSessionUrl = client.buildEndSessionUrl(openIdClientConfig, {
    post_logout_redirect_uri: clientConfig.post_logout_redirect_uri,
    ...(session.id_token ? { id_token_hint: session.id_token } : {}),
  });
  session.isLoggedIn = defaultSession.isLoggedIn;
  session.access_token = defaultSession.access_token;
  session.id_token = undefined;
  session.userInfo = defaultSession.userInfo;
  session.code_verifier = defaultSession.code_verifier;
  session.state = defaultSession.state;
  await session.save();
  return Response.redirect(endSessionUrl.href);
}
