import { corsHeaders } from "../_shared/http.ts";

function value(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function allowedOrigins() {
  return value("APP_ALLOWED_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function response(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

async function isAuthenticated(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const supabaseUrl = value("SUPABASE_URL");
  const publishableKey = value("SUPABASE_PUBLISHABLE_KEY") || value("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !publishableKey) return false;

  try {
    const upstream = await fetch(new URL("/auth/v1/user", supabaseUrl), {
      headers: {
        apikey: publishableKey,
        authorization,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    return upstream.ok;
  } catch {
    return false;
  }
}

async function processQueuedEmails() {
  const supabaseUrl = value("SUPABASE_URL").replace(/\/$/, "");
  const serviceRole = value("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return;

  try {
    const upstream = await fetch(`${supabaseUrl}/functions/v1/notifications-process`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${serviceRole}`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!upstream.ok) {
      console.error(`[notifications-kick] ${JSON.stringify({ status: upstream.status })}`);
    }
  } catch (error) {
    console.error(
      `[notifications-kick] ${JSON.stringify({ error: error instanceof Error ? error.name : "unknown" })}`,
    );
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return response(request, { accepted: false }, 405);
  }

  const origin = request.headers.get("origin")?.trim();
  const allowed = allowedOrigins();
  if (origin && allowed.length > 0 && !allowed.includes(origin)) {
    return response(request, { accepted: false }, 403);
  }

  if (!(await isAuthenticated(request))) {
    return response(request, { accepted: false }, 401);
  }

  const task = processQueuedEmails();
  const edgeRuntime = globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
  };

  if (edgeRuntime.EdgeRuntime?.waitUntil) {
    edgeRuntime.EdgeRuntime.waitUntil(task);
  } else {
    await task;
  }

  return response(request, { accepted: true }, 202);
});
