import { env } from "cloudflare:workers";
import * as jose from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { ensureKeys, loadKeySet, periodOf, revokeAllKeys } from "../src/lib/keys";
import settings from "../src/lib/settings";

const DAY = 24 * 60 * 60 * 1000;
const PERIOD = settings.signing_key_period_days * DAY;
const HOUR = 60 * 60 * 1000;
// middle of some period, and the start of the next period
const T0 = (periodOf(Date.now()) + 0.5) * PERIOD;
const NEXT = (periodOf(Date.now()) + 1) * PERIOD;

async function sign(now: number) {
  const { signing } = await loadKeySet(env, now);
  return new jose.SignJWT({ sub: "x" }).setProtectedHeader({ alg: "RS256", kid: signing.kid }).sign(signing.privateKey);
}

async function verifies(token: string, now: number) {
  const { jwkSet } = await loadKeySet(env, now);
  try {
    await jose.jwtVerify(token, jwkSet, { algorithms: ["RS256"] });
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  await env.DB1.prepare("DELETE FROM signingKey").run();
});

describe("signing keys", () => {
  it("creates the current and next key on first use", async () => {
    const keys = await loadKeySet(env, T0);
    expect(keys.jwks.keys).toHaveLength(2);
    expect(keys.jwks.keys.map((k) => k.kid)).toContain(keys.signing.kid);
  });

  it("publishes the next key a period before it signs, and the previous key until its tokens expired", async () => {
    const current = await loadKeySet(env, T0);
    const next = current.jwks.keys.find((k) => k.kid !== current.signing.kid)!;

    // next period: the next key signs, the old one is still published
    const later = await loadKeySet(env, NEXT + HOUR);
    expect(later.signing.kid).toBe(next.kid);
    expect(later.jwks.keys.map((k) => k.kid)).toContain(current.signing.kid);
    expect(later.jwks.keys).toHaveLength(3);

    // a day after all its tokens expired, the old key is removed
    const muchLater = await loadKeySet(env, NEXT + DAY + 2 * HOUR);
    expect(muchLater.jwks.keys.map((k) => k.kid)).not.toContain(current.signing.kid);
  });

  it("tokens verify across a rotation until their key is removed", async () => {
    const token = await sign(T0);
    expect(await verifies(token, T0)).toBe(true);
    expect(await verifies(token, NEXT + HOUR)).toBe(true);
    expect(await verifies(token, NEXT + DAY + 2 * HOUR)).toBe(false);
  });

  it("creates one key per period, also when called concurrently", async () => {
    await Promise.all([ensureKeys(env, T0), ensureKeys(env, T0), ensureKeys(env, T0)]);
    const { results } = await env.DB1.prepare("SELECT period FROM signingKey WHERE revokedAt IS NULL").all();
    expect(results).toHaveLength(2);
  });

  it("stores private keys encrypted", async () => {
    await ensureKeys(env, T0);
    const row = await env.DB1.prepare("SELECT kid, privateKeyEncrypted FROM signingKey LIMIT 1").first<{
      kid: string;
      privateKeyEncrypted: string;
    }>();
    expect(row!.privateKeyEncrypted).toMatch(/^v1\./);
    expect(row!.privateKeyEncrypted).not.toContain('"d"');
    await expect(loadKeySet({ ...env, KEY_ENCRYPTION_SECRET: "another-secret-another-secret-12345" }, T0)).rejects.toThrow(
      /decrypt/,
    );
  });

  it("revoking replaces all keys immediately", async () => {
    const before = await loadKeySet(env, T0);
    const token = await sign(T0);
    await revokeAllKeys(env, T0);
    const after = await loadKeySet(env, T0);
    expect(after.signing.kid).not.toBe(before.signing.kid);
    expect(after.jwks.keys.map((k) => k.kid)).not.toContain(before.signing.kid);
    expect(await verifies(token, T0)).toBe(false);
  });
});
