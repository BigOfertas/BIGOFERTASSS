type RateLimitResult = {
  allowed: boolean;
  remaining: number | null;
  retryAfterSeconds: number;
  degraded?: boolean;
};

type RateLimitRule = {
  scope: string;
  limit: number;
  windowSeconds: number;
  identity?: string | null;
};

type TurnstileResult = {
  configured: boolean;
  success: boolean;
  reason?: string;
};

function getEnv(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

export function clientIp(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp.slice(0, 80);

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 80);

  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp ? realIp.slice(0, 80) : null;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeRateLimit(
  request: Request,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    console.error("[security] rate limit unavailable: missing server configuration");
    return { allowed: true, remaining: null, retryAfterSeconds: 0, degraded: true };
  }

  const rawIdentity = rule.identity?.trim() || clientIp(request) || "unknown-client";
  const keyHash = await sha256Hex(`${rule.scope}:${rawIdentity}`);

  try {
    const upstream = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/consume_edge_rate_limit`,
      {
        method: "POST",
        headers: {
          apikey: serviceRole,
          authorization: `Bearer ${serviceRole}`,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_scope: rule.scope,
          p_key_hash: keyHash,
          p_limit: rule.limit,
          p_window_seconds: rule.windowSeconds,
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (!upstream.ok) {
      console.error(`[security] rate limit RPC failed with HTTP ${upstream.status}`);
      return { allowed: true, remaining: null, retryAfterSeconds: 0, degraded: true };
    }

    const payload = await upstream.json();
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row || typeof row.allowed !== "boolean") {
      console.error("[security] rate limit RPC returned an invalid response");
      return { allowed: true, remaining: null, retryAfterSeconds: 0, degraded: true };
    }

    return {
      allowed: row.allowed,
      remaining: Number.isFinite(Number(row.remaining)) ? Number(row.remaining) : null,
      retryAfterSeconds: Math.max(0, Number(row.retry_after_seconds) || 0),
    };
  } catch (error) {
    console.error("[security] rate limit check failed", error instanceof Error ? error.message : "unknown");
    // Fail open on infrastructure errors so a security dependency cannot take the store offline.
    return { allowed: true, remaining: null, retryAfterSeconds: 0, degraded: true };
  }
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    ...(result.remaining === null ? {} : { "x-ratelimit-remaining": String(result.remaining) }),
    ...(result.retryAfterSeconds > 0 ? { "retry-after": String(result.retryAfterSeconds) } : {}),
    "cache-control": "no-store, max-age=0",
  };
}

export function turnstileConfigured() {
  return Boolean(getEnv("TURNSTILE_SECRET_KEY"));
}

export async function verifyTurnstile(
  request: Request,
  token: unknown,
  expectedAction?: string,
): Promise<TurnstileResult> {
  const secret = getEnv("TURNSTILE_SECRET_KEY");
  if (!secret) return { configured: false, success: true };

  if (typeof token !== "string" || !token.trim() || token.length > 2048) {
    return { configured: true, success: false, reason: "missing-or-invalid-token" };
  }

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token.trim());
  const ip = clientIp(request);
  if (ip) form.set("remoteip", ip);
  form.set("idempotency_key", crypto.randomUUID());

  try {
    const upstream = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(6_000),
    });
    if (!upstream.ok) {
      return { configured: true, success: false, reason: `siteverify-http-${upstream.status}` };
    }

    const result = (await upstream.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
      "error-codes"?: string[];
    };
    if (result.success !== true) {
      return {
        configured: true,
        success: false,
        reason: Array.isArray(result["error-codes"])
          ? result["error-codes"].slice(0, 3).join(",")
          : "siteverify-rejected",
      };
    }

    const allowedHostnames = getEnv("TURNSTILE_ALLOWED_HOSTNAMES")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (
      allowedHostnames.length > 0 &&
      (!result.hostname || !allowedHostnames.includes(result.hostname.toLowerCase()))
    ) {
      return { configured: true, success: false, reason: "hostname-mismatch" };
    }

    if (expectedAction && result.action && result.action !== expectedAction) {
      return { configured: true, success: false, reason: "action-mismatch" };
    }

    return { configured: true, success: true };
  } catch (error) {
    console.error("[security] Turnstile validation failed", error instanceof Error ? error.message : "unknown");
    return { configured: true, success: false, reason: "siteverify-unavailable" };
  }
}
