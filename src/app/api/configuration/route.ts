import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const publicKey = process.env.NEXT_PUBLIC_PUBLICKEY || "";

  const configuration = {
    public_key: publicKey,
  };
  return NextResponse.json(configuration, { status: 200 });
}
