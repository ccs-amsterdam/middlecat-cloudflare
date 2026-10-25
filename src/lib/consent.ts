import { and, eq } from "drizzle-orm";
import { getDb } from "../drizzle/db";
import { serverConsent } from "../drizzle/schema";

// Servers the user confirmed signing in to, so later sign-ins don't ask again (by email hash, see emailIndex.ts)

export async function hasConsent(env: { DB1: D1Database }, emailHash: string, server: string) {
  const rows = await getDb(env)
    .select({ server: serverConsent.server })
    .from(serverConsent)
    .where(and(eq(serverConsent.emailHash, emailHash), eq(serverConsent.server, server)))
    .limit(1);
  return rows.length > 0;
}

export async function addConsent(env: { DB1: D1Database }, emailHash: string, server: string) {
  await getDb(env).insert(serverConsent).values({ emailHash, server, createdAt: new Date() }).onConflictDoNothing();
}

export async function removeConsent(env: { DB1: D1Database }, emailHash: string, server: string) {
  await getDb(env)
    .delete(serverConsent)
    .where(and(eq(serverConsent.emailHash, emailHash), eq(serverConsent.server, server)));
}
