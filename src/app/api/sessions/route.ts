import { BrowserSession, ApiKeySession } from "@/types";
import rmExpiredSessions from "@/functions/rmExpiredSessions";
import { auth } from "@/auth/auth";
import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import db, { amcatSessions } from "@/drizzle/schema";

export const runtime = "edge";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Need to be signed in" },
      { status: 403 }
    );
  }

  await rmExpiredSessions();

  const aSessions = await db
    .select()
    .from(amcatSessions)
    .where(eq(amcatSessions.userId, session.user.id))
    .orderBy(asc(amcatSessions.expires));

  const browser: BrowserSession[] = [];
  const apiKey: ApiKeySession[] = [];

  for (let s of aSessions) {
    const { label, resource, expires, id, createdOn, createdAt } = s;
    if (s.type === "browser")
      browser.push({
        label,
        createdOn,
        createdAt,
        resource,
        id,
      });
    if (s.type === "api")
      apiKey.push({ label, createdOn, createdAt, resource, expires, id });
  }

  return NextResponse.json({ browser, apiKey }, { status: 200 });
}
