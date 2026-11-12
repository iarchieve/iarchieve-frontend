import test from "node:test";
import assert from "node:assert/strict";
import { createAdsAdminWorker } from "../src/ads-admin-worker.mjs";

const origin = "https://example.test";
const calls = [];

const assets = {
  async fetch(request) {
    calls.push(new URL(request.url).pathname);
    return new Response("<html>Admin page</html>", {
      headers: { "Content-Type": "text/html" }
    });
  }
};

const gateway = {
  async fetch() {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
};

function makeWorker(authenticated) {
  return createAdsAdminWorker({
    adminGateway: gateway,
    verify: async () => authenticated ? {
      subject: "test-admin"
    } : null
  });
}

test("public page remains available", async () => {
  calls.length = 0;

  const response = await makeWorker(false).fetch(
    new Request(origin + "/"),
    { ASSETS: assets }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/"]);
});

test("administrator page is blocked without authentication", async () => {
  calls.length = 0;

  const response = await makeWorker(false).fetch(
    new Request(origin + "/ads/admin.html"),
    { ASSETS: assets }
  );

  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("administrator page is served after authentication", async () => {
  calls.length = 0;

  const response = await makeWorker(true).fetch(
    new Request(origin + "/ads/admin"),
    { ASSETS: assets }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/ads/admin.html"]);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
});

test("administrator API always reaches gateway", async () => {
  calls.length = 0;

  const response = await makeWorker(false).fetch(
    new Request(origin + "/api/ads/admin/session"),
    { ASSETS: assets }
  );

  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("unknown advertising API is never served as HTML", async () => {
  calls.length = 0;

  const response = await makeWorker(false).fetch(
    new Request(origin + "/api/ads/unknown"),
    { ASSETS: assets }
  );

  assert.equal(response.status, 404);
  assert.equal(calls.length, 0);
});

test("publisher credential API routes through gateway", async () => {
  calls.length = 0;

  const response = await makeWorker(false).fetch(
    new Request(origin + "/api/ads/publisher-credentials"),
    { ASSETS: assets }
  );

  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("missing asset binding fails closed", async () => {
  const response = await makeWorker(true).fetch(
    new Request(origin + "/ads/admin.html"),
    {}
  );

  assert.equal(response.status, 503);
});

test("unsupported method cannot fetch protected HTML", async () => {
  calls.length = 0;

  const response = await makeWorker(true).fetch(
    new Request(origin + "/ads/admin.html", { method: "POST" }),
    { ASSETS: assets }
  );

  assert.equal(response.status, 405);
  assert.equal(calls.length, 0);
});

test("Access verification errors do not expose HTML", async () => {
  const failing = createAdsAdminWorker({
    adminGateway: gateway,
    verify: async () => { throw new Error("No Access config"); }
  });

  calls.length = 0;

  const response = await failing.fetch(
    new Request(origin + "/ads/admin.html"),
    { ASSETS: assets }
  );

  assert.equal(response.status, 503);
  assert.equal(calls.length, 0);
});
