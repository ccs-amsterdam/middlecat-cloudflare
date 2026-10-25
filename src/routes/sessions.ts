import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { and, eq, gt, isNull } from "drizzle-orm";
import { AppEnv } from "../env";
import { getUser } from "../auth";
import { getDb } from "../drizzle/db";
import { serverConsent, serverSession } from "../drizzle/schema";
import { endSession } from "../lib/serverSessions";
import { removeConsent } from "../lib/consent";
import { emailHash } from "../lib/emailIndex";

// Dashboard API. Requires being signed in to MiddleCat. Same-origin only: there are no CORS
// headers, and csrf() checks the Origin of form-like requests.
const app = new Hono<AppEnv>();

app.use("/api/sessions", csrf());
app.use("/api/sessions/*", csrf());
app.use("/api/servers/*", csrf());

export interface DashboardServer {
  server: string;
  confirmed: boolean;
  sessions: { id: string; createdOn: string; createdAt: Date; expires: Date }[];
}

app.get("/api/sessions", async (c) => {
  const user = await getUser(c.env, c.req.raw.headers);
  if (!user) return c.json({ error: "Not authenticated" }, 401);
  const hash = await emailHash(c.env, user.email);
  const db = getDb(c.env);

  const sessions = await db
    .select()
    .from(serverSession)
    .where(and(eq(serverSession.emailHash, hash), gt(serverSession.expires, new Date()), isNull(serverSession.codeExpires)));
  const consents = await db.select().from(serverConsent).where(eq(serverConsent.emailHash, hash));

  const servers = new Map<string, DashboardServer>();
  const get = (server: string) => {
    if (!servers.has(server)) servers.set(server, { server, confirmed: false, sessions: [] });
    return servers.get(server)!;
  };
  for (const consent of consents) get(consent.server).confirmed = true;
  for (const s of sessions) {
    get(s.server).sessions.push({ id: s.id, createdOn: s.createdOn, createdAt: s.createdAt, expires: s.expires });
  }

  c.header("Cache-Control", "no-store");
  return c.json({ servers: [...servers.values()].sort((a, b) => a.server.localeCompare(b.server)) });
});

// End one session at a server
app.delete("/api/sessions/:id", async (c) => {
  const user = await getUser(c.env, c.req.raw.headers);
  if (!user) return c.json({ error: "Not authenticated" }, 401);
  const ended = await endSession(c.env, c.req.param("id"), await emailHash(c.env, user.email));
  if (!ended) return c.json({ error: "Session not found" }, 404);
  return c.json({ message: "Session ended" });
});

// Forget a server: end all sessions there, and ask for confirmation again next time
app.delete("/api/servers/:server", async (c) => {
  const user = await getUser(c.env, c.req.raw.headers);
  if (!user) return c.json({ error: "Not authenticated" }, 401);
  const hash = await emailHash(c.env, user.email);
  const server = c.req.param("server");
  await getDb(c.env)
    .delete(serverSession)
    .where(and(eq(serverSession.emailHash, hash), eq(serverSession.server, server)));
  await removeConsent(c.env, hash, server);
  return c.json({ message: "Server forgotten" });
});

export default app;
