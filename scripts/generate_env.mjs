import { generateKeyPair } from "jose";

const keypair = await generateKeyPair("RS256");

function hexSecret(n) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

const secret = hexSecret(32);
const publicKey = keypair.publicKey.export({ type: "spki", format: "pem" });
const privateKey = keypair.privateKey.export({ type: "pkcs8", format: "pem" });

console.log(`SECRET=${secret}`);
console.log(`PUBLIC_KEY=${publicKey}`);
console.log(`PRIVATE_KEY=${privateKey}`);
