import { readFile } from "node:fs/promises";

const files = Object.fromEntries(
  await Promise.all(
    [
      "vite.hostinger.config.ts",
      "public/.htaccess",
      "src/lib/backend-routing.ts",
      "src/lib/shipping.ts",
      "src/lib/checkout.ts",
      "src/lib/auth.tsx",
      "src/lib/account-security.ts",
      "supabase/config.toml",
    ].map(async (path) => [path, await readFile(path, "utf8")]),
  ),
);

const checks = [];
function check(label, condition) {
  checks.push({ label, condition: Boolean(condition) });
}

const hostinger = files["vite.hostinger.config.ts"];
const htaccess = files["public/.htaccess"];
const routing = files["src/lib/backend-routing.ts"];
const shipping = files["src/lib/shipping.ts"];
const checkout = files["src/lib/checkout.ts"];
const auth = files["src/lib/auth.tsx"];
const security = files["src/lib/account-security.ts"];
const supabaseConfig = files["supabase/config.toml"];

check("build Hostinger usa plugin oficial do TanStack", hostinger.includes("@tanstack/react-start/plugin/vite"));
check("build Hostinger nao usa preset Lovable/Cloudflare", !hostinger.includes("@lovable.dev/vite-tanstack-config"));
check("SPA mode esta ativo", /spa\s*:\s*\{[\s\S]*enabled\s*:\s*true/.test(hostinger));
check("shell Hostinger sai como index.html", hostinger.includes('outputPath: "/index.html"'));
check("Hostinger reescreve rotas para index.html", /RewriteRule\s+\^\s+index\.html\s+\[L\]/.test(htaccess));
check("arquivos reais escapam do rewrite", htaccess.includes("%{REQUEST_FILENAME} -f") && htaccess.includes("%{REQUEST_FILENAME} -d"));

check("fallback legado e restrito a localhost/Worker", routing.includes('hostname.endsWith(".workers.dev")') && routing.includes('hostname === "localhost"'));
check("frete principal usa Supabase Edge Function", shipping.includes("/functions/v1/shipping-quote"));
check("frete condiciona fallback legado", shipping.includes("legacyWorkerFallbackAvailable"));
check("checkout principal usa Supabase Edge Function", checkout.includes("/functions/v1/checkout-start"));
check("checkout condiciona fallback legado", checkout.includes("legacyWorkerFallbackAvailable"));
check("login/2FA principal usa Supabase Edge Function", auth.includes("/functions/v1/auth-email-2fa"));
check("login condiciona fallback legado", auth.includes("legacyWorkerFallbackAvailable"));
check("ativacao 2FA usa Supabase Edge Function", security.includes("/functions/v1/auth-email-2fa"));
check("ativacao 2FA condiciona fallback legado", security.includes("legacyWorkerFallbackAvailable"));

check("shipping-quote continua publica", /\[functions\.shipping-quote\][\s\S]*?verify_jwt\s*=\s*false/.test(supabaseConfig));
check("checkout-start continua com auth interna", /\[functions\.checkout-start\][\s\S]*?verify_jwt\s*=\s*false/.test(supabaseConfig));
check("webhook InfinitePay continua publico", /\[functions\.infinitepay-webhook\][\s\S]*?verify_jwt\s*=\s*false/.test(supabaseConfig));
check("auth-email-2fa usa validacao interna", /\[functions\.auth-email-2fa\][\s\S]*?verify_jwt\s*=\s*false/.test(supabaseConfig));

const forbiddenPublicSecrets = [
  "VITE_SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPERFRETE_TOKEN",
  "VITE_RESEND_API_KEY",
  "VITE_EMAIL_2FA_SECRET",
  "VITE_R2_SECRET_ACCESS_KEY",
];
const clientBundleSources = [shipping, checkout, auth, security, routing].join("\n");
for (const variable of forbiddenPublicSecrets) {
  check(`segredo ${variable} nao existe no frontend`, !clientBundleSources.includes(variable));
}

let failed = 0;
for (const item of checks) {
  if (item.condition) {
    console.log(`PASS - ${item.label}`);
  } else {
    console.error(`FAIL - ${item.label}`);
    failed += 1;
  }
}

console.log(`\n${checks.length - failed}/${checks.length} validacoes aprovadas.`);
if (failed > 0) process.exit(1);
