import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const publicKey = process.env.NEXT_PUBLIC_PUBLICKEY || "";
  const app_url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const configuration = {
    issuer: app_url,
    authorization_endpoint: `${app_url}/authorize`,
    token_endpoint: `${app_url}/api/token`,
    userinfo_endpoint: `${app_url}/api/userinfo`,
    jwks_uri: `${app_url}/api/jwks`,
    response_types_supported: [
      "code",
      "token",
      "id_token",
      "code token",
      "code id_token",
      "token id_token",
      "code token id_token",
    ],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
  };

  return NextResponse.json(configuration, { status: 200 });
}
