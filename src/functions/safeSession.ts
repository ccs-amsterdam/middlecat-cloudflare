import { auth } from "@/auth/auth";
import { cookies } from "next/headers";

/**
 * Retrieves the user's session and performs necessary validations.
 *
 * @param csrfToken - The CSRF token to be verified. Should be included in req headers/body
 * @returns An object containing the user's email and any potential error.
 */
export default async function safeSession(csrfToken: string) {
  const session = await auth();
  if (!session?.user?.email) {
    return { email: undefined, error: "Need to be signed in" };
  }

  const validCSRF = await verifyCSRF(csrfToken);
  if (!validCSRF) {
    return { email: undefined, error: "Invalid CSRF token" };
  }

  return { email: session.user.email, error: undefined };
}

// authjs doesn't expose a function for getting and validating the
// CSRF cookie. Now doing it manually, but should be a better way
async function verifyCSRF(csrfToken: string): Promise<boolean> {
  // look for ".*csrf-token.*", because apparently the exact name can differ depending on host
  // TODO: specify when we know the exact options (but safe enough because of the hash)
  const cookieVals = cookies()
    .getAll()
    .find((item) => item.name.includes("csrf-token"));
  const [token, hash] = decodeURI(cookieVals?.value || "").split("|");

  // verify csrfToken (from header/body of request) matches the one in the cookie
  if (token !== csrfToken) return false;

  // verify hash
  const secret = process.env.NEXTAUTH_SECRET;
  const validHash = await digestMessage(`${token}${secret}`);
  if (hash !== validHash) return false;

  return true;
}

// Need to use web crypto API to make this work on edge.
// Bit of a hassle to get digest as hex string. see:
// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#examples
async function digestMessage(message: string) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(""); // convert bytes to hex string
  return hashHex;
}
