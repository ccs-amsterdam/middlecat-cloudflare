import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
};

export async function GET() {
  const data = {
    middlecat_url: process.env.NEXTAUTH_URL,
    authorization: "allow_guests", // "no_auth", "allow_guests", "allow_authenticated_guests", "authorized_users_only"
  };

  return NextResponse.json(data, { status: 200, headers: corsHeaders });
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
