import getRequestBody from "@/functions/getRequestBody";
import { authorizationCodeRequest, refreshTokenRequest, killSessionRequest } from "@/functions/grantTypes";
import { NextResponse } from "next/server";
import { z } from "zod";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

const bodySchema = z.discriminatedUnion("grant_type", [authorizationCodeSchema, refreshTokenSchema, killSessionSchema]);

export async function POST(req: Request) {
  const rawBody = await getRequestBody(req);
  const bodyValidator = bodySchema.safeParse(rawBody);

  if (!bodyValidator.success) {
    return NextResponse.json({ error: "Invalid request body", zod: bodyValidator.error }, { status: 400, headers });
  }
  const body = bodyValidator.data;

  try {
    let responseBody: any = undefined;
    if (body.grant_type === "authorization_code") {
      responseBody = await authorizationCodeRequest(body.code, body.code_verifier);
    }

    if (body.grant_type === "refresh_token") {
      const [sessionId, refreshToken] = body.refresh_token.split(".");
      responseBody = await refreshTokenRequest(sessionId, refreshToken);
    }

    if (body.grant_type === "kill_session") {
      const refreshToken = body.refresh_token || body.session_id;
      if (!refreshToken) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
      }
      const [sessionId] = refreshToken.split(".");
      responseBody = await killSessionRequest(sessionId);
    }
    return NextResponse.json(responseBody, { status: 200, headers });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Invalid request" }, { status: 400, headers });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}
