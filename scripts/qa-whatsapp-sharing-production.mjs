import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "https://bigofertas.net";
const EXPECTED_SHA = "8980f733d9dae1d30e34f20be097f59d792b5e6a";
const OUT = "qa-whatsapp-sharing-production";
fs.mkdirSync(OUT, { recursive: true });

const report = {
  expectedSha: EXPECTED_SHA,
  baseUrl: BASE,
  startedAt: new Date().toISOString(),
  homepage: {},
  catalog: {},
  products: [],
  nativeShare: {},
  admin: {},
  runtime: [],
  failures: [],
};

function fail(message, details = null) {
  report.failures.push({ message, ...(details === null ? {} : { details }) });
}

function assert(condition, message, details = null) {
  if (!condition) fail(message, details);
}

function normalizeUrl(value) {
  try {
    const url = new URL(value, BASE);
    url.hash = "";
    return url.toString();
  } catch {
    return String(value ?? "");
  }
}

function withoutQuery(value) {
  const url = new URL(value, BASE);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function decodeTextParam(value) {
  try {
    return new URL(value).searchParams.get("text") ?? "";
  } catch {
    return "";
  }
}

function whatsappBase(value) {
  try {
    const url = new URL(value);
    return url.origin + url.pathname.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function watchRuntime(page, label) {
  page.on("pageerror", (error) => {
    report.runtime.push({ label, kind: "pageerror", message: error.message });
    fail(`Erro de runtime em ${label}`, error.message);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    report.runtime.push({ label, kind: "console.error", message: text });
    if (/\b(?:Uncaught|TypeError|ReferenceError|SyntaxError|RangeError)\b/i.test(text)) {
      fail(`Erro de console em ${label}`, text);
    }
  });
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function visibleImageHealth(page) {
  return page.locator("img:visible").evaluateAll((images) =>
    images.slice(0, 12).map((image) => ({
      src: image.currentSrc || image.src,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    })),
  );
}

async function discoverProducts(page) {
  const response = await page.goto(`${BASE}/products?qa=share-${EXPECTED_SHA.slice(0, 10)}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await settle(page);
  const links = page.locator('a[href^="/product/"]');
  await links.first().waitFor({ state: "attached", timeout: 15000 });
  const hrefs = await links.evaluateAll((nodes) =>
    [...new Set(nodes.map((node) => node.getAttribute("href")).filter(Boolean))].slice(0, 4),
  );
  const images = await visibleImageHealth(page);
  const horizontalScroll = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
  );
  report.catalog = {
    status: response?.status() ?? null,
    hrefs,
    horizontalScroll,
    imageSample: images,
    floatingWhatsAppCount: await page.locator("[data-floating-whatsapp]").count(),
  };
  assert(Boolean(response && response.status() < 400), "Catálogo não respondeu com HTTP válido", report.catalog);
  assert(hrefs.length >= 2, "Catálogo não expôs dois produtos para QA", hrefs);
  assert(horizontalScroll <= 1, "Catálogo possui scroll horizontal no mobile/desktop QA", horizontalScroll);
  assert(
    images.some((image) => image.complete && image.naturalWidth > 0),
    "Nenhuma imagem visível do catálogo carregou",
    images,
  );
  assert(report.catalog.floatingWhatsAppCount === 0, "WhatsApp apareceu em /products sem necessidade");
  return hrefs;
}

async function testHomepage(browser) {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: "pt-BR",
    });
    const page = await context.newPage();
    watchRuntime(page, `homepage-${viewport.name}`);
    const response = await page.goto(`${BASE}/?qa=whatsapp-${EXPECTED_SHA.slice(0, 10)}-${viewport.name}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await settle(page);
    const floating = page.locator("[data-floating-whatsapp]");
    await floating.waitFor({ state: "visible", timeout: 15000 });
    const count = await floating.count();
    const href = await floating.getAttribute("href");
    const aria = await floating.getAttribute("aria-label");
    const rect = await floating.boundingBox();
    const tooltip = await page.getByText("Fale conosco", { exact: true }).count();
    const allWhatsapp = await page.locator('a[href^="https://wa.me/"]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        floating: node.hasAttribute("data-floating-whatsapp"),
        href: node.getAttribute("href"),
      })),
    );
    const officialNonFloating = allWhatsapp.find((item) => !item.floating && item.href)?.href ?? null;
    const message = href ? decodeTextParam(href) : "";
    const focused = await floating.evaluate((node) => {
      node.focus();
      return document.activeElement === node;
    });
    const horizontalScroll = await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    );
    const result = {
      status: response?.status() ?? null,
      count,
      href,
      aria,
      rect,
      tooltip,
      message,
      focused,
      officialNonFloating,
      horizontalScroll,
    };
    report.homepage[viewport.name] = result;
    assert(Boolean(response && response.status() < 400), `Homepage ${viewport.name} com HTTP inválido`, result);
    assert(count === 1, `Homepage ${viewport.name} deve ter exatamente um WhatsApp`, result);
    assert(Boolean(href?.startsWith("https://wa.me/")), `WhatsApp homepage ${viewport.name} não usa wa.me`, href);
    assert(
      message === "Olá! 👋 Preciso de ajuda com a minha compra na DropBox.",
      `Mensagem da homepage ${viewport.name} diverge`,
      message,
    );
    if (officialNonFloating && href) {
      assert(
        whatsappBase(officialNonFloating) === whatsappBase(href),
        `WhatsApp homepage ${viewport.name} não usa o mesmo contato oficial do restante do site`,
        { officialNonFloating, href },
      );
    }
    assert(Boolean(aria?.toLowerCase().includes("whatsapp")), `ARIA do WhatsApp ${viewport.name} ausente`, aria);
    assert(focused, `WhatsApp ${viewport.name} não recebe foco programático/teclado`);
    assert(tooltip === 1, `Tooltip Fale conosco ausente/duplicado em ${viewport.name}`, tooltip);
    assert(Boolean(rect && rect.width >= 52 && rect.height >= 52), `Área de toque pequena em ${viewport.name}`, rect);
    if (rect) {
      assert(rect.right <= viewport.width + 1 && rect.left >= -1, `WhatsApp fora do viewport em ${viewport.name}`, rect);
      assert(rect.bottom <= viewport.height + 1 && rect.top >= -1, `WhatsApp fora do viewport vertical em ${viewport.name}`, rect);
      assert(rect.left > viewport.width - 100, `WhatsApp não está no canto direito em ${viewport.name}`, rect);
    }
    assert(horizontalScroll <= 1, `Homepage ${viewport.name} ganhou scroll horizontal`, horizontalScroll);
    await page.screenshot({ path: `${OUT}/homepage-${viewport.name}.png`, fullPage: false });
    await context.close();
  }
}

async function testProduct(browser, href, index, viewport) {
  const context = await browser.newContext({
    viewport,
    locale: "pt-BR",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  watchRuntime(page, `product-${index}-${viewport.width}`);
  const productUrl = new URL(href, BASE).toString();
  const response = await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle(page);
  const title = (await page.locator("h1").first().innerText()).trim();
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  const ogUrl = await page.locator('meta[property="og:url"]').getAttribute("content");
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
  const ogDescription = await page.locator('meta[property="og:description"]').getAttribute("content");
  const expectedCanonical = canonical ? normalizeUrl(canonical) : "";

  const floating = page.locator("[data-floating-whatsapp]");
  await floating.waitFor({ state: "visible", timeout: 15000 });
  const floatingHref = (await floating.getAttribute("href")) ?? "";
  const floatingMessage = decodeTextParam(floatingHref);
  const floatingRect = await floating.boundingBox();
  const floatingAria = await floating.getAttribute("aria-label");
  const productContext = await floating.getAttribute("data-product-context");

  const shareTrigger = page.locator("[data-product-share-trigger]");
  await shareTrigger.waitFor({ state: "visible", timeout: 10000 });
  const shareAria = await shareTrigger.getAttribute("aria-label");
  await shareTrigger.click();
  const menu = page.locator("[data-product-share-menu]");
  await menu.waitFor({ state: "visible", timeout: 5000 });
  const shareWhatsappHref = (await page.locator("[data-share-whatsapp]").getAttribute("href")) ?? "";
  const shareWhatsappMessage = decodeTextParam(shareWhatsappHref);
  const telegramHref = (await page.locator("[data-share-telegram]").getAttribute("href")) ?? "";
  const nativeSupported = await page.evaluate(() => typeof navigator.share === "function");
  const nativeButtonCount = await page.locator("[data-share-native]").count();

  await page.locator("[data-share-copy]").click();
  await page.getByText("Link copiado!", { exact: true }).waitFor({ state: "visible", timeout: 5000 });
  const clipboard = await page.evaluate(() => navigator.clipboard?.readText().catch(() => null));

  const images = await visibleImageHealth(page);
  const horizontalScroll = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
  );

  let ctaRect = null;
  if (viewport.width < 768) {
    const mobileBar = page.locator("div.fixed.inset-x-0.bottom-0.z-40").first();
    if ((await mobileBar.count()) > 0 && (await mobileBar.isVisible())) ctaRect = await mobileBar.boundingBox();
  }

  const result = {
    href,
    productUrl,
    status: response?.status() ?? null,
    title,
    canonical,
    ogUrl,
    ogTitle,
    ogImage,
    ogDescription,
    floatingHref,
    floatingMessage,
    floatingRect,
    floatingAria,
    productContext,
    shareAria,
    shareWhatsappHref,
    shareWhatsappMessage,
    telegramHref,
    nativeSupported,
    nativeButtonCount,
    clipboard,
    ctaRect,
    horizontalScroll,
    imageSample: images,
    viewport,
  };
  report.products.push(result);

  assert(Boolean(response && response.status() < 400), `Produto ${index} com HTTP inválido`, result);
  assert(Boolean(title), `Produto ${index} sem H1`);
  assert(Boolean(expectedCanonical.startsWith(`${BASE}/product/`)), `Produto ${index} sem canonical de produção`, canonical);
  assert(normalizeUrl(ogUrl) === expectedCanonical, `Produto ${index}: og:url difere do canonical`, { ogUrl, canonical });
  assert(Boolean(ogTitle && ogTitle.includes(title)), `Produto ${index}: og:title não contém nome`, { ogTitle, title });
  assert(Boolean(ogImage?.startsWith("http")), `Produto ${index}: og:image ausente/inválida`, ogImage);
  assert(Boolean(ogDescription), `Produto ${index}: og:description ausente`);
  assert(productContext === "true", `Produto ${index}: WhatsApp sem contexto de produto`, productContext);
  assert(
    floatingMessage === `Olá! 👋 Tenho uma dúvida sobre este produto: ${title} — ${expectedCanonical}`,
    `Produto ${index}: mensagem do suporte diverge`,
    { floatingMessage, title, expectedCanonical },
  );
  assert(Boolean(floatingAria?.includes(title)), `Produto ${index}: ARIA do WhatsApp não contém produto`, floatingAria);
  assert(Boolean(shareAria?.includes(title)), `Produto ${index}: ARIA de compartilhar não contém produto`, shareAria);
  assert(
    shareWhatsappMessage === `Olha o que eu achei na DropBox! 👀⚽\n${title}\nDá uma olhada: ${expectedCanonical}`,
    `Produto ${index}: mensagem de compartilhamento WhatsApp diverge`,
    shareWhatsappMessage,
  );
  assert(telegramHref.startsWith("https://t.me/share/url?"), `Produto ${index}: Telegram inválido`, telegramHref);
  assert(telegramHref.includes(encodeURIComponent(expectedCanonical)), `Produto ${index}: Telegram sem canonical`, telegramHref);
  assert(nativeSupported ? nativeButtonCount === 1 : nativeButtonCount === 0, `Produto ${index}: fallback Web Share incorreto`, {
    nativeSupported,
    nativeButtonCount,
  });
  if (clipboard !== null) assert(normalizeUrl(clipboard) === expectedCanonical, `Produto ${index}: clipboard diverge`, { clipboard, expectedCanonical });
  assert(!shareWhatsappHref.includes("localhost") && !telegramHref.includes("localhost"), `Produto ${index}: share contém localhost`);
  assert(!floatingHref.includes("localhost"), `Produto ${index}: suporte contém localhost`);
  assert(
    images.some((image) => image.complete && image.naturalWidth > 0),
    `Produto ${index}: nenhuma imagem visível carregou`,
    images,
  );
  assert(horizontalScroll <= 1, `Produto ${index}: scroll horizontal`, horizontalScroll);
  if (viewport.width < 768 && floatingRect && ctaRect) {
    const overlaps = !(
      floatingRect.right <= ctaRect.left ||
      floatingRect.left >= ctaRect.right ||
      floatingRect.bottom <= ctaRect.top ||
      floatingRect.top >= ctaRect.bottom
    );
    assert(!overlaps, `Produto ${index}: WhatsApp cobre a barra/CTA mobile`, { floatingRect, ctaRect });
    assert(floatingRect.bottom <= ctaRect.top + 2, `Produto ${index}: WhatsApp não ficou acima da barra mobile`, {
      floatingRect,
      ctaRect,
    });
  }

  await page.screenshot({ path: `${OUT}/product-${index}-${viewport.width}.png`, fullPage: false });
  await context.close();
  return result;
}

async function testNativeShare(browser, href) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (payload) => {
        window.__dropboxLastShare = payload;
      },
    });
  });
  watchRuntime(page, "native-share-stub");
  const productUrl = new URL(href, BASE).toString();
  await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle(page);
  const title = (await page.locator("h1").first().innerText()).trim();
  const canonical = (await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "";
  const trigger = page.locator("[data-product-share-trigger]");
  await trigger.click();
  const native = page.locator("[data-share-native]");
  await native.waitFor({ state: "visible", timeout: 5000 });
  await native.click();
  const payload = await page.evaluate(() => window.__dropboxLastShare ?? null);
  report.nativeShare = { title, canonical, payload };
  assert(Boolean(payload), "Web Share suportado não chamou navigator.share");
  assert(payload?.title === title, "Web Share: title diverge", payload);
  assert(payload?.url === canonical, "Web Share: URL diverge", payload);
  assert(Boolean(payload?.text?.includes(title)), "Web Share: texto não contém nome do produto", payload);
  assert(Boolean(payload?.text?.includes("DropBox")), "Web Share: texto não contém DropBox", payload);
  await context.close();
}

async function testAdmin(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  const page = await context.newPage();
  watchRuntime(page, "admin-guest");
  const response = await page.goto(`${BASE}/admin?qa=whatsapp-admin-${EXPECTED_SHA.slice(0, 8)}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await settle(page);
  const count = await page.locator("[data-floating-whatsapp]").count();
  report.admin = { status: response?.status() ?? null, finalUrl: page.url(), floatingWhatsAppCount: count };
  assert(Boolean(response && response.status() < 400), "Admin/login respondeu com erro", report.admin);
  assert(count === 0, "WhatsApp apareceu no painel/admin", report.admin);
  await page.screenshot({ path: `${OUT}/admin-guest.png`, fullPage: false });
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await testHomepage(browser);

  const catalogContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR" });
  const catalogPage = await catalogContext.newPage();
  watchRuntime(catalogPage, "catalog-discovery");
  const productHrefs = await discoverProducts(catalogPage);
  await catalogPage.screenshot({ path: `${OUT}/catalog.png`, fullPage: false });
  await catalogContext.close();

  if (productHrefs.length >= 1) {
    await testProduct(browser, productHrefs[0], 1, { width: 1440, height: 1000 });
    await testProduct(browser, productHrefs[0], 1, { width: 390, height: 844 });
    await testNativeShare(browser, productHrefs[0]);
  }
  if (productHrefs.length >= 2) {
    const first = await testProduct(browser, productHrefs[1], 2, { width: 390, height: 844 });
    const firstCanonical = report.products.find((item) => item.href === productHrefs[0])?.canonical;
    assert(
      Boolean(first.canonical && firstCanonical && first.canonical !== firstCanonical),
      "Dois produtos distintos geraram a mesma URL canônica",
      { firstCanonical, secondCanonical: first.canonical },
    );
  }

  await testAdmin(browser);
} finally {
  await browser.close();
}

report.finishedAt = new Date().toISOString();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log("DROPBOX_WHATSAPP_SHARING_PRODUCTION_QA");
console.log(
  JSON.stringify(
    {
      expectedSha: report.expectedSha,
      homepage: report.homepage,
      catalog: report.catalog,
      products: report.products.map((item) => ({
        href: item.href,
        title: item.title,
        canonical: item.canonical,
        status: item.status,
        viewport: item.viewport,
        floatingMessage: item.floatingMessage,
        shareWhatsappMessage: item.shareWhatsappMessage,
        clipboard: item.clipboard,
        ctaRect: item.ctaRect,
        floatingRect: item.floatingRect,
      })),
      nativeShare: report.nativeShare,
      admin: report.admin,
      runtime: report.runtime,
      failures: report.failures,
    },
    null,
    2,
  ),
);
if (report.failures.length > 0) process.exit(1);
console.log("Production QA passed.");
