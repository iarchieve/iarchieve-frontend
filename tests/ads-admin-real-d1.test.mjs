import test from "node:test";
import assert from "node:assert/strict";
import { createAdminGateway } from "../src/ads-admin-gateway.mjs";

const endpoint = process.env.ADS_REAL_D1_BACKEND_URL;
const secret = process.env.ADS_REAL_D1_TEST_TOKEN;
const publisher = process.env.ADS_REAL_D1_PUBLISHER_ID;

if (!endpoint || !secret || !publisher) {
  throw new Error("Isolated D1 environment missing");
}

const origin = "https://admin.integration.test";

const gateway = createAdminGateway({
  verify: async () => ({
    subject: "isolated-test-admin",
    email: "admin@integration.test",
    expiresAt: Math.floor(Date.now() / 1000) + 1800
  })
});

const environment = {
  ADS_ADMIN_TOKEN: secret,
  ADS_ADMIN_CSRF_SECRET: "isolated-local-csrf-secret-only-123456789",
  ADS_BACKEND: {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      return fetch(endpoint + path, {
        method: request.method,
        headers: request.headers,
        body: request.method === "GET" ? undefined : await request.text(),
        redirect: "error"
      });
    }
  }
};

async function call(path, method = "GET", data, csrf) {
  const headers = { Accept: "application/json" };

  if (method !== "GET") {
    headers.Origin = origin;
    headers["Content-Type"] = "application/json";
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  return gateway.fetch(new Request(origin + path, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(data ?? {})
  }), environment);
}

test("real D1 publisher and credential lifecycle", async () => {
  const sessionResponse = await call("/api/ads/admin/session");
  assert.equal(sessionResponse.status, 200);
  const session = await sessionResponse.json();
  const csrf = session.csrf_token;

  const before = await call("/api/ads/admin/publishers");
  assert.equal(before.status, 200);
  assert.equal(
    (await before.json()).items.find(x => x.id === publisher)?.status,
    "pending"
  );

  const blocked = await call(
    `/api/ads/admin/publishers/${publisher}`,
    "PATCH", { status: "active" }
  );
  assert.equal(blocked.status, 403);

  const approved = await call(
    `/api/ads/admin/publishers/${publisher}`,
    "PATCH", { status: "active" }, csrf
  );
  assert.equal(approved.status, 200);

  const issued = await call(
    "/api/ads/publisher-credentials",
    "POST", { publisher_id: publisher }, csrf
  );
  assert.equal(issued.status, 201);

  const original = await issued.json();
  assert.match(original.token, /^[a-f0-9]{64}$/);

  const listed = await call(
    `/api/ads/admin/publishers/${publisher}/credentials`
  );
  assert.equal(listed.status, 200);

  const credentials = await listed.json();
  assert.equal(credentials.items.length, 1);
  assert.equal(credentials.items[0].token, undefined);
  assert.equal(credentials.items[0].token_hash, undefined);

  const rotated = await call(
    `/api/ads/publisher-credentials/${original.credential_id}/rotate`,
    "POST", {}, csrf
  );
  assert.equal(rotated.status, 201);

  const replacement = await rotated.json();
  assert.notEqual(replacement.token, original.token);

  const revoked = await call(
    `/api/ads/publisher-credentials/${replacement.credential_id}/revoke`,
    "POST", {}, csrf
  );
  assert.equal(revoked.status, 200);

  const auditResponse = await call("/api/ads/audit");
  assert.equal(auditResponse.status, 200);
  const audit = await auditResponse.json();
  const actions = audit.items.map(x => x.action);

  for (const action of [
    "publisher:pending->active",
    "credential:issued",
    "credential:rotated_out",
    "credential:rotated_in",
    "credential:revoked"
  ]) {
    assert.ok(actions.includes(action), `Missing audit: ${action}`);
  }
});
