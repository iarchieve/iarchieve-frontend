import test from "node:test";
import assert from "node:assert/strict";
import { createAdminGateway } from "../src/ads-admin-gateway.mjs";

const origin = "https://ads.example.test";
const secret = "A".repeat(64);

const access = {
  subject: "admin-001",
  email: "owner@example.com",
  expiresAt: 2000000000
};

const csrfSecret = "development-test-secret-not-for-production-123456789";

function environment() {
  const calls = [];
  const env = {
    ADS_ADMIN_TOKEN: secret,
    ADS_ADMIN_CSRF_SECRET: csrfSecret,
    ADS_BACKEND: {
      async fetch(request) {
        calls.push({
          method: request.method,
          path: new URL(request.url).pathname,
          authorization: request.headers.get("Authorization"),
          cookie: request.headers.get("Cookie")
        });

        return Response.json({ items: [] }, {
          headers: { "Cache-Control": "no-store" }
        });
      }
    }
  };

  return { env, calls };
}

function gateway(user = access) {
  return createAdminGateway({
    verify: async () => user
  });
}

function request(path, method = "GET", options = {}) {
  return new Request(origin + path, {
    method,
    headers: options.headers,
    body: options.body
  });
}

test("session returns CSRF token without admin secret", async () => {
  const { env, calls } = environment();
  const response = await gateway().fetch(
    request("/api/ads/admin/session"), env
  );

  assert.equal(response.status, 200);

  const data = await response.json();
  assert.equal(data.authenticated, true);
  assert.match(data.csrf_token, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(data).includes(secret));
  assert.equal(calls.length, 0);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("unauthenticated browser cannot call API", async () => {
  const { env, calls } = environment();
  const response = await gateway(null).fetch(
    request("/api/ads/admin/publishers"), env
  );

  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("admin API uses server secret only", async () => {
  const { env, calls } = environment();
  const response = await gateway().fetch(
    request("/api/ads/admin/publishers", "GET", {
      headers: {
        Authorization: "Bearer " + "B".repeat(64),
        Cookie: "CF_Authorization=fake"
      }
    }),
    env
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].authorization, `Bearer ${secret}`);
  assert.equal(calls[0].cookie, null);
});

test("mutation needs same-origin and valid CSRF", async () => {
  const { env, calls } = environment();
  const app = gateway();
  const session = await app.fetch(
    request("/api/ads/admin/session"), env
  );
  const { csrf_token } = await session.json();

  const path = "/api/ads/admin/publishers/pub-001";
  const body = JSON.stringify({ status: "suspended" });

  const missing = await app.fetch(
    request(path, "PATCH", {
      headers: {
        Origin: origin,
        "Content-Type": "application/json"
      },
      body
    }), env
  );

  assert.equal(missing.status, 403);

  const crossOrigin = await app.fetch(
    request(path, "PATCH", {
      headers: {
        Origin: "https://attacker.example",
        "X-CSRF-Token": csrf_token,
        "Content-Type": "application/json"
      },
      body
    }), env
  );

  assert.equal(crossOrigin.status, 403);

  const valid = await app.fetch(
    request(path, "PATCH", {
      headers: {
        Origin: origin,
        "X-CSRF-Token": csrf_token,
        "Content-Type": "application/json"
      },
      body
    }), env
  );

  assert.equal(valid.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PATCH");
});

test("credentials can be issued only through allowed endpoint", async () => {
  const { env, calls } = environment();
  const app = gateway();
  const session = await app.fetch(
    request("/api/ads/admin/session"), env
  );
  const { csrf_token } = await session.json();

  const response = await app.fetch(
    request("/api/ads/publisher-credentials", "POST", {
      headers: {
        Origin: origin,
        "X-CSRF-Token": csrf_token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ publisher_id: "pub-001" })
    }),
    env
  );

  assert.equal(response.status, 200);
  assert.equal(calls[0].path, "/api/ads/publisher-credentials");
});

test("arbitrary backend paths cannot be proxied", async () => {
  const { env, calls } = environment();

  const response = await gateway().fetch(
    request("/api/ads/admin/secrets"), env
  );

  assert.equal(response.status, 404);
  assert.equal(calls.length, 0);
});

test("server secrets and service binding are mandatory", async () => {
  const response = await gateway().fetch(
    request("/api/ads/admin/publishers"),
    { ADS_ADMIN_CSRF_SECRET: csrfSecret }
  );

  assert.equal(response.status, 503);
});

test("invalid configured CSRF secret fails closed", async () => {
  const { env, calls } = environment();
  env.ADS_ADMIN_CSRF_SECRET = "short";

  const response = await gateway().fetch(
    request("/api/ads/admin/session"), env
  );

  assert.equal(response.status, 503);
  assert.equal(calls.length, 0);
});

test("missing administrator claim blocks access", async () => {
  const { env, calls } = environment();
  const app = createAdminGateway({
    verify: async () => null
  });

  const response = await app.fetch(
    request("/api/ads/admin/session"), env
  );

  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("read-only query strings are ignored and never forwarded", async () => {
  const { env, calls } = environment();

  const response = await gateway().fetch(
    request("/api/ads/admin/publishers?debug=true"), env
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/api/ads/admin/publishers");
});

test("mutation query strings remain blocked", async () => {
  const { env, calls } = environment();

  const response = await gateway().fetch(
    request(
      "/api/ads/admin/publishers/pub-001?debug=true",
      "PATCH",
      {
        headers: {
          Origin: origin,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "active" })
      }
    ),
    env
  );

  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test("session ignores harmless query strings", async () => {
  const { env, calls } = environment();

  const response = await gateway().fetch(
    request("/api/ads/admin/session?from=access"), env
  );

  assert.equal(response.status, 200);

  const data = await response.json();
  assert.equal(data.authenticated, true);
  assert.match(data.csrf_token, /^[a-f0-9]{64}$/);
  assert.equal(calls.length, 0);
});

test("backend redirects are explicitly rejected", async () => {
  const { env } = environment();

  env.ADS_BACKEND = {
    async fetch(request) {
      assert.equal(request.redirect, "manual");

      return Response.json(
        { error: "redirect" },
        {
          status: 302,
          headers: {
            Location: "https://untrusted.example.test"
          }
        }
      );
    }
  };

  const response = await gateway().fetch(
    request("/api/ads/admin/publishers"),
    env
  );

  assert.equal(response.status, 502);

  const data = await response.json();
  assert.equal(data.error, "backend_redirect_blocked");
  assert.equal(response.headers.get("Location"), null);
});
