import getRequestBody from "@/functions/getRequestBody";
import {
  authorizationCodeRequest,
  refreshTokenRequest,
  killSessionRequest,
} from "@/functions/grantTypes";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

const authorizationCodeSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string(),
  code_verifier: z.string(),
});

const refreshTokenSchema = z.object({
  grant_type: z.literal("refresh_token"),
  refresh_token: z.string(),
});

const killSessionSchema = z.object({
  grant_type: z.literal("kill_session"),
  refresh_token: z.string().optional(),
  session_id: z.string().optional(),
});

const bodySchema = z.discriminatedUnion("grant_type", [
  authorizationCodeSchema,
  refreshTokenSchema,
  killSessionSchema,
]);

export async function POST(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const oidc = searchParams.get("oidc") === "true";

  const rawBody = await getRequestBody(req);
  const bodyValidator = bodySchema.safeParse(rawBody);

  if (!bodyValidator.success) {
    return NextResponse.json(
      { error: "Invalid request body", zod: bodyValidator.error },
      { status: 400, headers },
    );
  }
  const body = bodyValidator.data;

  try {
    if (body.grant_type === "authorization_code") {
      const responseBody = await authorizationCodeRequest(
        body.code,
        body.code_verifier,
        oidc,
      );
      return NextResponse.json(responseBody, { status: 200, headers });
    }

    if (body.grant_type === "refresh_token") {
      const [sessionId, refreshToken] = body.refresh_token.split(".");
      const responseBody = await refreshTokenRequest(
        sessionId,
        refreshToken,
        oidc,
      );
      return NextResponse.json(responseBody, { status: 200, headers });
    }

    if (body.grant_type === "kill_session") {
      const refreshToken = body.refresh_token || body.session_id;
      if (!refreshToken) {
        return NextResponse.json(
          { error: "Invalid request" },
          { status: 400, headers },
        );
      }
      const [sessionId] = refreshToken.split(".");
      const responseBody = await killSessionRequest(sessionId);
      return NextResponse.json(responseBody, { status: 200, headers });
    }
  } catch (e: unknown) {
    console.error(e);
    const error =
      typeof e === "object" && e !== null && "message" in e
        ? e?.message
        : "Invalid request";
    return NextResponse.json({ error }, { status: 400, headers });
  }
}
