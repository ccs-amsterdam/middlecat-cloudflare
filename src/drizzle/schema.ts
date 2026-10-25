import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";

// AUTH TABLES (Better Auth core schema, see https://www.better-auth.com/docs/concepts/database)
// These hold the login to MiddleCat itself. Users without an active MiddleCat login are deleted by the
// hourly cleanup, so email addresses are only stored here while someone is signed in.

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = sqliteTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("lastRequest").notNull(),
});

// MIDDLECAT TABLES

// A user's login at a server (one per authorization code / refresh token).
// The user's email, name and picture are stored encrypted with a key derived from the authorization code,
// and after the code exchange from the current refresh token. Only the server holding the token can unlock them.
// emailHash (keyed hash, see lib/emailIndex.ts) lets the user find their sessions in the dashboard.
export const serverSession = sqliteTable(
  "serverSession",
  {
    id: text("id").primaryKey(),
    server: text("server").notNull(), // origin of the server, e.g. https://amcat.nl
    resource: text("resource").notNull(), // e.g. https://amcat.nl/api (the token audience)
    clientId: text("clientId").notNull(),
    scope: text("scope").notNull(),
    emailHash: text("emailHash").notNull(),
    userInfoEncrypted: text("userInfoEncrypted").notNull(),
    authTime: integer("authTime", { mode: "timestamp_ms" }).notNull(),

    // authorization code: id + secret, of which only the hash is stored. codeExpires is null once used.
    codeChallenge: text("codeChallenge").notNull(),
    codeSecretHash: text("codeSecretHash").notNull(),
    codeExpires: integer("codeExpires", { mode: "timestamp_ms" }),
    redirectUri: text("redirectUri").notNull(),
    nonce: text("nonce"),

    // refresh token: id + secret, of which only the hash is stored. After a rotation, the previous token can be
    // reused during a grace period and gets the same new token (encrypted with a key derived from the previous token).
    refreshTokenHash: text("refreshTokenHash").notNull(),
    refreshPreviousHash: text("refreshPreviousHash"),
    rotatedAt: integer("rotatedAt", { mode: "timestamp_ms" }),
    refreshNextEncrypted: text("refreshNextEncrypted"),

    createdOn: text("createdOn").notNull(), // browser and OS, shown in the dashboard
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("serverSession_emailHash_idx").on(table.emailHash),
    index("serverSession_expires_idx").on(table.expires),
  ],
);

// The user confirmed signing in to this server, so later sign-ins don't ask again
export const serverConsent = sqliteTable(
  "serverConsent",
  {
    emailHash: text("emailHash").notNull(),
    server: text("server").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.emailHash, table.server] })],
);

// Daily login counters for the free-tier limits and server budgets (see lib/usage.ts)
export const usageCounter = sqliteTable(
  "usageCounter",
  {
    bucket: text("bucket").notNull(),
    day: text("day").notNull(), // YYYY-MM-DD (UTC)
    count: integer("count").notNull(),
  },
  (table) => [primaryKey({ columns: [table.bucket, table.day] })],
);

// A dedicated daily budget for a server, set by an admin. Servers with a budget don't count against the free tier.
export const serverBudget = sqliteTable("serverBudget", {
  server: text("server").primaryKey(),
  emailPerDay: integer("emailPerDay").notNull(),
  socialPerDay: integer("socialPerDay").notNull(),
  note: text("note"),
  approvedBy: text("approvedBy").notNull(),
  approvedAt: integer("approvedAt", { mode: "timestamp_ms" }).notNull(),
});

// Token signing keys. Keys follow a fixed schedule of periods (see lib/keys.ts): the key of period n signs
// tokens during that period, is published one period before (next) and stays published until all tokens
// it signed have expired (previous). Private keys are encrypted with KEY_ENCRYPTION_SECRET.
export const signingKey = sqliteTable(
  "signingKey",
  {
    kid: text("kid").primaryKey(),
    period: integer("period").notNull(),
    alg: text("alg").notNull(),
    publicJwk: text("publicJwk").notNull(),
    privateKeyEncrypted: text("privateKeyEncrypted").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    activatesAt: integer("activatesAt", { mode: "timestamp_ms" }).notNull(),
    retiresAt: integer("retiresAt", { mode: "timestamp_ms" }).notNull(),
    removesAt: integer("removesAt", { mode: "timestamp_ms" }).notNull(),
    // revoked keys are no longer published or used (emergency rotation)
    revokedAt: integer("revokedAt", { mode: "timestamp_ms" }),
  },
  // one active key per period, so concurrent workers can't create conflicting keys
  (table) => [uniqueIndex("signingKey_period_active").on(table.period).where(sql`revokedAt IS NULL`)],
);
