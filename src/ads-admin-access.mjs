const encoder = new TextEncoder();

function decodeBase64Url(value) {
  if (typeof value !== "string" ||
      !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("invalid_token");
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(
    atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
    character => character.charCodeAt(0)
  );

  return bytes;
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder("utf-8", {
    fatal: true
  }).decode(decodeBase64Url(value)));
}

function readConfig(env) {
  const team = env.ADS_ACCESS_TEAM_DOMAIN;
  const audience = env.ADS_ACCESS_AUD;
  const allowed = env.ADS_ADMIN_ALLOWED_EMAILS;

  if (typeof team !== "string" ||
      !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) ||
      typeof audience !== "string" || !audience ||
      typeof allowed !== "string" || !allowed.trim()) {
    throw new Error("access_not_configured");
  }

  const emails = allowed.split(",").map(value =>
    value.trim().toLowerCase()
  ).filter(Boolean);

  if (!emails.length || emails.some(email =>
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    throw new Error("access_not_configured");
  }

  return { team, audience, emails };
}

export async function verifyAdminAccess(request, env, options = {}) {
  const config = readConfig(env);

  const token = request.headers.get("Cf-Access-Jwt-Assertion");

  if (!token || token.length > 16384) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let header;
  let payload;
  let signature;

  try {
    header = decodeJson(parts[0]);
    payload = decodeJson(parts[1]);
    signature = decodeBase64Url(parts[2]);
  } catch {
    return null;
  }

  if (header?.alg !== "RS256" ||
      typeof header.kid !== "string" ||
      !header.kid ||
      payload === null || typeof payload !== "object") {
    return null;
  }

  const issuer = `https://${config.team}`;
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud)
    ? payload.aud : [payload.aud];

  if (payload.iss !== issuer ||
      !audiences.includes(config.audience) ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= now ||
      !Number.isSafeInteger(payload.iat) ||
      payload.iat > now + 60 ||
      (payload.nbf !== undefined &&
        (!Number.isSafeInteger(payload.nbf) || payload.nbf > now)) ||
      typeof payload.email !== "string" ||
      !config.emails.includes(payload.email.toLowerCase()) ||
      typeof payload.sub !== "string" ||
      !payload.sub) {
    return null;
  }

  let keys = [];

  try {
    const fetcher = options.fetcher ?? fetch;
    const response = await fetcher(
      `${issuer}/cdn-cgi/access/certs`,
      { redirect: "error" }
    );

    if (response.ok) {
      const data = await response.json();
      keys = Array.isArray(data.keys) ? data.keys : [];
    }
  } catch {
    // Use configured public keys only when remote lookup fails.
  }

  if (!keys.length && typeof env.ADS_ACCESS_JWKS === "string") {
    try {
      const configured = JSON.parse(env.ADS_ACCESS_JWKS);
      keys = Array.isArray(configured.keys) ? configured.keys : [];
    } catch {
      return null;
    }
  }

  // Never accept unverified JWTs.
  if (!keys.length) return null;

  const jwk = keys.find(key =>
    key.kid === header.kid &&
    key.kty === "RSA" &&
    (key.alg === undefined || key.alg === "RS256") &&
    (key.use === undefined || key.use === "sig")
  );

  if (!jwk) return null;

  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature,
      encoder.encode(`${parts[0]}.${parts[1]}`)
    );

    if (!valid) return null;
  } catch {
    return null;
  }

  return {
    subject: payload.sub,
    email: payload.email.toLowerCase(),
    expiresAt: payload.exp,
    accessToken: token
  };
}
