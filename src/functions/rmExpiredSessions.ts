import db, { amcatSessions } from "@/drizzle/schema";
import { gt } from "drizzle-orm";

export default async function rmExpiredSessions() {
  // only needs to happen occasionally, so we do it roughly
  // once every 1000 requests
  if (Math.random() > 0.001) return;
  await db
    .delete(amcatSessions)
    .where(gt(amcatSessions.expires, new Date(Date.now())));
}
