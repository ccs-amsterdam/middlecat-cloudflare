import settings from "@/functions/settings";
import { createTokens } from "@/functions/grantTypes";
import { auth } from "@/auth/auth";
import { z } from "zod";
import { NextResponse, userAgent } from "next/server";
import db, { amcatSessions, users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

const bodySchema = z.object({
  clientId: z.string().max(200),
  state: z.string().optional(),
  codeChallenge: z.string().max(128).optional(),
  label: z.string().max(100),
  type: z.enum(["browser", "apiKey"]),
  scope: z.string().max(100).optional().default("default"),
  refreshRotate: z.boolean().optional().default(true),
  expiresIn: z.number().optional(),
  resource: z.string().max(200),
  resourceConfig: z.object({
    middlecat_url: z.string(),
    amcat_url: z.string(),
    amcat_key: z.string(),
  }),
  oauth: z.boolean().optional().default(true),
});

/**
 * Creates an AmCAT session.
 * if oauth is true, returns the authCode and state.
 * Otherwise, immediately returns the tokens
 */
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Need to be signed in" }, { status: 403 });
  }

  // TODO csrf check

  const bodyValidator = bodySchema.safeParse(req.body);
  if (!bodyValidator.success) {
    return NextResponse.json({ error: "Invalid request body", zod: bodyValidator.error }, { status: 400 });
  }
  const {
    clientId,
    state,
    codeChallenge,
    label,
    type,
    scope,
    refreshRotate,
    expiresIn,
    resource,
    resourceConfig,
    oauth = true,
  } = bodyValidator.data;

  if (oauth && (!codeChallenge || !state)) {
    return NextResponse.json({ status: 404 });
  }

  if (resourceConfig.middlecat_url !== process.env.NEXTAUTH_URL) {
    return NextResponse.json({ error: "Resource uses a different MiddleCat" }, { status: 404 });
  }

  const maxAge = expiresIn || settings[type].session_max_age_hours * 60 * 60;
  const expires = new Date(Date.now() + 1000 * maxAge);
  const createdOn = getCreatedOn(req);

  // finally, create the new session
  const [amcatsession] = await db
    .insert(amcatSessions)
    .values({ email, type, label, expires, codeChallenge, createdOn, clientId, resource, scope, refreshRotate })
    .onConflictDoNothing()
    .returning();

  if (oauth) {
    return NextResponse.json(
      {
        authCode: amcatsession.id + "." + amcatsession.secret,
        state,
      },
      { status: 200 }
    );
  } else {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return await createTokens(req.headers.get("host") || "", amcatsession, user);
  }
}

function getCreatedOn(req: Request) {
  const createdOnDetails: string[] = [];
  const useragent = userAgent(req);
  if (useragent.device.vendor) createdOnDetails.push(useragent.device.vendor);
  if (useragent.browser.name) createdOnDetails.push(useragent.browser.name);
  if (useragent.os.name) createdOnDetails.push(useragent.os.name);
  return createdOnDetails.join(", ");
}
