import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(env: { DB1: D1Database }) {
  return drizzle(env.DB1, { schema });
}

export type DB = ReturnType<typeof getDb>;
