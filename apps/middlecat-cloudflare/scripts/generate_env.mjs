import { generateKeyPair } from "jose";
import crypto from "crypto";

const keypair = await generateKeyPair("RS256");

function hexSecret(n) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) =>
    b.toString(32).padStart(2, "0"),
  ).join("");
}

const secret = hexSecret(32);
const publicKey = keypair.publicKey.export({ type: "spki", format: "pem" });
const privateKey = keypair.privateKey.export({ type: "pkcs8", format: "pem" });

const content = `NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${secret}
NEXT_PUBLIC_PUBLICKEY="${publicKey}"
PRIVATEKEY="${privateKey}"
GOOGLE_ID="<your google id>"
GOOGLE_SECRET="<your google secret>"
GITHUB_ID="<your github id>"
GITHUB_SECRET="<your github secret>"
`;

console.log(content);
