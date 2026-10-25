import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
      BETTER_AUTH_URL: string;
      BETTER_AUTH_SECRET: string;
      KEY_ENCRYPTION_SECRET: string;
      MIDDLECAT_ADMINS: string;
    }
  }
}
