import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "https://bigofertas.net";
const OUT = "qa-final-prod";
fs.mkdirSync(OUT, { recursive: true });

const sourceBrand = fs.readFileSync("src/config/brand.ts", "utf8");
const waMatch = sourceBrand.match(/const whatsappUrl = readPublicBrandValue\([\s\S]*?"(https:\/\/wa\.me\/\d+)"\s*,?\n?\);/);
const configuredWaBase = waMatch?.[1] ?? null;

const failures = [];
const results = [];
const consoleErrors = [];
const networkErrors = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS - ${name}${detail ? ` :: ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  console.error(`FAIL - ${name}${detail ? ` :: ${detail}` : ""}`);
}
function check(name, condition, detail = "") {
  condition ? pass(name, detail) : fail(name, detail);
}

function textParam(href) {
  try {
    return new URL(href).searchParams.get("text") ?? "";
  } catch {
    return "";
  }
}
function waBase(href) {
  try {
    const u = new URL(href);
    return `${u.origin}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function attachDiagnostics(page, scope) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ scope, text: msg.text() });
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (url.startsWith(BASE)) networkErrors.push({ scope, type: "failed", url, error: req.failure()?.errorText ?? "" });
  });
  page.on("response", (res) => {
    if (res.url().startsWith(BASE) && res.status() >= 400) {
      networkErrors.push({ scope, type: `http-${res.status()}`, url: res.url() });
    }
  });
}

async function dismissCookie(page) {
  for (const pattern of [/aceitar/i, /entendi/i, /continuar/i]) {
    const button = page.getByRole("button", { name: pattern }).first();
    if (await button.count()) {
      try { await button.click({ timeout: 1000 }); } catch {}
      break;
    }
  }
}

async function getProductUrl(page) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const hrefs = await page.locator('a[href^="/product/"]').evaluateAll((els) => els.map((el) => el.getAttribute("href")).filter(Boolean));
  if (!hrefs.length) throw new Error("Nenhum link de produto encontrado na homepage.");
  return new URL(hrefs[0], BASE).href;
}

async function desktopQa(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const page = await context.newPage();
  attachDiagnostics(page, "desktop");

  const homeResponse = await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissCookie(page);
  check("Homepage responde com sucesso", homeResponse?.ok() === true, `HTTP ${homeResponse?.status()}`);
  check("Homepage sem overflow horizontal", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  const homeWa = page.locator("[data-floating-whatsapp]");
  check("WhatsApp aparece na homepage", (await homeWa.count()) === 1);
  if (await homeWa.count()) {
    const href = await homeWa.getAttribute("href");
    const expectedHome = "Olá! 👋 Preciso de ajuda com a minha compra na DropBox.";
    check("Mensagem do WhatsApp da homepage está correta", textParam(href ?? "") === expectedHome, textParam(href ?? ""));
    if (configuredWaBase) check("Homepage usa WhatsApp oficial configurado", waBase(href ?? "") === configuredWaBase);
    await homeWa.hover();
    const tooltip = page.getByText("Fale conosco", { exact: true });
    check("Tooltip do WhatsApp aparece no desktop", await tooltip.isVisible().catch(() => false));
    const box = await homeWa.boundingBox();
    check("WhatsApp está no canto inferior direito no desktop", Boolean(box && box.x > 1200 && box.y > 750), box ? JSON.stringify(box) : "sem box");
  }
  await page.screenshot({ path: `${OUT}/desktop-home.png`, fullPage: true });

  const productUrl = await getProductUrl(page);
  const productResponse = await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissCookie(page);
  check("Produto responde com sucesso", productResponse?.ok() === true, `HTTP ${productResponse?.status()}`);
  const productName = (await page.locator("#product-title").innerText()).trim();
  check("Produto real carregou com nome", productName.length > 2, productName);

  const productWa = page.locator("[data-floating-whatsapp]");
  check("WhatsApp aparece no produto", (await productWa.count()) === 1);
  if (await productWa.count()) {
    const href = await productWa.getAttribute("href");
    const msg = textParam(href ?? "");
    check("WhatsApp do produto inclui nome", msg.includes(productName));
    check("WhatsApp do produto inclui URL canônica", msg.includes(productUrl));
    if (configuredWaBase) check("Produto usa WhatsApp oficial configurado", waBase(href ?? "") === configuredWaBase);
  }

  const canonical = page.locator('link[rel="canonical"]');
  const canonicalCount = await canonical.count();
  check("Existe exatamente uma tag canonical", canonicalCount === 1, `count=${canonicalCount}`);
  const canonicalUrl = canonicalCount ? await canonical.first().getAttribute("href") : null;
  check("Canonical aponta para o produto em produção", canonicalUrl === productUrl, canonicalUrl ?? "ausente");

  const ogTitle = await page.locator('meta[property="og:title"]').first().getAttribute("content");
  const ogDescription = await page.locator('meta[property="og:description"]').first().getAttribute("content");
  const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  const ogUrl = await page.locator('meta[property="og:url"]').first().getAttribute("content");
  check("og:title está preenchido e corresponde ao produto", Boolean(ogTitle?.includes(productName)), ogTitle ?? "ausente");
  check("og:description está preenchido", Boolean(ogDescription && ogDescription.length > 10));
  check("og:image aponta para URL absoluta", Boolean(ogImage && /^https?:\/\//.test(ogImage)), ogImage ?? "ausente");
  check("og:url corresponde ao canonical", ogUrl === canonicalUrl, ogUrl ?? "ausente");

  const shareTrigger = page.locator("[data-product-share-trigger]");
  check("Botão Compartilhar aparece", await shareTrigger.isVisible().catch(() => false));
  await shareTrigger.click();
  const menu = page.locator("[data-product-share-menu]");
  check("Menu de compartilhamento abre", await menu.isVisible().catch(() => false));

  const shareWa = page.locator("[data-share-whatsapp]");
  const shareWaHref = await shareWa.getAttribute("href");
  const shareWaMsg = textParam(shareWaHref ?? "");
  check("Compartilhamento WhatsApp inclui nome", shareWaMsg.includes(productName));
  check("Compartilhamento WhatsApp inclui canonical", shareWaMsg.includes(canonicalUrl ?? "__missing__"));
  check("Compartilhamento não contém localhost/preview", !/(localhost|127\.0\.0\.1|vercel\.app|pages\.dev)/i.test(shareWaMsg));

  const telegramHref = await page.locator("[data-share-telegram]").getAttribute("href");
  check("Telegram usa endpoint oficial de share", Boolean(telegramHref?.startsWith("https://t.me/share/url")));
  if (telegramHref) {
    const t = new URL(telegramHref);
    check("Telegram recebe canonical", t.searchParams.get("url") === canonicalUrl);
    check("Telegram recebe nome do produto", (t.searchParams.get("text") ?? "").includes(productName));
  }

  const nativeButtonCount = await page.locator("[data-share-native]").count();
  const nativeSupported = await page.evaluate(() => typeof navigator.share === "function");
  check("Web Share aparece somente quando suportado", nativeSupported ? nativeButtonCount === 1 : nativeButtonCount === 0, `supported=${nativeSupported}; count=${nativeButtonCount}`);

  await page.locator("[data-share-copy]").click();
  check("Toast Link copiado aparece", await page.getByText("Link copiado!", { exact: true }).isVisible().catch(() => false));
  const clipboard = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  check("Copiar link grava canonical", clipboard === canonicalUrl, clipboard);

  const brokenImages = await page.locator("img").evaluateAll((imgs) => imgs.filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.currentSrc || img.src).slice(0, 10));
  check("Produto sem imagens quebradas visíveis", brokenImages.length === 0, brokenImages.join(", "));
  check("Produto sem overflow horizontal no desktop", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${OUT}/desktop-product.png`, fullPage: true });

  await context.close();
  return { productUrl, productName, canonicalUrl };
}

async function mobileQa(browser, productUrl) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  attachDiagnostics(page, "mobile");
  const response = await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissCookie(page);
  check("Produto mobile responde com sucesso", response?.ok() === true, `HTTP ${response?.status()}`);

  const wa = page.locator("[data-floating-whatsapp]");
  const bar = page.locator("div.fixed.inset-x-0.bottom-0.z-40");
  const waBox = await wa.boundingBox();
  const barBox = await bar.boundingBox();
  check("WhatsApp mobile aparece", Boolean(waBox));
  check("Barra móvel de compra aparece", Boolean(barBox));
  check("WhatsApp não cobre barra de compra", Boolean(waBox && barBox && waBox.y + waBox.height <= barBox.y), waBox && barBox ? `waBottom=${waBox.y + waBox.height}; barTop=${barBox.y}` : "geometria indisponível");
  check("WhatsApp respeita margem inferior/safe-area", Boolean(waBox && waBox.y + waBox.height < 790), waBox ? JSON.stringify(waBox) : "sem box");

  const trigger = page.locator("[data-product-share-trigger]");
  check("Compartilhar é utilizável no mobile", await trigger.isVisible().catch(() => false));
  await trigger.click();
  const menu = page.locator("[data-product-share-menu]");
  check("Popover de compartilhar abre no mobile", await menu.isVisible().catch(() => false));
  const menuBox = await menu.boundingBox();
  check("Popover fica dentro da viewport mobile", Boolean(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= 391), menuBox ? JSON.stringify(menuBox) : "sem box");
  check("Sem scroll horizontal indevido no mobile", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await page.evaluate(() => `${document.documentElement.scrollWidth}/${window.innerWidth}`));

  const canonicalCount = await page.locator('link[rel="canonical"]').count();
  check("Canonical também é único no mobile", canonicalCount === 1, `count=${canonicalCount}`);
  await page.screenshot({ path: `${OUT}/mobile-product.png`, fullPage: true });
  await context.close();
}

async function nativeShareQa(browser, productUrl, expectedName, expectedCanonical) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (payload) => { window.__qaSharedPayload = payload; },
    });
  });
  const page = await context.newPage();
  attachDiagnostics(page, "native-share");
  await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissCookie(page);
  await page.locator("[data-product-share-trigger]").click();
  const native = page.locator("[data-share-native]");
  check("Web Share aparece quando navigator.share é suportado", await native.isVisible().catch(() => false));
  await native.click();
  const payload = await page.evaluate(() => window.__qaSharedPayload ?? null);
  check("Web Share recebe título do produto", payload?.title === expectedName, payload?.title ?? "ausente");
  check("Web Share recebe canonical", payload?.url === expectedCanonical, payload?.url ?? "ausente");
  check("Web Share recebe nome no texto", typeof payload?.text === "string" && payload.text.includes(expectedName), payload?.text ?? "ausente");
  await context.close();
}

const browser = await chromium.launch({ headless: true });
let summary = {};
try {
  const desktop = await desktopQa(browser);
  await mobileQa(browser, desktop.productUrl);
  await nativeShareQa(browser, desktop.productUrl, desktop.productName, desktop.canonicalUrl);

  const relevantConsole = consoleErrors.filter((item) => !/favicon|ResizeObserver|third-party cookie/i.test(item.text));
  check("Sem erros relevantes de console", relevantConsole.length === 0, relevantConsole.map((x) => x.text).join(" | "));
  check("Sem falhas 4xx/5xx/rede relevantes do próprio site", networkErrors.length === 0, networkErrors.map((x) => `${x.type}:${x.url}`).join(" | "));

  summary = {
    sha: "25057a6d75522f8c25bece1646bcf7fa284d1a09",
    base: BASE,
    productUrl: desktop.productUrl,
    productName: desktop.productName,
    canonicalUrl: desktop.canonicalUrl,
    canonicalCount: results.find((r) => r.name === "Existe exatamente uma tag canonical")?.detail ?? "",
    configuredWhatsAppMatched: results.filter((r) => r.name.includes("WhatsApp oficial configurado")).every((r) => r.ok),
    consoleErrors: relevantConsole,
    networkErrors,
    results,
  };
} finally {
  await browser.close();
}

fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
console.log(`\nQA_SUMMARY ${JSON.stringify({ passed: results.filter((r) => r.ok).length, total: results.length, failed: failures.length, productUrl: summary.productUrl, canonicalUrl: summary.canonicalUrl })}`);
if (failures.length) {
  console.error(`\n${failures.length} falha(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nQA_FINAL_PRODUCTION_OK");
