import { integer, sqliteTable, text, primaryKey, index } from "drizzle-orm/sqlite-core";
import type { AdapterAccount } from "@auth/core/adapters";
import { drizzle } from "drizzle-orm/d1";

// AUTH TABLES

export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    pk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => ({
    pk: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const amcatSessions = sqliteTable(
  "amcatSession",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // session management
    type: text("type", { enum: ["browser", "apiKey"] }).notNull(),
    label: text("label").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),

    // authorization code flow
    codeChallenge: text("codeChallenge"),
    secret: text("secret").notNull(),
    secretExpires: integer("secretExpires", {
      mode: "timestamp_ms",
    }),

    // access token
    email: text("email").notNull(),
    name: text("name"),
    image: text("image"),
    createdOn: text("createdOn").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    clientId: text("clientId").notNull(),
    resource: text("resource").notNull(),
    scope: text("scope").notNull(),

    // refresh token
    refreshRotate: integer("refreshRotate", { mode: "boolean" }).notNull(),
    refreshToken: text("refreshToken").notNull(),
    refreshPrevious: text("refreshPrevious"),
  },
  (table) => ({
    emailIdx: index("email_idx").on(table.email),
    expiresIdx: index("expires_idx").on(table.expires),
  })
);

const db = drizzle(process.env.DB1);
export default db;
