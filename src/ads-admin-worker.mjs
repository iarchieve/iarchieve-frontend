import gateway from "./ads-admin-gateway.mjs";
import { verifyAdminAccess } from "./ads-admin-access.mjs";

const protectedPages = new Set([
  "/ads/admin",
  "/ads/admin/",
  "/ads/admin.html"
]);

function securityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'self'; style-src 'self'; " +
    "img-src 'self'; connect-src 'self'; font-src 'self'; " +
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function errorResponse(error, status) {
  return Response.json({ error }, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export function createAdsAdminWorker({
  adminGateway = gateway,
  verify = verifyAdminAccess
} = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/api/ads/admin/session" ||
          path.startsWith("/api/ads/admin/") ||
          path === "/api/ads/audit" ||
          path.startsWith("/api/ads/publisher-credentials")) {
        return securityHeaders(
          await adminGateway.fetch(request, env)
        );
      }

      if (path.startsWith("/api/ads/")) {
        return errorResponse("not_found", 404);
      }

      if (protectedPages.has(path)) {
        if (request.method !== "GET" &&
            request.method !== "HEAD") {
          return errorResponse("method_not_allowed", 405);
        }

        let identity;

        try {
          identity = await verify(request, env);
        } catch {
          return errorResponse("access_unavailable", 503);
        }

        if (!identity) {
          return errorResponse("unauthorized", 401);
        }

        if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
          return errorResponse("assets_unavailable", 503);
        }

        const assetUrl = new URL("/ads/admin.html", url.origin);

        const assetResponse = await env.ASSETS.fetch(
          new Request(assetUrl, { method: request.method })
        );

        return securityHeaders(assetResponse);
      }

      if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
        return errorResponse("assets_unavailable", 503);
      }

      return env.ASSETS.fetch(request);
    }
  };
}

export default createAdsAdminWorker();
