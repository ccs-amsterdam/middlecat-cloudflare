import * as jose from "jose";
import { isNull, lte } from "drizzle-orm";
import { getDb } from "../drizzle/db";
import { signingKey } from "../drizzle/schema";
import settings from "./settings";

// Token signing keys, managed by MiddleCat itself and rotated on a fixed schedule.
//
// Time is divided into periods (settings.signing_key_period_days). The key of period n:
//  - is published in the JWKS from the start of period n-1 ("next"), so verifiers can cache it before it's used
//  - signs all tokens during period n ("current")
//  - stays published until every token it signed has expired ("previous")
// Because every period has exactly one key (unique index), concurrent workers can't create conflicting keys:
// whoever inserts the key of a period first wins, and the others use that key.
//
// Private keys are stored encrypted (AES-GCM, key derived from KEY_ENCRYPTION_SECRET), so a database
// export or backup doesn't contain usable signing keys.

const ALG = "RS256";
const DAY = 24 * 60 * 60 * 1000;
// how long an isolate uses the keys it loaded before reading them from the database again
const CACHE_MS = 5 * 60 * 1000;

interface KeyEnv {
  DB1: D1Database;
  KEY_ENCRYPTION_SECRET: string;
}

export interface PublicJwk {
  kty: "RSA";
  use: "sig";
  alg: string;
  kid: string;
  n: string;
  e: string;
}

export interface KeySet {
  /** key that signs new tokens */
  signing: { kid: string; privateKey: CryptoKey };
  /** all published keys (next, current, previous) */
  jwks: { keys: PublicJwk[] };
  /** for verifying our own tokens (e.g. at /api/userinfo) */
  jwkSet: ReturnType<typeof jose.createLocalJWKSet>;
}

type KeyRow = typeof signingKey.$inferSelect;

function periodMs() {
  return settings.signing_key_period_days * DAY;
}

function maxTokenLifetimeMs() {
  return settings.access_expire_minutes * 60 * 1000;
}

export function periodOf(time: number) {
  return Math.floor(time / periodMs());
}

function periodSchedule(period: number) {
  const activatesAt = period * periodMs();
  const retiresAt = activatesAt + periodMs();
  // keep publishing until all tokens signed with it are expired, plus a margin for clock skew and caching
  const removesAt = retiresAt + maxTokenLifetimeMs() + DAY;
  return { activatesAt: new Date(activatesAt), retiresAt: new Date(retiresAt), removesAt: new Date(removesAt) };
}

// --- encryption of private keys

const enc = (s: string) => new TextEncoder().encode(s);

async function wrappingKey(secret: string) {
  if (!secret || secret.length < 32) throw new Error("KEY_ENCRYPTION_SECRET must be set (at least 32 characters)");
  const base = await crypto.subtle.importKey("raw", enc(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc("middlecat-signing-keys"), info: enc("v1") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// the kid is used as additional authenticated data, so an encrypted key can't be moved to another row
async function encryptPrivateKey(secret: string, kid: string, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await wrappingKey(secret);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc(kid) }, key, enc(plaintext));
  return `v1.${jose.base64url.encode(iv)}.${jose.base64url.encode(new Uint8Array(ciphertext))}`;
}

async function decryptPrivateKey(secret: string, kid: string, encrypted: string) {
  const [version, iv, ciphertext] = encrypted.split(".");
  if (version !== "v1" || !iv || !ciphertext) throw new Error(`Unknown encryption format for signing key ${kid}`);
  const key = await wrappingKey(secret);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: jose.base64url.decode(iv), additionalData: enc(kid) },
      key,
      jose.base64url.decode(ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error(`Could not decrypt signing key ${kid}. Was KEY_ENCRYPTION_SECRET changed?`);
  }
}

// --- key creation and rotation

async function createKey(env: KeyEnv, period: number) {
  const { privateKey } = await jose.generateKeyPair(ALG, { modulusLength: 2048, extractable: true });
  const privateJwk = await jose.exportJWK(privateKey);
  const { n, e } = privateJwk;
  if (!n || !e) throw new Error("Signing key is not an RSA key");
  const kid = await jose.calculateJwkThumbprint({ kty: "RSA", n, e });

  await getDb(env)
    .insert(signingKey)
    .values({
      kid,
      period,
      alg: ALG,
      publicJwk: JSON.stringify({ kty: "RSA", n, e }),
      privateKeyEncrypted: await encryptPrivateKey(env.KEY_ENCRYPTION_SECRET, kid, JSON.stringify(privateJwk)),
      createdAt: new Date(),
      ...periodSchedule(period),
    })
    // another worker created the key for this period first
    .onConflictDoNothing();
}

/**
 * Make sure the keys for the current and next period exist, and delete keys that are no longer needed.
 * Runs from the cron trigger, and whenever an isolate loads its keys.
 */
export async function ensureKeys(env: KeyEnv, now = Date.now()): Promise<KeyRow[]> {
  const db = getDb(env);
  await db.delete(signingKey).where(lte(signingKey.removesAt, new Date(now)));

  const period = periodOf(now);
  const activeKeys = () => db.select().from(signingKey).where(isNull(signingKey.revokedAt));
  let rows = await activeKeys();
  const has = (p: number) => rows.some((r) => r.period === p);

  if (!has(period) || !has(period + 1)) {
    if (!has(period)) await createKey(env, period);
    if (!has(period + 1)) await createKey(env, period + 1);
    rows = await activeKeys();
  }
  return rows;
}

/** Emergency rotation: stop using and publishing all current keys. New keys are created on the next request. */
export async function revokeAllKeys(env: KeyEnv, now = Date.now()) {
  await getDb(env)
    .update(signingKey)
    .set({ revokedAt: new Date(now) })
    .where(isNull(signingKey.revokedAt));
}

export async function loadKeySet(env: KeyEnv, now = Date.now()): Promise<KeySet> {
  const rows = await ensureKeys(env, now);
  const current = rows.find((r) => r.period === periodOf(now));
  if (!current) throw new Error("No signing key for the current period");

  const privateJwk = JSON.parse(await decryptPrivateKey(env.KEY_ENCRYPTION_SECRET, current.kid, current.privateKeyEncrypted));
  const privateKey = (await jose.importJWK(privateJwk, ALG)) as CryptoKey;

  const published = rows
    .filter((r) => r.removesAt.getTime() > now)
    .sort((a, b) => b.activatesAt.getTime() - a.activatesAt.getTime());
  const keys: PublicJwk[] = published.map((r) => {
    const { n, e } = JSON.parse(r.publicJwk);
    return { kty: "RSA", use: "sig", alg: r.alg, kid: r.kid, n, e };
  });
  const jwks = { keys };

  return {
    signing: { kid: current.kid, privateKey },
    jwks,
    jwkSet: jose.createLocalJWKSet(jwks),
  };
}

let cache: { loadedAt: number; keys: Promise<KeySet> } | undefined;

/** The key set, cached per isolate for a few minutes */
export function getKeySet(env: KeyEnv): Promise<KeySet> {
  if (!cache || Date.now() - cache.loadedAt > CACHE_MS) {
    const entry = { loadedAt: Date.now(), keys: loadKeySet(env) };
    entry.keys.catch(() => {
      if (cache === entry) cache = undefined;
    });
    cache = entry;
  }
  return cache.keys;
}

/** for tests */
export function clearKeyCache() {
  cache = undefined;
}
