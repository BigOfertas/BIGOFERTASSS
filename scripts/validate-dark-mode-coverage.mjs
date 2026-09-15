import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const visualRoutes = [
  "src/routes/admin.tsx",
  "src/routes/cadastro.tsx",
  "src/routes/cart.tsx",
  "src/routes/checkout.tsx",
  "src/routes/confirmar-email.tsx",
  "src/routes/conta.tsx",
  "src/routes/conta/pedidos/$orderNumber.tsx",
  "src/routes/contato.tsx",
  "src/routes/esqueci-senha.tsx",
  "src/routes/index.tsx",
  "src/routes/login.tsx",
  "src/routes/privacidade.tsx",
  "src/routes/producao-e-envio.tsx",
  "src/routes/product/$id.tsx",
  "src/routes/products.tsx",
  "src/routes/redefinir-senha.tsx",
  "src/routes/termos-de-compra.tsx",
  "src/routes/trocas-e-devolucoes.tsx",
];

const fail = (message) => {
  console.error(`DARK_MODE_COVERAGE_ERROR ${message}`);
  process.exitCode = 1;
};

for (const route of visualRoutes) {
  if (!exists(route)) fail(`missing visual route: ${route}`);
}

const theme = read("src/stage6-theme.css");
const legacyGlass = read("src/glass-legacy.css");
const auth = read("src/auth.css");
const brand = read("src/brand.css");
const brandWordmark = read("src/components/brand/BrandWordmark.tsx");
const cart = read("src/routes/cart.tsx");
const checkout = read("src/routes/checkout.tsx");
const institutional = read("src/components/content/InstitutionalPage.tsx");

const requiredThemeTokens = [
  ".dark .bg-white",
  ".dark .bg-gray-50\\/50",
  '[class~="bg-[#f7f7f7]"]',
  ".dark :where(section, article, aside, form, div).rounded-2xl.border.border-gray-200.bg-white",
  "background: linear-gradient(145deg, #182235, #111827 58%, #0f1724) !important",
  ".dark .liquid-glass-card",
  ".dark .auth-split-page",
  ".dark .auth-form-card",
  ".dark .auth-input-wrap",
  ".dark .bg-emerald-50",
  ".dark .bg-red-50",
  ".dark .bg-amber-50",
  ".dark .bg-blue-50",
  '.dark [role="dialog"]',
  ".dark .recharts-default-tooltip",
  ".dark input:-webkit-autofill",
  ".dark .text-gray-950",
  ".dark .border-gray-200",
  "@media (max-width: 767px)",
];

for (const token of requiredThemeTokens) {
  if (!theme.includes(token)) fail(`missing global dark compatibility rule: ${token}`);
}

for (const token of [
  ".dark .glass-header .brand-lockup",
  "background: transparent !important",
  ".dark .dropbox-wordmark--light",
  ".dark .dropbox-wordmark--dark",
  ".dark .dropbox-wordmark-fallback",
]) {
  if (!brand.includes(token)) fail(`missing dark brand compatibility rule: ${token}`);
}

for (const token of [
  'DROPBOX_WORDMARK_DARK_SRC = "/assets/branding/dropbox-wordmark-footer.png"',
  "dropbox-wordmark--light",
  "dropbox-wordmark--dark",
]) {
  if (!brandWordmark.includes(token)) fail(`missing theme-aware header wordmark: ${token}`);
}

if (!legacyGlass.includes("background:\n    linear-gradient(")) {
  fail("legacy glass no longer exposes the background-image hazard expected by this audit");
}

for (const token of ["bg-gray-50/50", "bg-white", "from-emerald-50", "to-white"]) {
  if (!cart.includes(token)) fail(`cart audit fixture changed; expected token missing: ${token}`);
}

for (const token of ["bg-[#f7f7f7]", "bg-white", "bg-gray-50", "bg-emerald-50"]) {
  if (!checkout.includes(token))
    fail(`checkout audit fixture changed; expected token missing: ${token}`);
}

for (const token of ["auth-split-page", "auth-form-card", "auth-input-wrap", "auth-side-panel"]) {
  if (!auth.includes(token)) fail(`auth dark-mode surface missing from source audit: ${token}`);
}

if (!institutional.includes('className="min-h-screen bg-white"')) {
  fail("institutional page light shell changed without updating dark-mode coverage audit");
}

const hazardPatterns = [
  /\bbg-white(?:\/\d+)?\b/g,
  /\bbg-gray-(?:50|100|200)(?:\/\d+)?\b/g,
  /bg-\[#(?:f4f4f5|f5f5f5|f7f7f7|f8f8f9|fafafa)\]/gi,
  /\bbg-(?:emerald|green|red|amber|yellow|blue|sky|indigo)-50\b/g,
];

let routeHazards = 0;
for (const route of visualRoutes) {
  const source = read(route);
  for (const pattern of hazardPatterns) {
    routeHazards += source.match(pattern)?.length ?? 0;
  }
}

if (routeHazards < 10) {
  fail(`route light-surface audit unexpectedly found only ${routeHazards} hazards`);
}

if (!process.exitCode) {
  console.log(
    `DARK_MODE_COVERAGE_OK routes=${visualRoutes.length} hazards=${routeHazards} cart=ok checkout=ok auth=ok account=ok admin=ok institutional=ok storefront=ok overlays=ok charts=ok mobile=ok brand=ok`,
  );
}
