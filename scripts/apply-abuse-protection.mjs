import fs from "node:fs";

function patchFile(path, replacements) {
  let content = fs.readFileSync(path, "utf8");
  for (const [before, after, label] of replacements) {
    const occurrences = content.split(before).length - 1;
    if (occurrences !== 1) {
      throw new Error(`${path}: expected exactly one match for ${label}, found ${occurrences}`);
    }
    content = content.replace(before, after);
  }
  fs.writeFileSync(path, content);
}

patchFile("supabase/functions/checkout-start/index.ts", [
  [
    'import { corsHeaders } from "../_shared/http.ts";\n',
    'import { corsHeaders } from "../_shared/http.ts";\nimport { consumeRateLimit, rateLimitHeaders } from "../_shared/security.ts";\n',
    "checkout security import",
  ],
  [
    '  const endpoint = `${environment("SUPABASE_URL").replace(/\\/$/, "")}/functions/v1/shipping-quote`;\n  const upstream = await fetch(endpoint, {\n    method: "POST",\n    headers: {\n      accept: "application/json",\n      "content-type": "application/json",\n    },',
    '  const endpoint = `${environment("SUPABASE_URL").replace(/\\/$/, "")}/functions/v1/shipping-quote`;\n  const serviceRoleKey = environment("SUPABASE_SERVICE_ROLE_KEY");\n  const upstream = await fetch(endpoint, {\n    method: "POST",\n    headers: {\n      apikey: serviceRoleKey,\n      authorization: `Bearer ${serviceRoleKey}`,\n      accept: "application/json",\n      "content-type": "application/json",\n    },',
    "trusted shipping authorization",
  ],
  [
    '    const user = await authenticateCustomer(request);\n\n    let rawBody: unknown;',
    '    const user = await authenticateCustomer(request);\n    const checkoutLimit = await consumeRateLimit(request, {\n      scope: "checkout-start:user",\n      identity: `user:${user.id}`,\n      limit: 8,\n      windowSeconds: 60,\n    });\n    if (!checkoutLimit.allowed) {\n      return new Response(\n        JSON.stringify({\n          error: "Muitas tentativas de iniciar pagamento. Aguarde um instante e tente novamente.",\n          code: "CHECKOUT_RATE_LIMITED",\n        }),\n        {\n          status: 429,\n          headers: {\n            ...corsHeaders(request),\n            ...rateLimitHeaders(checkoutLimit),\n            "content-type": "application/json; charset=utf-8",\n            "x-content-type-options": "nosniff",\n          },\n        },\n      );\n    }\n\n    let rawBody: unknown;',
    "checkout user rate limit",
  ],
]);

patchFile("supabase/functions/shipping-quote/index.ts", [
  [
    'import { corsHeaders } from "../_shared/http.ts";\n',
    'import { corsHeaders } from "../_shared/http.ts";\nimport { consumeRateLimit, rateLimitHeaders } from "../_shared/security.ts";\n',
    "shipping security import",
  ],
  [
    '  const contentLength = Number(request.headers.get("content-length") ?? 0);\n  if (Number.isFinite(contentLength) && contentLength > 24_000) {\n    return response(request, { error: "Requisição de frete muito grande." }, 413);\n  }\n\n  try {',
    '  const contentLength = Number(request.headers.get("content-length") ?? 0);\n  if (Number.isFinite(contentLength) && contentLength > 24_000) {\n    return response(request, { error: "Requisição de frete muito grande." }, 413);\n  }\n\n  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();\n  const isTrustedInternalRequest =\n    Boolean(serviceRoleKey) && request.headers.get("authorization") === `Bearer ${serviceRoleKey}`;\n\n  if (!isTrustedInternalRequest) {\n    const shippingLimit = await consumeRateLimit(request, {\n      scope: "shipping-quote:ip",\n      limit: 30,\n      windowSeconds: 60,\n    });\n    if (!shippingLimit.allowed) {\n      return new Response(\n        JSON.stringify({\n          error: "Muitas cotações em pouco tempo. Aguarde um instante e tente novamente.",\n          code: "SHIPPING_RATE_LIMITED",\n        }),\n        {\n          status: 429,\n          headers: {\n            ...corsHeaders(request),\n            ...rateLimitHeaders(shippingLimit),\n            "content-type": "application/json; charset=utf-8",\n            "x-content-type-options": "nosniff",\n          },\n        },\n      );\n    }\n  }\n\n  try {',
    "shipping public rate limit",
  ],
]);

patchFile("supabase/functions/auth-email-2fa/index.ts", [
  [
    'import { corsHeaders } from "../_shared/http.ts";\n',
    'import { corsHeaders } from "../_shared/http.ts";\nimport { consumeRateLimit, verifyTurnstile } from "../_shared/security.ts";\n',
    "auth security import",
  ],
  [
    '    let result: unknown;\n    switch (action as Action) {',
    '    const authLimit = await consumeRateLimit(request, {\n      scope: "auth-email-2fa:ip",\n      limit: 30,\n      windowSeconds: 60,\n    });\n    if (!authLimit.allowed) {\n      throw new EmailTwoFactorError(\n        "Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.",\n        429,\n        "EMAIL_2FA_RATE_LIMITED",\n      );\n    }\n\n    if (action === "password-login") {\n      const loginLimit = await consumeRateLimit(request, {\n        scope: "password-login:ip",\n        limit: 10,\n        windowSeconds: 60,\n      });\n      if (!loginLimit.allowed) {\n        throw new EmailTwoFactorError(\n          "Muitas tentativas de acesso. Aguarde um instante e tente novamente.",\n          429,\n          "EMAIL_2FA_LOGIN_RATE_LIMITED",\n        );\n      }\n\n      const turnstile = await verifyTurnstile(request, body.turnstileToken, "login");\n      if (!turnstile.success) {\n        throw new EmailTwoFactorError(\n          "Não foi possível confirmar a verificação de segurança. Atualize a página e tente novamente.",\n          403,\n          "EMAIL_2FA_TURNSTILE_REJECTED",\n        );\n      }\n    }\n\n    let result: unknown;\n    switch (action as Action) {',
    "auth limits and turnstile gate",
  ],
]);

console.log("Abuse-protection patches applied successfully.");
