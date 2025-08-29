import type { Config } from "drizzle-kit";

export default {
  schema: "./src/drizzle/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
} satisfies Config;
