import test from "node:test";
import assert from "node:assert/strict";
import backend from "../../iarchieve-backend/src/http/worker.mjs";
import { createAdminGateway } from "../src/ads-admin-gateway.mjs";

const origin = "https://admin.example.test";
const adminSecret = "a".repeat(64);

function createDatabase() {
  const accounts = new Map([
    ["pub-001", {
      id: "pub-001",
      name: "International Publisher",
      role: "publisher",
      status: "pending",
      created_at: "2026-11-01 00:00:00"
    }]
  ]);

  const credentials = new Map();
  const audits = [];
  const statements = [];

  return {
    accounts,
    credentials,
    audits,
    prepare(sql) {
      const statement = {
        sql,
        params: [],
        bind(...values) {
          this.params = values;
          return this;
        },
        async all() {
          if (sql.includes("FROM ads_publisher_credentials")) {
            return {
              results: [...credentials.values()]
                .filter(item => item.publisher_id === statement.params[0])
                .map(({ token_hash, ...safe }) => safe)
            };
          }

          if (sql.includes("FROM ads_audit_log")) {
            return { results: [...audits].reverse() };
          }

          if (sql.includes("FROM ads_accounts")) {
            return {
              results: [...accounts.values()]
                .filter(item => item.role === "publisher")
            };
          }

          throw new Error(`Unrecognized all(): ${sql}`);
        },
        async first() {
          if (sql.includes("FROM ads_accounts")) {
            const account = accounts.get(statement.params[0]);
            if (!account || account.role !== "publisher") return null;
            if (sql.includes("status='active'") &&
                account.status !== "active") return null;
            return account;
          }

          if (sql.includes("FROM ads_publisher_credentials")) {
            return credentials.get(statement.params[0]) ?? null;
          }

          throw new Error(`Unrecognized first(): ${sql}`);
        }
      };
      statements.push(statement);
      return statement;
    },
    async batch(batchStatements) {
      const results = [];

      for (const item of batchStatements) {
        const sql = item.sql.replace(/\s+/g, " ").trim();
        const p = item.params;
        let changes = 1;

        if (sql.startsWith("UPDATE ads_accounts")) {
          const account = accounts.get(p[1]);
          if (!account || account.status !== p[2]) changes = 0;
          else account.status = p[0];
        } else if (sql.startsWith("UPDATE ads_publisher_credentials")) {
          const credential = credentials.get(p[0]);
          if (!credential || credential.status !== "active") changes = 0;
          else {
            credential.status = "revoked";
            credential.revoked_at = new Date().toISOString();
          }
        } else if (sql.startsWith("INSERT INTO ads_publisher_credentials")) {
          const id = p[0];
          const publisherId = p[1];
          if (credentials.has(id)) changes = 0;
          else credentials.set(id, {
            id,
            publisher_id: publisherId,
            token_hash: p[2],
            status: "active",
            created_at: new Date().toISOString(),
            revoked_at: null
          });
        } else if (sql.startsWith("INSERT INTO ads_audit_log")) {
          audits.push({
            id: p[0],
            actor_id: p[1],
            action: p[2],
            target_type: p[3],
            target_id: p[4],
            created_at: new Date().toISOString()
          });
        } else {
          throw new Error(`Unrecognized batch SQL: ${sql}`);
        }

        results.push({ meta: { changes } });
      }

      return results;
    }
  };
}

function createHarness() {
  const database = createDatabase();
  const backendEnvironment = {
    ADS_ADMIN_TOKEN: adminSecret,
    ADS_DB: database
  };

  const stableSessionExpiry = Math.floor(Date.now() / 1000) + 3600;

  const gateway = createAdminGateway({
    verify: async () => ({
      subject: "test-admin",
      email: "owner@example.test",
      expiresAt: stableSessionExpiry
    })
  });

  const env = {
    ADS_ADMIN_CSRF_SECRET: "local-only-csrf-test-secret-1234567890123456",
    ADS_ADMIN_TOKEN: adminSecret,
    ADS_BACKEND: {
      async fetch(request) {
        return backend.fetch(request, backendEnvironment);
      }
    }
  };

  async function call(path, method = "GET", body, csrf = null) {
    const headers = {};

    if (method !== "GET") {
      headers.Origin = origin;
      headers["Content-Type"] = "application/json";
      if (csrf) headers["X-CSRF-Token"] = csrf;
    }

    const request = new Request(origin + path, {
      method,
      headers,
      body: method === "GET" ? undefined :
        JSON.stringify(body === undefined ? {} : body)
    });

    return gateway.fetch(request, env);
  }

  return { call, database };
}

test("publisher approval flows through gateway to backend", async () => {
  const { call, database } = createHarness();

  const session = await call("/api/ads/admin/session");
  assert.equal(session.status, 200);

  const { csrf_token } = await session.json();
  const before = await call("/api/ads/admin/publishers");
  assert.equal(before.status, 200);

  const beforeData = await before.json();
  assert.equal(beforeData.items[0].status, "pending");

  const approval = await call(
    "/api/ads/admin/publishers/pub-001",
    "PATCH",
    { status: "active" },
    csrf_token
  );

  assert.equal(approval.status, 200);
  assert.equal(database.accounts.get("pub-001").status, "active");

  const after = await call("/api/ads/admin/publishers");
  assert.equal((await after.json()).items[0].status, "active");

  assert.ok(database.audits.some(
    record => record.action === "publisher:pending->active"
  ));
});

test("issue, rotate and revoke are routed to real backend handlers", async () => {
  const { call, database } = createHarness();
  database.accounts.get("pub-001").status = "active";

  const session = await call("/api/ads/admin/session");
  const { csrf_token } = await session.json();

  const issuedResponse = await call(
    "/api/ads/publisher-credentials",
    "POST",
    { publisher_id: "pub-001" },
    csrf_token
  );

  assert.equal(issuedResponse.status, 201);
  const issued = await issuedResponse.json();
  assert.match(issued.token, /^[a-f0-9]{64}$/);

  const list = await call(
    "/api/ads/admin/publishers/pub-001/credentials"
  );

  assert.equal(list.status, 200);
  const listed = await list.json();
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].id, issued.credential_id);
  assert.equal(listed.items[0].token, undefined);
  assert.equal(listed.items[0].token_hash, undefined);

  const rotatedResponse = await call(
    `/api/ads/publisher-credentials/${issued.credential_id}/rotate`,
    "POST",
    {},
    csrf_token
  );

  assert.equal(rotatedResponse.status, 201);
  const rotated = await rotatedResponse.json();
  assert.notEqual(rotated.credential_id, issued.credential_id);
  assert.notEqual(rotated.token, issued.token);

  assert.equal(
    database.credentials.get(issued.credential_id).status,
    "revoked"
  );

  const revokedResponse = await call(
    `/api/ads/publisher-credentials/${rotated.credential_id}/revoke`,
    "POST",
    {},
    csrf_token
  );

  assert.equal(revokedResponse.status, 200);
  assert.equal(
    database.credentials.get(rotated.credential_id).status,
    "revoked"
  );

  const auditResponse = await call("/api/ads/audit");
  assert.equal(auditResponse.status, 200);

  const audit = await auditResponse.json();
  const actions = audit.items.map(record => record.action);

  assert.ok(actions.includes("credential:issued"));
  assert.ok(actions.includes("credential:rotated_out"));
  assert.ok(actions.includes("credential:rotated_in"));
  assert.ok(actions.includes("credential:revoked"));
});

test("CSRF rejection prevents backend state changes", async () => {
  const { call, database } = createHarness();

  const response = await call(
    "/api/ads/admin/publishers/pub-001",
    "PATCH",
    { status: "active" }
  );

  assert.equal(response.status, 403);
  assert.equal(database.accounts.get("pub-001").status, "pending");
  assert.equal(database.audits.length, 0);
});

test("suspended publishers cannot receive new access keys", async () => {
  const { call, database } = createHarness();
  database.accounts.get("pub-001").status = "suspended";

  const session = await call("/api/ads/admin/session");
  const { csrf_token } = await session.json();

  const response = await call(
    "/api/ads/publisher-credentials",
    "POST",
    { publisher_id: "pub-001" },
    csrf_token
  );

  assert.equal(response.status, 422);
  assert.equal(database.credentials.size, 0);
});
