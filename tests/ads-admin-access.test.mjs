import test from "node:test";
import assert from "node:assert/strict";
import { verifyAdminAccess } from "../src/ads-admin-access.mjs";

const team = "example.cloudflareaccess.com";
const aud = "ads-admin-test-audience";

const env = {
  ADS_ACCESS_TEAM_DOMAIN: team,
  ADS_ACCESS_AUD: aud,
  ADS_ADMIN_ALLOWED_EMAILS: "owner@example.com"
};

const pair = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
  },
  true,
  ["sign", "verify"]
);

const publicJwk = {
  ...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
  kid: "test-key",
  alg: "RS256",
  use: "sig"
};

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encode(data) {
  return base64url(new TextEncoder().encode(JSON.stringify(data)));
}

async function makeToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);

  const header = encode({ alg: "RS256", kid: "test-key" });
  const payload = encode({
    iss: `https://${team}`,
    aud,
    sub: "test-admin",
    email: "owner@example.com",
    iat: now,
    exp: now + 300,
    ...overrides
  });

  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    pair.privateKey,
    new TextEncoder().encode(input)
  );

  return `${input}.${base64url(new Uint8Array(signature))}`;
}

function request(token) {
  return new Request("https://example.com/api/ads/admin/session", {
    headers: token ? { "Cf-Access-Jwt-Assertion": token } : {}
  });
}

const fetcher = async () => Response.json({ keys: [publicJwk] });
const check = (token, settings = env) =>
  verifyAdminAccess(request(token), settings, { fetcher });

test("valid signed administrator JWT is accepted", async () => {
  const result = await check(await makeToken());
  assert.equal(result?.email, "owner@example.com");
  assert.equal(result?.subject, "test-admin");
});

test("missing token is rejected", async () => {
  assert.equal(await check(null), null);
});

test("expired token is rejected", async () => {
  assert.equal(await check(await makeToken({ exp: 1 })), null);
});

test("wrong application audience is rejected", async () => {
  assert.equal(await check(await makeToken({ aud: "other" })), null);
});

test("wrong issuer is rejected", async () => {
  assert.equal(
    await check(await makeToken({ iss: "https://invalid.example" })),
    null
  );
});

test("unlisted administrator is rejected", async () => {
  assert.equal(
    await check(await makeToken({ email: "unknown@example.com" })),
    null
  );
});

test("tampered signature is rejected", async () => {
  const token = await makeToken();
  const parts = token.split(".");
  parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
  assert.equal(await check(parts.join(".")), null);
});

test("unconfigured Access fails closed", async () => {
  await assert.rejects(
    () => check(awaitTokenPlaceholder(), {}),
    /access_not_configured/
  );
});

function awaitTokenPlaceholder() {
  return null;
}
