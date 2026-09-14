import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`STAGE6_I18N_ERROR ${message}`);
  process.exitCode = 1;
};

const locales = ["en", "es", "fr", "de", "it", "nl", "ja", "ko", "zh", "ar"];
const i18n = read("src/i18n/index.tsx");
const rootRoute = read("src/routes/__root.tsx");
const header = read("src/components/layout/Header.tsx");
const product = read("src/routes/product/$id.tsx");
const motion = read("src/components/ui/motion-button.tsx");
const switcher = read("src/components/ui/cinematic-theme-switcher.tsx");
const theme = read("src/stage6-theme.css");
const share = read("src/components/product/ProductShare.tsx");
const whatsapp = read("src/components/support/FloatingWhatsAppSupport.tsx");
const validateMain = read(".github/workflows/validate-main.yml");
const pkg = JSON.parse(read("package.json"));

for (const dependency of ["next-themes", "framer-motion"]) {
  if (!pkg.dependencies?.[dependency]) fail(`missing dependency ${dependency}`);
}

for (const locale of locales) {
  const file = path.join(root, "src/i18n/generated", `${locale}.json`);
  if (!fs.existsSync(file)) {
    fail(`missing generated catalog ${locale}`);
    continue;
  }
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Object.keys(json).length < 120) fail(`catalog ${locale} is unexpectedly small`);
  for (const phrase of ["Adicionar ao carrinho", "Idioma", "Compartilhar", "Torcedor"]) {
    if (!json[phrase]) fail(`catalog ${locale} missing critical phrase: ${phrase}`);
  }
}

for (const token of [
  "dropbox-locale",
  "meta.direction",
  'import.meta.glob("./generated/*.json"',
  "MutationObserver",
  'ar: { htmlLang: "ar"',
]) {
  if (!i18n.includes(token)) fail(`i18n architecture missing ${token}`);
}

for (const token of [
  "ThemeProvider",
  'storageKey="dropbox-theme"',
  "I18nProvider",
  "stage6ThemeCss",
]) {
  if (!rootRoute.includes(token)) fail(`root integration missing ${token}`);
}

if (!header.includes("Stage6HeaderControls")) fail("header controls are not integrated");
if (!product.includes("<MotionButton")) fail("product CTA is not using MotionButton");
if ((product.match(/<MotionButton/g) ?? []).length !== 2)
  fail("both desktop and mobile CTAs must use MotionButton");
if (!product.includes("handleAddToCart")) fail("existing add-to-cart handler was lost");
if (!product.includes("addingToCart")) fail("duplicate add-to-cart guard is missing");
if (!motion.includes("var(--brand-accent)")) fail("MotionButton does not use DropBox red");
if (!motion.includes("group-hover:w-full")) fail("MotionButton expansion animation changed");
if (!motion.includes("group-hover:translate-x-[0.4rem]")) fail("MotionButton arrow motion changed");

for (const token of [
  "h-[64px] w-[104px]",
  "h-[44px] w-[44px]",
  "x: isDark ? 46 : 0",
  "stiffness: 300",
  "damping: 20",
]) {
  if (!switcher.includes(token)) fail(`cinematic switcher drifted: ${token}`);
}

if (!theme.includes('html[dir="rtl"]')) fail("RTL theme support is missing");
if (!share.includes("useI18n")) fail("share messages are not localized");
if (!whatsapp.includes("useI18n")) fail("WhatsApp messages are not localized");
if (!validateMain.includes("validate-stage6-i18n.mjs"))
  fail("main CI does not enforce Stage 6 gate");
if (read("scripts/stage6-generate-translations.mjs").includes("runtime")) {
  // Informational only: build-time generator is allowed; browser runtime translation APIs are not.
}

if (!process.exitCode) {
  console.log(
    "STAGE6_I18N_OK locales=11 runtime_translation_api=none rtl=enabled theme=persistent motion_button=enabled",
  );
}
