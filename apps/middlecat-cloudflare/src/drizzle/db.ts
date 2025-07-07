import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

function getDB() {
  if (process.env.NODE_ENV === "development") {
    const { env } = getCloudflareContext();
    return drizzle(env.DB1, { schema });
  }
  // Production
  return drizzle(process.env.DB1, { schema });
}

const db = getDB();
export default db;
