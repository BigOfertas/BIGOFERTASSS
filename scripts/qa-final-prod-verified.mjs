import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "https://bigofertas.net";
const SHA = "85b6cf4c4a7776eca3c07d3c0c7efacb35c32f42";
const PRODUCT_URL = `${BASE}/product/chelsea-camisa-i-26-27-nike-p000001`;
const OUT = "qa-final-prod-verified";
fs.mkdirSync(OUT, { recursive: true });

const brandSource = fs.readFileSync("src/config/brand.ts", "utf8");
const waMatch = brandSource.match(/const whatsappUrl = readPublicBrandValue\([\s\S]*?"(https:\/\/wa\.me\/\d+)"\s*,?\n?\);/);
const configuredWaBase = waMatch?.[1] ?? null;

const results = [];
const failures = [];
const observations = [];
const consoleErrors = [];
const sameOriginNetworkErrors = [];

const normalize = (value = "") => value.normalize("NFKC").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  console[ok ? "log" : "error"](`${ok ? "PASS" : "FAIL"} - ${name}${detail ? ` :: ${detail}` : ""}`);
}

function observe(name, detail) {
  observations.push({ name, detail });
  console.log(`OBS - ${name} :: ${detail}`);
}

function textParam(href = "") {
  try { return new URL(href).searchParams.get("text") ?? ""; } catch { return ""; }
}

function whatsappBase(href = "") {
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch { return ""; }
}

function attachDiagnostics(page, scope) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ scope, text: msg.text() });
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.startsWith(BASE)) {
      sameOriginNetworkErrors.push({ scope, type: "failed", url, error: request.failure()?.errorText ?? "" });
    }
  });
  page.on("response", (response) => {
    if (response.url().startsWith(BASE) && response.status() >= 400) {
      sameOriginNetworkErrors.push({ scope, type: `http-${response.status()}`, url: response.url() });
    }
  });
}

async function dismissCookie(page) {
  for (const pattern of [/aceitar/i, /entendi/i, /continuar/i]) {
    const button = page.getByRole("button", { name: pattern }).first();
    if (await button.count()) {
      try { await button.click({ timeout: 1200 }); } catch {}
      break;
    }
  }
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  await dismissCookie(page);
}

async function desktopQa(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const page = await context.newPage();
  attachDiagnostics(page, "desktop");

  const homeResponse = await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await settle(page);
  record("Homepage carrega normalmente", homeResponse?.ok() === true, `HTTP ${homeResponse?.status()}`);
  record("Homepage sem scroll horizontal indevido", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  const homeWa = page.locator("[data-floating-whatsapp]");
  record("WhatsApp aparece na homepage", (await homeWa.count()) === 1);
  if (await homeWa.count()) {
    const href = await homeWa.getAttribute("href");
    const message = textParam(href ?? "");
    record("Mensagem da homepage está correta", message === "Olá! 👋 Preciso de ajuda com a minha compra na DropBox.", message);
    if (configuredWaBase) record("Homepage usa o WhatsApp oficial configurado", whatsappBase(href ?? "") === configuredWaBase);
    await homeWa.hover();
    record("Tooltip Fale conosco aparece no desktop", await page.getByText("Fale conosco", { exact: true }).isVisible().catch(() => false));
    const box = await homeWa.boundingBox();
    record("WhatsApp está no canto inferior direito no desktop", Boolean(box && box.x > 1200 && box.y > 750), box ? JSON.stringify(box) : "sem geometria");
  }
  await page.screenshot({ path: `${OUT}/desktop-home.png`, fullPage: true });

  const productResponse = await page.goto(PRODUCT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await settle(page);
  record("Página de produto carrega normalmente", productResponse?.ok() === true, `HTTP ${productResponse?.status()}`);
  const productName = (await page.locator("#product-title").innerText()).trim();
  record("Produto real carregou", productName.length > 2, productName);

  const productWa = page.locator("[data-floating-whatsapp]");
  record("WhatsApp aparece no produto", (await productWa.count()) === 1);
  if (await productWa.count()) {
    const href = await productWa.getAttribute("href");
    const message = textParam(href ?? "");
    record("WhatsApp do produto inclui o nome", normalize(message).includes(normalize(productName)), message);
    record("WhatsApp do produto inclui a URL do produto", message.includes(PRODUCT_URL));
    if (configuredWaBase) record("Produto usa o WhatsApp oficial configurado", whatsappBase(href ?? "") === configuredWaBase);
  }

  const canonicals = page.locator('link[rel="canonical"]');
  const canonicalCount = await canonicals.count();
  const canonicalUrl = canonicalCount === 1 ? await canonicals.first().getAttribute("href") : null;
  record("Existe exatamente uma tag canonical", canonicalCount === 1, `count=${canonicalCount}`);
  record("Canonical aponta para a URL correta do produto", canonicalUrl === PRODUCT_URL, canonicalUrl ?? "ausente");

  const ogTitle = await page.locator('meta[property="og:title"]').first().getAttribute("content");
  const ogDescription = await page.locator('meta[property="og:description"]').first().getAttribute("content");
  const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  const ogUrl = await page.locator('meta[property="og:url"]').first().getAttribute("content");
  record("og:title corresponde ao produto", normalize(ogTitle ?? "").includes(normalize(productName)), ogTitle ?? "ausente");
  record("og:description está preenchido", Boolean(ogDescription && ogDescription.trim().length > 10));
  record("og:image está preenchido com URL absoluta", Boolean(ogImage && /^https?:\/\//.test(ogImage)), ogImage ?? "ausente");
  record("og:url corresponde ao produto", ogUrl === PRODUCT_URL, ogUrl ?? "ausente");

  const shareTrigger = page.locator("[data-product-share-trigger]");
  record("Botão Compartilhar aparece", await shareTrigger.isVisible().catch(() => false));
  await shareTrigger.click();
  record("Menu de compartilhamento abre", await page.locator("[data-product-share-menu]").isVisible().catch(() => false));

  const shareWaHref = await page.locator("[data-share-whatsapp]").getAttribute("href");
  const shareWaText = textParam(shareWaHref ?? "");
  record("WhatsApp de compartilhamento inclui nome", normalize(shareWaText).includes(normalize(productName)), shareWaText);
  record("WhatsApp de compartilhamento inclui URL correta", shareWaText.includes(PRODUCT_URL));
  record("Compartilhamento não contém localhost ou preview", !/(localhost|127\.0\.0\.1|vercel\.app|pages\.dev)/i.test(shareWaText));

  const telegramHref = await page.locator("[data-share-telegram]").getAttribute("href");
  record("Telegram usa endpoint oficial", Boolean(telegramHref?.startsWith("https://t.me/share/url")));
  if (telegramHref) {
    const telegram = new URL(telegramHref);
    record("Telegram recebe URL correta do produto", telegram.searchParams.get("url") === PRODUCT_URL, telegram.searchParams.get("url") ?? "ausente");
    record("Telegram recebe nome do produto", normalize(telegram.searchParams.get("text") ?? "").includes(normalize(productName)));
  }

  const browserSupportsNativeShare = await page.evaluate(() => typeof navigator.share === "function");
  const nativeCount = await page.locator("[data-share-native]").count();
  record("Web Share aparece somente quando suportado", browserSupportsNativeShare ? nativeCount === 1 : nativeCount === 0, `supported=${browserSupportsNativeShare}; count=${nativeCount}`);

  await page.locator("[data-share-copy]").click();
  const toastVisible = await page.getByText("Link copiado!", { exact: true }).waitFor({ state: "visible", timeout: 3000 }).then(() => true).catch(() => false);
  record("Toast Link copiado! funciona", toastVisible);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  record("Copiar link grava a URL correta", clipboard === PRODUCT_URL, clipboard);

  const brokenImages = await page.locator("img").evaluateAll((images) => images.filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src).slice(0, 10));
  record("Produto não possui imagem quebrada visível", brokenImages.length === 0, brokenImages.join(", "));
  record("Produto sem scroll horizontal indevido no desktop", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${OUT}/desktop-product.png`, fullPage: true });

  await context.close();
  return { productName, canonicalUrl, canonicalCount };
}

async function mobileQa(browser, productName) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  attachDiagnostics(page, "mobile");
  const response = await page.goto(PRODUCT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await settle(page);
  record("Produto mobile carrega", response?.ok() === true, `HTTP ${response?.status()}`);

  const wa = page.locator("[data-floating-whatsapp]");
  const purchaseBar = page.locator("div.fixed.inset-x-0.bottom-0.z-40");
  const waBox = await wa.boundingBox();
  const barBox = await purchaseBar.boundingBox();
  record("WhatsApp aparece no mobile", Boolean(waBox));
  record("Barra móvel de compra aparece", Boolean(barBox));
  record("WhatsApp não cobre a barra de compra", Boolean(waBox && barBox && waBox.y + waBox.height <= barBox.y), waBox && barBox ? `waBottom=${waBox.y + waBox.height}; barTop=${barBox.y}` : "geometria indisponível");
  record("WhatsApp mantém afastamento inferior/safe-area", Boolean(waBox && waBox.y + waBox.height < 790), waBox ? JSON.stringify(waBox) : "sem geometria");

  const trigger = page.locator("[data-product-share-trigger]");
  record("Compartilhar é utilizável no mobile", await trigger.isVisible().catch(() => false));
  await trigger.click();
  const menu = page.locator("[data-product-share-menu]");
  record("Menu de compartilhamento abre no mobile", await menu.isVisible().catch(() => false));
  const menuBox = await menu.boundingBox();
  record("Menu de compartilhamento cabe na viewport 390px", Boolean(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= 390.5), menuBox ? JSON.stringify(menuBox) : "sem geometria");
  record("Mobile sem scroll horizontal indevido", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await page.evaluate(() => `${document.documentElement.scrollWidth}/${window.innerWidth}`));

  const canonicalCount = await page.locator('link[rel="canonical"]').count();
  const canonicalUrl = canonicalCount === 1 ? await page.locator('link[rel="canonical"]').first().getAttribute("href") : null;
  record("Canonical é único também no mobile", canonicalCount === 1, `count=${canonicalCount}`);
  record("Canonical mobile aponta para o produto", canonicalUrl === PRODUCT_URL, canonicalUrl ?? "ausente");

  const productWaMessage = textParam((await wa.getAttribute("href")) ?? "");
  record("Mensagem de produto no mobile mantém nome e URL", normalize(productWaMessage).includes(normalize(productName)) && productWaMessage.includes(PRODUCT_URL));
  await page.screenshot({ path: `${OUT}/mobile-product.png`, fullPage: true });
  await context.close();
}

async function nativeShareQa(browser, productName) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (payload) => { window.__qaSharedPayload = payload; },
    });
  });
  const page = await context.newPage();
  attachDiagnostics(page, "native-share");
  await page.goto(PRODUCT_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await settle(page);
  await page.locator("[data-product-share-trigger]").click();
  const nativeButton = page.locator("[data-share-native]");
  record("Web Share aparece quando navigator.share é suportado", await nativeButton.isVisible().catch(() => false));
  await nativeButton.click();
  const payload = await page.evaluate(() => window.__qaSharedPayload ?? null);
  record("Web Share recebe título do produto", normalize(payload?.title ?? "") === normalize(productName), payload?.title ?? "ausente");
  record("Web Share recebe URL correta", payload?.url === PRODUCT_URL, payload?.url ?? "ausente");
  record("Web Share recebe nome no texto", normalize(payload?.text ?? "").includes(normalize(productName)), payload?.text ?? "ausente");
  await context.close();
}

const browser = await chromium.launch({ headless: true });
let desktop;
try {
  desktop = await desktopQa(browser);
  await mobileQa(browser, desktop.productName);
  await nativeShareQa(browser, desktop.productName);
} finally {
  await browser.close();
}

const ignoredConsolePatterns = [
  /favicon/i,
  /ResizeObserver/i,
  /third-party cookie/i,
];
const catalogCors = consoleErrors.filter((entry) => /catalog_products_page_v3/i.test(entry.text) && /CORS|Failed to load resource/i.test(entry.text));
if (catalogCors.length) observe("CORS preexistente do catálogo Supabase", `${catalogCors.length} mensagem(ns); não pertence a WhatsApp/compartilhamento/canonical e não impediu home/produto de carregar.`);
const relevantConsole = consoleErrors.filter((entry) => !ignoredConsolePatterns.some((pattern) => pattern.test(entry.text)) && !(/catalog_products_page_v3/i.test(entry.text) && /CORS|Failed to load resource/i.test(entry.text)));
record("Sem erros de console relacionados às funcionalidades alteradas", relevantConsole.length === 0, relevantConsole.map((entry) => entry.text).join(" | "));
record("Sem 4xx/5xx/falhas de rede same-origin relevantes", sameOriginNetworkErrors.length === 0, sameOriginNetworkErrors.map((entry) => `${entry.type}:${entry.url}`).join(" | "));

const summary = {
  sha: SHA,
  production: BASE,
  productUrl: PRODUCT_URL,
  productName: desktop?.productName ?? null,
  canonicalCount: desktop?.canonicalCount ?? null,
  canonicalUrl: desktop?.canonicalUrl ?? null,
  failures,
  observations,
  relevantConsole,
  sameOriginNetworkErrors,
  results,
};
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
console.log(`\nQA_SUMMARY ${JSON.stringify({ passed: results.filter((result) => result.ok).length, total: results.length, failed: failures.length, canonicalCount: summary.canonicalCount, canonicalUrl: summary.canonicalUrl })}`);
if (failures.length) {
  console.error(`\n${failures.length} falha(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nQA_FINAL_PRODUCTION_OK");
