import { Bindings } from "../env";
import { deleteExpiredSessions } from "./serverSessions";
import { deleteOldCounters } from "./usage";

/**
 * Hourly cleanup (cron). Besides expired data, this deletes MiddleCat users that have no active MiddleCat login
 * (with their linked accounts), so email addresses are only stored in the clear while someone is signed in.
 * Logins at servers are unaffected: those store the user's info encrypted (see serverSessions.ts).
 */
export async function cleanup(env: Bindings, now = Date.now()) {
  const db = env.DB1;
  await db.batch([
    db.prepare("DELETE FROM session WHERE expiresAt < ?").bind(now),
    db.prepare("DELETE FROM user WHERE id NOT IN (SELECT userId FROM session WHERE expiresAt >= ?)").bind(now),
    db.prepare("DELETE FROM verification WHERE expiresAt < ?").bind(now),
    db.prepare("DELETE FROM rateLimit WHERE lastRequest < ?").bind(now - 24 * 60 * 60 * 1000),
  ]);
  await deleteExpiredSessions(env);
  await deleteOldCounters(env);
}
