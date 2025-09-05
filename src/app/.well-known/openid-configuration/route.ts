import { NextResponse } from "next/server";

export async function POST() {
  const app_url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const configuration = {
    issuer: app_url,
    authorization_endpoint: `${app_url}/authorize?oidc=true`,
    token_endpoint: `${app_url}/api/token?oidc=true`,
    userinfo_endpoint: `${app_url}/api/userinfo`,
    jwks_uri: `${app_url}/.well-known/jwks`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
  };

  return NextResponse.json(configuration, { status: 200 });
}
