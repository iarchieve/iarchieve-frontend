import { verifyAdminAccess } from "./ads-admin-access.mjs";

const SESSION = "/api/ads/admin/session";
const PUBLISHERS = /^\/api\/ads\/admin\/publishers(?:\/[A-Za-z0-9_-]{1,128}(?:\/credentials)?)?$/;
const CREDENTIALS = /^\/api\/ads\/publisher-credentials(?:\/[A-Za-z0-9_-]{1,128}\/(?:rotate|revoke))?$/;
const AUDIT = "/api/ads/audit";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function allowedRoute(path, method) {
  if (PUBLISHERS.test(path)) {
    if (path.endsWith("/credentials")) return method === "GET";
    if (path === "/api/ads/admin/publishers") return method === "GET";
    return method === "PATCH";
  }

  if (CREDENTIALS.test(path)) return method === "POST";
  if (path === AUDIT) return method === "GET";
  return false;
}

function hex(bytes) {
  return Array.from(bytes, value =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

async function csrfToken(access, env, origin) {
  const secret = env.ADS_ADMIN_CSRF_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("csrf_not_configured");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const message = [
    "iarchieve-ads-admin-v1",
    access.subject,
    access.email,
    access.expiresAt,
    origin
  ].join("\n");

  return hex(new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(message)
  )));
}

function equalHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" ||
      !/^[a-f0-9]{64}$/.test(a) ||
      !/^[a-f0-9]{64}$/.test(b)) return false;

  let diff = 0;
  for (let i = 0; i < 64; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function createAdminGateway({ verify = verifyAdminAccess } = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;
      const isSession = path === SESSION;

      if (!isSession && !allowedRoute(path, request.method)) {
        return json({ error: "not_found" }, 404);
      }

      if (request.method !== "GET" && (url.search || url.hash)) {
        return json({ error: "invalid_request" }, 400);
      }

      if (isSession && request.method !== "GET") {
        return json({ error: "method_not_allowed" }, 405);
      }

      let access;
      try {
        access = await verify(request, env);
      } catch {
        return json({ error: "access_unavailable" }, 503);
      }

      if (!access) return json({ error: "unauthorized" }, 401);

      let expectedCsrf;
      try {
        expectedCsrf = await csrfToken(access, env, url.origin);
      } catch {
        return json({ error: "gateway_unavailable" }, 503);
      }

      if (isSession) {
        return json({
          authenticated: true,
          csrf_token: expectedCsrf
        });
      }

      if (request.method !== "GET") {
        // Reject cross-origin form or script requests before proxying.
        if (request.headers.get("Origin") !== url.origin) {
          return json({ error: "invalid_origin" }, 403);
        }

        if (!equalHex(
          request.headers.get("X-CSRF-Token"),
          expectedCsrf
        )) {
          return json({ error: "invalid_csrf" }, 403);
        }

        if (!(request.headers.get("Content-Type") || "")
            .toLowerCase().startsWith("application/json")) {
          return json({ error: "content_type_required" }, 415);
        }
      }

      const backend = env.ADS_BACKEND;
      const secret = env.ADS_ADMIN_TOKEN;

      if (!backend || typeof backend.fetch !== "function" ||
          typeof secret !== "string" ||
          !/^[a-fA-F0-9]{64}$/.test(secret)) {
        return json({ error: "gateway_unavailable" }, 503);
      }

      let body;

      if (request.method !== "GET") {
        body = await request.text();
        if (new TextEncoder().encode(body).length > 4096) {
          return json({ error: "body_too_large" }, 413);
        }
      }

      // A Service Binding is required. No browser-supplied
      // Authorization, Cookie or Access JWT is forwarded.
      const headers = new Headers({
        "Authorization": `Bearer ${secret}`,
        "Accept": "application/json"
      });

      if (request.method !== "GET") {
        headers.set("Content-Type", "application/json");
      }

      const downstream = new Request(
        `https://ads-backend.internal${path}`,
        {
          method: request.method,
          headers,
          body: request.method === "GET" ? undefined : body,
          redirect: "manual"
        }
      );

      try {
        const response = await backend.fetch(downstream);

        // Never follow or expose backend redirects.
        if (response.status >= 300 && response.status < 400) {
          return json({ error: "backend_redirect_blocked" }, 502);
        }

        const contentType = response.headers.get("Content-Type") || "";
        if (!contentType.toLowerCase().includes("application/json")) {
          return json({ error: "invalid_backend_response" }, 502);
        }

        const contentLength = response.headers.get("Content-Length");
        if (contentLength && Number(contentLength) > 131072) {
          return json({ error: "backend_response_too_large" }, 502);
        }

        const responseText = await response.text();
        if (new TextEncoder().encode(responseText).length > 131072) {
          return json({ error: "backend_response_too_large" }, 502);
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          return json({ error: "invalid_backend_response" }, 502);
        }

        return json(data, response.status);
      } catch {
        return json({ error: "backend_unavailable" }, 502);
      }
    }
  };
}

export default createAdminGateway();
