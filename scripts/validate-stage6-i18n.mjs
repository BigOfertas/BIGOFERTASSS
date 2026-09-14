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
const criticalUi = read("src/i18n/ui-copy.ts");
const criticalFallbacks = read("src/i18n/critical-copy.ts");
const slideUpReveal = read("src/components/ui/slide-up-reveal.tsx");
const rootRoute = read("src/routes/__root.tsx");
const header = read("src/components/layout/Header.tsx");
const categoryNav = read("src/components/layout/CategoryNav.tsx");
const bestSellers = read("src/components/home/BestSellers.tsx");
const productsRoute = read("src/routes/products.tsx");
const filters = read("src/components/ProductFilters.tsx");
const productCard = read("src/components/product/ProductCard.tsx");
const productCarousel = read("src/components/product/ProductCarousel.tsx");
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
  "criticalCopy(locale, compact)",
  "isUsableGeneratedTranslation",
]) {
  if (!i18n.includes(token)) fail(`i18n architecture missing ${token}`);
}

for (const phrase of [
  "Monte seu pedido",
  "Encontre seu time",
  "Compre por liga",
  "Perguntas frequentes",
  "Antes de comprar",
  "Tamanho",
  "Ver guia de tamanhos",
  "Personalizar",
  "Patches",
  "Frase personalizada",
  "Nome e número",
  "Calcule a entrega",
  "Adicionar ao carrinho",
  "Atendimento",
  "Envio e produção",
  "Trocas e devoluções",
  "Termos de compra",
  "Privacidade",
  "Finalizar compra",
  "Resumo do pedido",
  "Entrar",
  "Criar conta",
  "Pedidos",
  "Endereços",
  "Administração",
  "Financeiro",
]) {
  if (!criticalFallbacks.includes(`\"${phrase}\"`))
    fail(`critical deterministic copy missing: ${phrase}`);
}

for (const locale of locales) {
  if (!criticalFallbacks.includes(`\"${locale}\"`))
    fail(`critical deterministic copy missing locale: ${locale}`);
}

for (const token of ["useI18n", "translateText(sourceText)", "const text = useMemo"]) {
  if (!slideUpReveal.includes(token))
    fail(`animated copy must be translated before splitting: ${token}`);
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
if (!header.includes("useI18n")) fail("header is not locale-aware");
if (!header.includes("uiCopy(locale, category.name)"))
  fail("mobile header categories are not translated before render");
if (!header.includes("accountTopLabel = uiCopy"))
  fail("desktop account header labels are not localized");

if (!categoryNav.includes("useI18n")) fail("category navigation is not locale-aware");
if (!categoryNav.includes("uiCopy(locale, category.name)"))
  fail("category labels are not translated before render");

for (const token of ['uiCopy(locale, "Novidades da loja")', 'uiCopy(locale, "Lançamentos")']) {
  if (!bestSellers.includes(token))
    fail(`animated homepage heading must be translated before splitting: ${token}`);
}

for (const token of [
  'uiCopy(locale, "Produtos")',
  'uiCopy(locale, "Ordenar")',
  'uiCopy(locale, "Destaques")',
]) {
  if (!productsRoute.includes(token))
    fail(`catalog page missing deterministic translation: ${token}`);
}

for (const token of [
  'uiCopy(locale, "Filtros")',
  'uiCopy(locale, "Limpar tudo")',
  "uiCopy(locale, title)",
]) {
  if (!filters.includes(token)) fail(`catalog filters missing deterministic translation: ${token}`);
}

if (!productCard.includes("translateProductDisplayName"))
  fail("product card generic names are not localized");
if (!productCard.includes("data-product-card-body"))
  fail("product cards are missing the dark-mode body hook");
if (!productCarousel.includes("data-product-carousel-dot"))
  fail("product carousel dots are missing a dark-mode hook");

for (const token of [
  "en: {",
  "zh: {",
  "ar: {",
  'Lançamentos: "NEW ARRIVALS"',
  'Lançamentos: "新品"',
  'Produtos: "PRODUCTS"',
]) {
  if (!criticalUi.includes(token)) fail(`critical storefront copy missing: ${token}`);
}

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

for (const token of [
  'html[dir="rtl"]',
  ".dark [data-product-card]",
  "background: var(--stage6-dark-surface-2) !important",
  ".dark [data-product-showcase]",
  ".dark .glass-header .glass-input",
  ".dark [data-product-carousel-dot]",
]) {
  if (!theme.includes(token)) fail(`dark-mode regression protection missing: ${token}`);
}

if (!share.includes("useI18n")) fail("share messages are not localized");
if (!whatsapp.includes("useI18n")) fail("WhatsApp messages are not localized");
if (!validateMain.includes("validate-stage6-i18n.mjs"))
  fail("main CI does not enforce Stage 6 gate");

for (const forbiddenRuntimeApi of [
  "translate.googleapis.com",
  "translation.googleapis.com",
  "api.openai.com",
]) {
  if (i18n.includes(forbiddenRuntimeApi)) {
    fail(`runtime i18n must not call external translation API: ${forbiddenRuntimeApi}`);
  }
}

if (!process.exitCode) {
  console.log(
    "STAGE6_I18N_OK locales=11 runtime_translation_api=none rtl=enabled theme=persistent motion_button=enabled critical_storefront_copy=explicit pre_split_translation=enabled broken_catalog_guard=enabled",
  );
}
