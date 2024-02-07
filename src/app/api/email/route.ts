import { auth } from "@/auth/auth";
import { sendEmail, EmailSchema } from "@/functions/email";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Need to be signed in" }, { status: 401 });
  }

  const body = await req.json();
  const email = EmailSchema.safeParse(body);

  if (!email.success) {
    return NextResponse.json({ error: "No email provided" }, { status: 400 });
  }
  try {
    await sendEmail(email.data);
  } catch (e) {
    return NextResponse.json({ error: "Server Error", status: 500 });
  }
  return NextResponse.json({ status: 200 });
}
