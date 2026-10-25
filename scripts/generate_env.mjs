// Generate a .dev.vars file with fresh secrets for local development.
// usage: node scripts/generate_env.mjs .dev.vars
import { writeFileSync, existsSync } from "node:fs";
import { argv } from "node:process";

const fname = argv[2];
if (!fname) throw new Error("Please provide a filename as an argument");

if (existsSync(fname)) {
  console.error(`File "${fname}" already exists.`);
  process.exit(0);
}

function hexSecret(n) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Token signing keys are created (and rotated) by the worker itself, encrypted with KEY_ENCRYPTION_SECRET
const content = `BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=${hexSecret(32)}
KEY_ENCRYPTION_SECRET=${hexSecret(32)}
GITHUB_ID=
GITHUB_SECRET=
GOOGLE_ID=
GOOGLE_SECRET=
EMAIL_FROM=
RESEND_API_KEY=
MIDDLECAT_ADMINS=
`;

writeFileSync(fname, content, "utf8");
console.log(`Created ${fname}`);
