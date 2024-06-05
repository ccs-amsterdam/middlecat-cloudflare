import { generateKeyPair } from "jose";

const keypair = await generateKeyPair("RS256");

function hexSecret(n) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
}

const secret = hexSecret(32);
const publicKey = keypair.publicKey.export({ type: "spki", format: "pem" });
const privateKey = keypair.privateKey.export({ type: "pkcs8", format: "pem" });

console.log(`NEXTAUTH_URL=<url of where your middlecat is hosted>`);
console.log(`NEXTAUTH_SECRET=${secret}`);

console.log(`NEXT_PUBLIC_PUBLICKEY="${publicKey}"`);
console.log(`PRIVATEKEY="${privateKey}"`);

console.log("GOOGLE_ID=<your google id>");
console.log("GOOGLE_SECRET=<your google secret>");

console.log("GITHUB_ID=<your github id>");
console.log("GITHUB_SECRET=<your github secret>");
