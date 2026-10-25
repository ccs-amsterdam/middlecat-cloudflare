import { eq, lt } from "drizzle-orm";
import { getDb } from "../drizzle/db";
import { serverBudget, usageCounter } from "../drizzle/schema";
import settings from "./settings";

// Daily login limits. The free tier has global limits (everyone combined) and smaller limits per server.
// A server with a budget set by an admin (serverBudget) only counts against its own budget.
// Logins are counted when they start: a magic link is sent, or the user is redirected to GitHub/Google.

export type LoginKind = "email" | "github" | "google";

export function today() {
  return new Date().toISOString().slice(0, 10);
}

async function increment(db: D1Database, bucket: string): Promise<number> {
  const row = await db
    .prepare(
      "INSERT INTO usageCounter (bucket, day, count) VALUES (?, ?, 1) " +
        "ON CONFLICT (bucket, day) DO UPDATE SET count = count + 1 RETURNING count",
    )
    .bind(bucket, today())
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export function serverBucket(server: string, kind: LoginKind) {
  return `server:${server}:${kind === "email" ? "email" : "social"}`;
}

/** Count a login, and return an error message if it's over a limit */
export async function countLogin(
  env: { DB1: D1Database },
  kind: LoginKind,
  server: string | null,
): Promise<string | null> {
  const social = kind !== "email";

  if (server) {
    const [budget] = await getDb(env).select().from(serverBudget).where(eq(serverBudget.server, server)).limit(1);
    const count = await increment(env.DB1, serverBucket(server, kind));
    if (budget) {
      const limit = social ? budget.socialPerDay : budget.emailPerDay;
      return count > limit ? `${server} has reached its daily login limit. Please try again tomorrow.` : null;
    }
    const limit = social ? settings.limits.perServer.social : settings.limits.perServer.email;
    if (count > limit) {
      return (
        `${server} has reached its daily login limit on MiddleCat's free tier. Please try again tomorrow. ` +
        "(Server owners can ask the MiddleCat admins for a dedicated budget.)"
      );
    }
  }

  const count = await increment(env.DB1, `global:${kind}`);
  if (count > settings.limits.global[kind]) {
    return (
      "MiddleCat's free tier is at capacity today. Please try again tomorrow. " +
      "(Server owners can ask the MiddleCat admins for a dedicated budget.)"
    );
  }
  return null;
}

/** The server a login is for, if it was started from an /authorize request */
export function serverFromCallback(callbackURL: unknown, issuer: string): string | null {
  if (typeof callbackURL !== "string") return null;
  try {
    const url = new URL(callbackURL, issuer);
    if (url.origin !== new URL(issuer).origin || url.pathname !== "/authorize") return null;
    const resource = url.searchParams.get("resource");
    return resource ? new URL(resource).origin : null;
  } catch {
    return null;
  }
}

export async function deleteOldCounters(env: { DB1: D1Database }) {
  const cutoff = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await getDb(env).delete(usageCounter).where(lt(usageCounter.day, cutoff));
}
