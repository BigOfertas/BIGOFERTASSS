import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

function walkFiles(relativeDir, predicate) {
  const absoluteDir = path.join(root, relativeDir);
  const files = [];

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(relativePath, predicate));
    else if (predicate(relativePath)) files.push(relativePath);
  }

  return files.sort();
}

const visualRoutes = walkFiles("src/routes", (file) => file.endsWith(".tsx"));
const visualComponents = walkFiles("src/components", (file) => file.endsWith(".tsx"));

const fail = (message) => {
  console.error(`DARK_MODE_COVERAGE_ERROR ${message}`);
  process.exitCode = 1;
};

if (visualRoutes.length < 18) {
  fail(`visual route discovery unexpectedly found only ${visualRoutes.length} routes`);
}

for (const route of visualRoutes) {
  if (!exists(route)) fail(`missing visual route: ${route}`);
}

const theme = read("src/stage6-theme.css");
const routeFixes = read("src/stage6-dark-route-fixes.css");
const legacyGlass = read("src/glass-legacy.css");
const auth = read("src/auth.css");
const brand = read("src/brand.css");
const sportTheme = read("src/sport-theme.css");
const brandWordmark = read("src/components/brand/BrandWordmark.tsx");
const rootRoute = read("src/routes/__root.tsx");
const accountOverview = read("src/components/account/AccountOverview.tsx");
const cart = read("src/routes/cart.tsx");
const checkout = read("src/routes/checkout.tsx");
const institutional = read("src/components/content/InstitutionalPage.tsx");
const combinedDarkStyles = [theme, routeFixes, brand].join("\n");

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

for (const token of [
  'import stage6DarkRouteFixesCss from "../stage6-dark-route-fixes.css?url"',
  '{ rel: "stylesheet", href: stage6DarkRouteFixesCss }',
]) {
  if (!rootRoute.includes(token)) fail(`route-specific dark stylesheet is not loaded last: ${token}`);
}

for (const token of [
  ".dark .account-action-card",
  ".dark .account-profile-card",
  ".dark .category-carousel-arrow",
]) {
  if (!routeFixes.includes(token)) fail(`missing route-specific dark override: ${token}`);
}

for (const token of ["account-action-card", "account-profile-card", "account-command-hero"]) {
  if (!accountOverview.includes(token)) fail(`account overview audit fixture changed: ${token}`);
}

if (!legacyGlass.includes("background:\n    linear-gradient(")) {
  fail("legacy glass no longer exposes the background-image hazard expected by this audit");
}

for (const token of ["bg-gray-50/50", "bg-white", "from-emerald-50", "to-white"]) {
  if (!cart.includes(token)) fail(`cart audit fixture changed; expected token missing: ${token}`);
}

for (const token of ["bg-[#f7f7f7]", "bg-white", "bg-gray-50", "bg-emerald-50"]) {
  if (!checkout.includes(token)) {
    fail(`checkout audit fixture changed; expected token missing: ${token}`);
  }
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
let componentHazards = 0;
for (const sourceFile of visualRoutes) {
  const source = read(sourceFile);
  for (const pattern of hazardPatterns) routeHazards += source.match(pattern)?.length ?? 0;
}
for (const sourceFile of visualComponents) {
  const source = read(sourceFile);
  for (const pattern of hazardPatterns) componentHazards += source.match(pattern)?.length ?? 0;
}

if (routeHazards < 10) {
  fail(`route light-surface audit unexpectedly found only ${routeHazards} hazards`);
}
if (componentHazards < 10) {
  fail(`component light-surface audit unexpectedly found only ${componentHazards} hazards`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const customCssFiles = [
  "src/auth.css",
  "src/glass-legacy.css",
  "src/header.css",
  "src/sport-theme.css",
];
const intentionalDarkContextClasses = new Set([
  "auth-showcase-dot",
  "auth-showcase-progress",
  "auth-showcase-vignette",
  "auth-mobile-showcase-vignette",
]);
const lightBackgroundPattern =
  /background(?:-color)?\s*:\s*[^;}]*(?:#f[4-9a-f][0-9a-f]{4}|#fff(?:fff)?\b|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0\.[5-9][0-9]*|1(?:\.0+)?)\s*\))/i;
const coveredCustomClasses = new Set();
const uncoveredCustomClasses = new Set();

for (const cssFile of customCssFiles) {
  const css = read(cssFile);
  const blockPattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;

  while ((match = blockPattern.exec(css))) {
    const selector = match[1].trim();
    const declarations = match[2];
    if (!lightBackgroundPattern.test(declarations)) continue;

    const classNames = [...selector.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(
      (classMatch) => classMatch[1],
    );

    for (const className of classNames) {
      if (className.startsWith("dark") || intentionalDarkContextClasses.has(className)) continue;
      const darkSelectorPattern = new RegExp(
        `\\.dark[^\\{]*\\.${escapeRegExp(className)}(?:[\\s\\.:#\\[,>+~]|$)`,
        "m",
      );
      if (darkSelectorPattern.test(combinedDarkStyles)) coveredCustomClasses.add(className);
      else uncoveredCustomClasses.add(`${cssFile}:${className}`);
    }
  }
}

if (uncoveredCustomClasses.size > 0) {
  fail(
    `custom light CSS surfaces without dark override: ${[...uncoveredCustomClasses].sort().join(", ")}`,
  );
}

if (!sportTheme.includes(".account-action-card") || !sportTheme.includes(".account-profile-card")) {
  fail("account custom surfaces were removed without updating the dark audit contract");
}

if (!process.exitCode) {
  console.log(
    `DARK_MODE_COVERAGE_OK routes=${visualRoutes.length} components=${visualComponents.length} route_hazards=${routeHazards} component_hazards=${componentHazards} custom_light_classes=${coveredCustomClasses.size} cart=ok checkout=ok auth=ok account=ok admin=ok institutional=ok storefront=ok overlays=ok charts=ok mobile=ok brand=ok`,
  );
}
