export const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
} as const;

function configuredOrigins() {
  return (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function corsHeaders(request: Request) {
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigins = configuredOrigins();

  let allowedOrigin = "*";

  if (allowedOrigins.length > 0) {
    allowedOrigin =
      requestOrigin && allowedOrigins.includes(requestOrigin)
        ? requestOrigin
        : (allowedOrigins[0] ?? "null");
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(request),
    },
  });
}

export function errorResponse(
  request: Request,
  status: number,
  message: string,
  code: string,
) {
  return jsonResponse(request, { error: message, code }, status);
}
