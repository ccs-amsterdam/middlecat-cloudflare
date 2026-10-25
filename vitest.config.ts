import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            BETTER_AUTH_URL: "http://localhost:3000",
            BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
            KEY_ENCRYPTION_SECRET: "test-key-encryption-secret-0123456789",
            MIDDLECAT_ADMINS: "admin@example.com",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
