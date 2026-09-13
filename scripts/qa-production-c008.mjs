import fs from "node:fs";
import { chromium } from "playwright";

const baseUrl = "https://bigofertas.net";
const expectedSha = "c0087811538a4e954183c0e1c2e80d34afa4f9c7";
const titles = [
  "LANÇAMENTOS",
  "MONTE SEU PEDIDO",
  "ENCONTRE SEU TIME",
  "COMPRE POR LIGA",
  "PERGUNTAS FREQUENTES",
];
const viewports = [
  { name: "desktop-1440", width: 1440, height: 1100 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
];

fs.mkdirSync("qa-artifacts", { recursive: true });
const report = {
  expectedSha,
  startedAt: new Date().toISOString(),
  baseUrl,
  viewports: {},
  reducedMotion: {},
  routes: {},
  runtime: [],
  failures: [],
};

function fail(message, details = undefined) {
  report.failures.push(details ? { message, details } : { message });
}

function safeSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function trackRuntime(page, label) {
  page.on("pageerror", (error) => {
    const item = { label, kind: "pageerror", message: error.message };
    report.runtime.push(item);
    fail(`Runtime error em ${label}: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    report.runtime.push({ label, kind: "console.error", message: text });
    if (/\b(TypeError|ReferenceError|SyntaxError|Uncaught)\b/i.test(text)) {
      fail(`Console runtime error em ${label}: ${text}`);
    }
  });
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(350);
}

async function findTitleRoot(page, title) {
  const roots = page.locator("[data-slide-up-reveal]");
  const count = await roots.count();
  const indexes = [];
  for (let i = 0; i < count; i += 1) {
    const srText = await roots.nth(i).locator(".sr-only").first().textContent().catch(() => null);
    if (srText?.replace(/\s+/g, " ").trim() === title) indexes.push(i);
  }
  return { roots, indexes };
}

async function titleMetrics(root, title) {
  return root.evaluate((node, expectedTitle) => {
    const visibleCharWrappers = Array.from(node.querySelectorAll("[data-slide-character]"));
    const animatedChars = visibleCharWrappers
      .map((wrapper) => wrapper.firstElementChild)
      .filter((item) => item instanceof HTMLElement);
    const wordWrappers = Array.from(node.querySelectorAll("[data-slide-word]"));
    const expectedNonSpaces = Array.from(expectedTitle.replace(/ /g, "")).length;
    const expectedSpaces = (expectedTitle.match(/ /g) || []).length;
    const visualSpaces = wordWrappers.reduce((count, word) => {
      const last = word.lastElementChild;
      if (!last || last.matches("[data-slide-character]")) return count;
      return count + (last.textContent?.includes("\u00a0") ? 1 : 0);
    }, 0);

    const rootRect = node.getBoundingClientRect();
    const computedRoot = getComputedStyle(node);
    const html = document.documentElement;
    const body = document.body;

    const clipping = [];
    const charMetrics = animatedChars.map((char, index) => {
      const rect = char.getBoundingClientRect();
      const style = getComputedStyle(char);
      let ancestor = char.parentElement;
      const clippedBy = [];
      while (ancestor && ancestor !== body && ancestor !== html) {
        const aStyle = getComputedStyle(ancestor);
        const overflowX = aStyle.overflowX;
        const overflowY = aStyle.overflowY;
        if (["hidden", "clip"].includes(overflowX) || ["hidden", "clip"].includes(overflowY)) {
          const aRect = ancestor.getBoundingClientRect();
          const horizontalCut =
            ["hidden", "clip"].includes(overflowX) &&
            (rect.left < aRect.left - 0.75 || rect.right > aRect.right + 0.75);
          const verticalCut =
            ["hidden", "clip"].includes(overflowY) &&
            (rect.top < aRect.top - 0.75 || rect.bottom > aRect.bottom + 0.75);
          if (horizontalCut || verticalCut) {
            clippedBy.push({
              tag: ancestor.tagName,
              className: String(ancestor.className || "").slice(0, 180),
              overflowX,
              overflowY,
              horizontalCut,
              verticalCut,
            });
          }
        }
        ancestor = ancestor.parentElement;
      }
      if (clippedBy.length) clipping.push({ index, char: char.textContent, clippedBy });
      return {
        char: char.textContent,
        opacity: Number.parseFloat(style.opacity),
        transform: style.transform,
        transitionDelay: style.transitionDelay,
        transitionDuration: style.transitionDuration,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
      };
    });

    const first = charMetrics[0] ?? null;
    const last = charMetrics.at(-1) ?? null;
    const cedilla = charMetrics.find((item) => item.char === "Ç") ?? null;
    const rootText = node.querySelector(".sr-only")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const distinctDelays = new Set(charMetrics.map((item) => item.transitionDelay)).size;

    return {
      title: expectedTitle,
      rootText,
      expectedNonSpaces,
      characterCount: visibleCharWrappers.length,
      expectedSpaces,
      visualSpaces,
      wordCount: wordWrappers.length,
      rootOverflowX: computedRoot.overflowX,
      rootOverflowY: computedRoot.overflowY,
      rootRect: { left: rootRect.left, right: rootRect.right, top: rootRect.top, bottom: rootRect.bottom, width: rootRect.width, height: rootRect.height },
      first,
      last,
      cedilla,
      distinctDelays,
      clipping,
      horizontalScroll: Math.max(html.scrollWidth, body.scrollWidth) - window.innerWidth,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  }, title);
}

const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: "pt-BR",
      colorScheme: "light",
    });
    const page = await context.newPage();
    trackRuntime(page, `home-${viewport.name}`);
    const response = await page.goto(`${baseUrl}/?qa=${expectedSha.slice(0, 12)}-${viewport.width}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    if (!response || !response.ok()) fail(`Homepage HTTP inválido em ${viewport.name}`, { status: response?.status() });
    await settle(page);

    const viewportResult = { titles: {}, horizontalScrollBefore: null, horizontalScrollAfter: null };
    viewportResult.horizontalScrollBefore = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    if (viewportResult.horizontalScrollBefore > 1) fail(`Scroll horizontal antes do QA em ${viewport.name}`, viewportResult.horizontalScrollBefore);

    for (const title of titles) {
      const { roots, indexes } = await findTitleRoot(page, title);
      if (indexes.length !== 1) {
        fail(`Título ${title} deve existir exatamente uma vez em ${viewport.name}`, { indexes });
        viewportResult.titles[title] = { rootCount: indexes.length };
        continue;
      }
      const root = roots.nth(indexes[0]);
      const initial = await titleMetrics(root, title);
      await root.scrollIntoViewIfNeeded();
      await page.waitForTimeout(90);
      const during = await titleMetrics(root, title);
      await page.screenshot({ path: `qa-artifacts/${viewport.name}-${safeSlug(title)}-during.png` });
      await page.waitForTimeout(1900);
      const after = await titleMetrics(root, title);
      await page.screenshot({ path: `qa-artifacts/${viewport.name}-${safeSlug(title)}-after.png` });

      const expectedNonSpaces = Array.from(title.replace(/ /g, "")).length;
      const expectedSpaces = (title.match(/ /g) || []).length;
      if (after.rootText !== title) fail(`Texto final divergente: ${title} em ${viewport.name}`, after.rootText);
      if (after.characterCount !== expectedNonSpaces) fail(`Quantidade de caracteres divergente: ${title} em ${viewport.name}`, after);
      if (after.visualSpaces !== expectedSpaces) fail(`Espaços visuais divergentes: ${title} em ${viewport.name}`, after);
      if (after.clipping.length > 0 || during.clipping.length > 0) fail(`Clipping detectado em ${title} / ${viewport.name}`, { during: during.clipping, after: after.clipping });
      if (!after.first || after.first.rect.width <= 0 || !after.last || after.last.rect.width <= 0) fail(`Primeira/última letra sem caixa visual em ${title} / ${viewport.name}`, after);
      if (title.includes("Ç") && (!after.cedilla || after.cedilla.rect.width <= 0 || after.cedilla.rect.height <= 0)) fail(`Ç inválido em ${title} / ${viewport.name}`, after.cedilla);
      if (after.horizontalScroll > 1) fail(`Scroll horizontal após ${title} em ${viewport.name}`, after.horizontalScroll);
      if (after.characterCount > 1 && after.distinctDelays < 2) fail(`Stagger por letra ausente em ${title} / ${viewport.name}`, after.distinctDelays);
      if (after.rootOverflowX !== "visible" || after.rootOverflowY !== "visible") fail(`Raiz do reveal não está overflow-visible em ${title} / ${viewport.name}`, { x: after.rootOverflowX, y: after.rootOverflowY });
      if (after.first && (after.first.rect.left < -1 || after.first.rect.right > viewport.width + 1)) fail(`Primeira letra fora do viewport em ${title} / ${viewport.name}`, after.first.rect);
      if (after.last && (after.last.rect.left < -1 || after.last.rect.right > viewport.width + 1)) fail(`Última letra fora do viewport em ${title} / ${viewport.name}`, after.last.rect);
      const allFinished = [after.first, after.last, after.cedilla].filter(Boolean).every((item) => item.opacity >= 0.99 && (item.transform === "none" || item.transform === "matrix(1, 0, 0, 1, 0, 0)"));
      if (!allFinished) fail(`Animação não terminou limpa em ${title} / ${viewport.name}`, { first: after.first, last: after.last, cedilla: after.cedilla });

      viewportResult.titles[title] = { rootCount: indexes.length, initial, during, after };
    }

    viewportResult.horizontalScrollAfter = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    if (viewportResult.horizontalScrollAfter > 1) fail(`Scroll horizontal final em ${viewport.name}`, viewportResult.horizontalScrollAfter);
    await page.screenshot({ path: `qa-artifacts/${viewport.name}-home-final.png`, fullPage: true });
    report.viewports[viewport.name] = viewportResult;
    await context.close();
  }

  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    locale: "pt-BR",
  });
  const reducedPage = await reducedContext.newPage();
  trackRuntime(reducedPage, "home-reduced-motion");
  const reducedResponse = await reducedPage.goto(`${baseUrl}/?qa=reduced-${expectedSha.slice(0, 12)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!reducedResponse || !reducedResponse.ok()) fail("Homepage reduced-motion HTTP inválido", { status: reducedResponse?.status() });
  await settle(reducedPage);
  for (const title of titles) {
    const { roots, indexes } = await findTitleRoot(reducedPage, title);
    if (indexes.length !== 1) {
      fail(`Reduced motion: ${title} não é único`, { indexes });
      continue;
    }
    const root = roots.nth(indexes[0]);
    await root.scrollIntoViewIfNeeded();
    await reducedPage.waitForTimeout(120);
    const metrics = await titleMetrics(root, title);
    const inner = root.locator("[data-slide-character] > span");
    const styles = await inner.evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      return { opacity: style.opacity, transform: style.transform, transitionDuration: style.transitionDuration };
    }));
    const reducedOk = styles.every((style) => Number.parseFloat(style.opacity) >= 0.99 && style.transform === "none" && (style.transitionDuration === "0s" || style.transitionDuration === "0ms"));
    if (!reducedOk) fail(`prefers-reduced-motion não está limpo em ${title}`, styles.slice(0, 5));
    report.reducedMotion[title] = { metrics, styles: styles.slice(0, 8), ok: reducedOk };
  }
  await reducedContext.close();

  const routeContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  for (const path of ["/", "/products", "/login", "/cadastro", "/cart", "/admin"]) {
    const page = await routeContext.newPage();
    trackRuntime(page, `route-${path}`);
    const response = await page.goto(`${baseUrl}${path}${path.includes("?") ? "&" : "?"}qa=route-${expectedSha.slice(0, 8)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await settle(page);
    const bodyTextLength = await page.locator("body").innerText().then((text) => text.trim().length).catch(() => 0);
    const horizontalScroll = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    const result = { status: response?.status() ?? null, finalUrl: page.url(), bodyTextLength, horizontalScroll };
    report.routes[path] = result;
    if (!response || response.status() >= 400) fail(`Rota ${path} retornou erro`, result);
    if (bodyTextLength < 20) fail(`Rota ${path} parece vazia`, result);
    if (horizontalScroll > 1) fail(`Rota ${path} tem scroll horizontal no mobile`, result);
    if (path === "/admin" && !/\/login(?:\?|$)/.test(page.url())) fail("/admin não redirecionou visitante para login", result);
    await page.screenshot({ path: `qa-artifacts/route-${safeSlug(path || "home")}.png`, fullPage: false });
    await page.close();
  }
  await routeContext.close();
} finally {
  await browser.close();
}

report.finishedAt = new Date().toISOString();
fs.writeFileSync("qa-artifacts/report.json", JSON.stringify(report, null, 2));
console.log("PRODUCTION_QA_REPORT");
console.log(JSON.stringify({ expectedSha, failures: report.failures, runtime: report.runtime, routes: report.routes }, null, 2));
if (report.failures.length > 0) process.exit(1);
console.log("Production browser QA passed.");
