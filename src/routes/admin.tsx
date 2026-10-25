import { Context, Hono } from "hono";
import { csrf } from "hono/csrf";
import { eq, gt, sql } from "drizzle-orm";
import { AppEnv, isAdmin } from "../env";
import { getUser } from "../auth";
import { getDb } from "../drizzle/db";
import { serverBudget, serverSession, usageCounter } from "../drizzle/schema";
import settings from "../lib/settings";
import { today } from "../lib/usage";
import { ErrorMsg, Layout } from "../views/layout";

// Admin page (MIDDLECAT_ADMINS): which servers use MiddleCat, today's logins, and dedicated budgets.
// "Registering" a server is asking the admins for a budget; nobody needs to prove anything, because a budget
// only applies to logins for that server's origin, which only that server can use.
const app = new Hono<AppEnv>();

app.use("/admin/*", csrf());

async function requireAdmin(c: Context<AppEnv>) {
  const user = await getUser(c.env, c.req.raw.headers);
  return user && isAdmin(c.env, user.email) ? user : null;
}

function notFound(c: Context<AppEnv>) {
  return c.html(
    <Layout title="Not found">
      <ErrorMsg type="Not found">This page doesn't exist, or you don't have access.</ErrorMsg>
    </Layout>,
    404,
  );
}

function parseOrigin(value: unknown) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

app.get("/admin", async (c) => {
  if (!(await requireAdmin(c))) return notFound(c);
  const db = getDb(c.env);
  const day = today();

  const counters = await db.select().from(usageCounter).where(eq(usageCounter.day, day));
  const count = (bucket: string) => counters.find((r) => r.bucket === bucket)?.count ?? 0;
  const active = await db
    .select({ server: serverSession.server, n: sql<number>`count(*)` })
    .from(serverSession)
    .where(gt(serverSession.expires, new Date()))
    .groupBy(serverSession.server);
  const budgets = await db.select().from(serverBudget);
  const recent = await db
    .select({ bucket: usageCounter.bucket })
    .from(usageCounter)
    .where(gt(usageCounter.day, new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)));

  const servers = new Set<string>([...active.map((a) => a.server), ...budgets.map((b) => b.server)]);
  for (const { bucket } of recent) {
    const match = /^server:(.+):(email|social)$/.exec(bucket);
    if (match) servers.add(match[1]);
  }

  const { global, perServer } = settings.limits;
  return c.html(
    <Layout title="Admin">
      <div class="Admin">
        <h2>Today ({day}, UTC)</h2>
        <p>
          Free tier: email {count("global:email")} / {global.email}, GitHub {count("global:github")} / {global.github},
          Google {count("global:google")} / {global.google}. Per server without budget: email {perServer.email}, social{" "}
          {perServer.social}.
        </p>

        <h2>Servers</h2>
        <table class="AdminTable">
          <thead>
            <tr>
              <th>Server</th>
              <th>Active sessions</th>
              <th>Logins today (email / social)</th>
              <th>Budget per day (email / social)</th>
            </tr>
          </thead>
          <tbody>
            {[...servers].sort().map((server) => {
              const budget = budgets.find((b) => b.server === server);
              return (
                <tr>
                  <td>{server}</td>
                  <td>{active.find((a) => a.server === server)?.n ?? 0}</td>
                  <td>
                    {count(`server:${server}:email`)} / {count(`server:${server}:social`)}
                  </td>
                  <td>
                    {budget ? (
                      <form method="post" action="/admin/budget/delete">
                        {budget.emailPerDay} / {budget.socialPerDay}
                        {budget.note ? ` (${budget.note})` : ""}
                        <input type="hidden" name="server" value={server} />
                        <button type="submit" class="SmallButton">
                          Remove
                        </button>
                      </form>
                    ) : (
                      "free tier"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h2>Set a budget</h2>
        <form method="post" action="/admin/budget" class="AdminForm">
          <input name="server" type="url" placeholder="https://amcat.example.com" required />
          <input name="emailPerDay" type="number" min="0" placeholder="email logins per day" required />
          <input name="socialPerDay" type="number" min="0" placeholder="social logins per day" required />
          <input name="note" type="text" placeholder="note (e.g. contact)" />
          <button type="submit">Save budget</button>
        </form>
      </div>
    </Layout>,
  );
});

app.post("/admin/budget", async (c) => {
  const admin = await requireAdmin(c);
  if (!admin) return notFound(c);
  const body = await c.req.parseBody();
  const server = parseOrigin(body.server);
  const emailPerDay = Number(body.emailPerDay);
  const socialPerDay = Number(body.socialPerDay);
  if (!server || !Number.isInteger(emailPerDay) || !Number.isInteger(socialPerDay) || emailPerDay < 0 || socialPerDay < 0) {
    return c.html(
      <Layout title="Admin">
        <ErrorMsg type="Invalid budget">Provide a server URL and whole numbers for the budgets.</ErrorMsg>
      </Layout>,
      400,
    );
  }
  const values = {
    emailPerDay,
    socialPerDay,
    note: typeof body.note === "string" && body.note ? body.note.slice(0, 200) : null,
    approvedBy: admin.email,
    approvedAt: new Date(),
  };
  await getDb(c.env)
    .insert(serverBudget)
    .values({ server, ...values })
    .onConflictDoUpdate({ target: serverBudget.server, set: values });
  return c.redirect("/admin", 303);
});

app.post("/admin/budget/delete", async (c) => {
  if (!(await requireAdmin(c))) return notFound(c);
  const server = parseOrigin((await c.req.parseBody()).server);
  if (server) await getDb(c.env).delete(serverBudget).where(eq(serverBudget.server, server));
  return c.redirect("/admin", 303);
});

export default app;
