import { BrowserSession, ApiKeySession } from "@/types";
import { auth } from "@/auth/auth";
import { NextResponse } from "next/server";
import { and, asc, eq, gt } from "drizzle-orm";
import db, { amcatSessions } from "@/drizzle/schema";

export const runtime = "edge";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const aSessions = await db
    .select()
    .from(amcatSessions)
    .where(and(eq(amcatSessions.email, session.user.email), gt(amcatSessions.expires, new Date())))
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
    if (s.type === "apiKey") apiKey.push({ label, createdOn, createdAt, resource, expires, id });
  }

  return NextResponse.json({ browser, apiKey }, { status: 200 });
}
