import { authorizationCodeRequest, refreshTokenRequest, killSessionRequest } from "@/functions/grantTypes";
import { NextResponse } from "next/server";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
};

const authorizationCodeSchema = z.object({
  grant_type: z.literal("authorization_code"),
  host: z.string(),
  code: z.string(),
  codeVerifier: z.string(),
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

const bodySchema = z.union([authorizationCodeSchema, refreshTokenSchema, killSessionSchema]);

export async function POST(req: Request) {
  const bodyValidator = bodySchema.safeParse(await req.json());

  if (!bodyValidator.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = bodyValidator.data;

  try {
    let responseBody: any = undefined;
    if (body.grant_type === "authorization_code") {
      responseBody = await authorizationCodeRequest(body.code, body.codeVerifier);
    }

    if (body.grant_type === "refresh_token") {
      const [sessionId, refreshToken] = body.refresh_token.split(".");
      responseBody = await refreshTokenRequest(sessionId, refreshToken);
    }

    if (body.grant_type === "kill_session") {
      const refreshToken = body.refresh_token || body.session_id;
      if (!refreshToken) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const [sessionId] = refreshToken.split(".");
      responseBody = await killSessionRequest(sessionId);
    }
    return NextResponse.json(responseBody, { status: 200, headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid request" }, { status: 400, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
