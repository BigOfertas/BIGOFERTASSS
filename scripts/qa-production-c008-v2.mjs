import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "https://bigofertas.net";
const SHA = "c0087811538a4e954183c0e1c2e80d34afa4f9c7";
const TITLES = [
  "LANÇAMENTOS",
  "MONTE SEU PEDIDO",
  "ENCONTRE SEU TIME",
  "COMPRE POR LIGA",
  "PERGUNTAS FREQUENTES",
];
const VIEWPORTS = [
  ["desktop-1440", 1440, 1100],
  ["tablet-768", 768, 1024],
  ["mobile-390", 390, 844],
];
const out = "qa-artifacts-v2";
fs.mkdirSync(out, { recursive: true });

const report = {
  sha: SHA,
  startedAt: new Date().toISOString(),
  headings: {},
  reducedMotion: {},
  routes: {},
  runtime: [],
  failures: [],
};

const canonical = (value) =>
  String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
const slug = (value) =>
  canonical(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const fail = (message, details = null) => report.failures.push({ message, ...(details === null ? {} : { details }) });

function runtimeWatch(page, label) {
  page.on("pageerror", (error) => {
    report.runtime.push({ label, type: "pageerror", message: error.message });
    fail(`Runtime error em ${label}`, error.message);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const message = msg.text();
    report.runtime.push({ label, type: "console.error", message });
    if (/\b(?:Uncaught|TypeError|ReferenceError|SyntaxError|RangeError)\b/i.test(message)) {
      fail(`Console runtime error em ${label}`, message);
    }
  });
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function rootFor(page, expected) {
  const roots = page.locator("[data-slide-up-reveal]");
  const matches = [];
  for (let i = 0; i < (await roots.count()); i += 1) {
    const text = await roots.nth(i).locator(".sr-only").first().textContent().catch(() => "");
    if (canonical(text) === expected) matches.push(i);
  }
  return { roots, matches };
}

async function metrics(root, expected) {
  return root.evaluate((node, expectedUpper) => {
    const canon = (v) =>
      String(v ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleUpperCase("pt-BR");
    const visualCharWrappers = [...node.querySelectorAll("[data-slide-character]")];
    const chars = visualCharWrappers
      .map((wrapper) => wrapper.firstElementChild)
      .filter((el) => el instanceof HTMLElement);
    const words = [...node.querySelectorAll("[data-slide-word]")];
    const clipping = [];
    const rows = chars.map((el, index) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      let parent = el.parentElement;
      const clippedBy = [];
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const ps = getComputedStyle(parent);
        if (["hidden", "clip"].includes(ps.overflowX) || ["hidden", "clip"].includes(ps.overflowY)) {
          const pr = parent.getBoundingClientRect();
          const x = ["hidden", "clip"].includes(ps.overflowX) && (rect.left < pr.left - 1 || rect.right > pr.right + 1);
          const y = ["hidden", "clip"].includes(ps.overflowY) && (rect.top < pr.top - 1 || rect.bottom > pr.bottom + 1);
          if (x || y) clippedBy.push({ tag: parent.tagName, className: String(parent.className || "").slice(0, 160), overflowX: ps.overflowX, overflowY: ps.overflowY, x, y });
        }
        parent = parent.parentElement;
      }
      if (clippedBy.length) clipping.push({ index, char: el.textContent, clippedBy });
      return {
        char: el.textContent,
        charUpper: canon(el.textContent),
        opacity: Number.parseFloat(style.opacity),
        transform: style.transform,
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
        transitionDelay: style.transitionDelay,
        fontStyle: style.fontStyle,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
      };
    });
    const rs = getComputedStyle(node);
    const rr = node.getBoundingClientRect();
    const srText = node.querySelector(".sr-only")?.textContent ?? "";
    const visualSpaces = words.reduce((sum, word) => {
      const last = word.lastElementChild;
      return sum + (last && !last.matches("[data-slide-character]") && last.textContent?.includes("\u00a0") ? 1 : 0);
    }, 0);
    return {
      sourceText: srText,
      canonicalText: canon(srText),
      expected: expectedUpper,
      charCount: visualCharWrappers.length,
      visualSpaces,
      wordCount: words.length,
      rootOverflowX: rs.overflowX,
      rootOverflowY: rs.overflowY,
      rootRect: { left: rr.left, right: rr.right, top: rr.top, bottom: rr.bottom, width: rr.width, height: rr.height },
      first: rows[0] ?? null,
      last: rows.at(-1) ?? null,
      cedilla: rows.find((row) => row.charUpper === "Ç") ?? null,
      distinctDelays: new Set(rows.map((row) => row.transitionDelay)).size,
      animationRows: rows,
      clipping,
      horizontalScroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      viewportWidth: window.innerWidth,
    };
  }, expected);
}

function assertHeading(result, expected, viewportName, phase) {
  const expectedChars = Array.from(expected.replace(/ /g, "")).length;
  const expectedSpaces = (expected.match(/ /g) || []).length;
  if (result.canonicalText !== expected) fail(`${expected}: texto divergente em ${viewportName}/${phase}`, result.sourceText);
  if (result.charCount !== expectedChars) fail(`${expected}: caracteres duplicados/faltando em ${viewportName}/${phase}`, { actual: result.charCount, expected: expectedChars });
  if (result.visualSpaces !== expectedSpaces) fail(`${expected}: espaços divergentes em ${viewportName}/${phase}`, { actual: result.visualSpaces, expected: expectedSpaces });
  if (result.clipping.length) fail(`${expected}: clipping detectado em ${viewportName}/${phase}`, result.clipping);
  if (result.horizontalScroll > 1) fail(`${expected}: scroll horizontal em ${viewportName}/${phase}`, result.horizontalScroll);
  if (result.rootOverflowX !== "visible" || result.rootOverflowY !== "visible") fail(`${expected}: reveal root não é overflow-visible em ${viewportName}/${phase}`, { x: result.rootOverflowX, y: result.rootOverflowY });
  if (!result.first || result.first.rect.width <= 0 || !result.last || result.last.rect.width <= 0) fail(`${expected}: primeira/última letra inválida em ${viewportName}/${phase}`);
  if (expected.includes("Ç") && (!result.cedilla || result.cedilla.rect.width <= 0 || result.cedilla.rect.height <= 0)) fail(`${expected}: Ç inválido em ${viewportName}/${phase}`, result.cedilla);
  if (result.first && (result.first.rect.left < -1 || result.first.rect.right > result.viewportWidth + 1)) fail(`${expected}: primeira letra fora do viewport em ${viewportName}/${phase}`, result.first.rect);
  if (result.last && (result.last.rect.left < -1 || result.last.rect.right > result.viewportWidth + 1)) fail(`${expected}: última letra fora do viewport em ${viewportName}/${phase}`, result.last.rect);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const [name, width, height] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width, height }, locale: "pt-BR" });
    const page = await ctx.newPage();
    runtimeWatch(page, `home-${name}`);
    const response = await page.goto(`${BASE}/?qa=v2-${SHA.slice(0, 10)}-${width}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!response?.ok()) fail(`Homepage HTTP inválido em ${name}`, response?.status() ?? null);
    await settle(page);
    const scrollBefore = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    if (scrollBefore > 1) fail(`Homepage tem scroll horizontal antes das animações em ${name}`, scrollBefore);
    report.headings[name] = {};

    for (const expected of TITLES) {
      const { roots, matches } = await rootFor(page, expected);
      if (matches.length !== 1) {
        fail(`${expected}: reveal deve existir exatamente uma vez em ${name}`, matches);
        report.headings[name][expected] = { matches };
        continue;
      }
      const root = roots.nth(matches[0]);
      const before = await metrics(root, expected);
      await root.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      const during = await metrics(root, expected);
      assertHeading(during, expected, name, "during");
      await page.screenshot({ path: `${out}/${name}-${slug(expected)}-during.png` });
      await page.waitForTimeout(1800);
      const after = await metrics(root, expected);
      assertHeading(after, expected, name, "after");
      if (after.charCount > 1 && after.distinctDelays < 2) fail(`${expected}: stagger por letra ausente em ${name}`, after.distinctDelays);
      if (!after.animationRows.every((row) => row.transitionProperty.includes("transform") && row.transitionProperty.includes("opacity"))) fail(`${expected}: animação não é individual por transform/opacity em ${name}`);
      const important = [after.first, after.last, after.cedilla].filter(Boolean);
      if (!important.every((row) => row.opacity >= 0.99 && (row.transform === "none" || row.transform === "matrix(1, 0, 0, 1, 0, 0)"))) fail(`${expected}: estado final da animação não está limpo em ${name}`, important);
      await page.screenshot({ path: `${out}/${name}-${slug(expected)}-after.png` });
      report.headings[name][expected] = { matches, before, during, after };
    }

    const scrollAfter = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    if (scrollAfter > 1) fail(`Homepage tem scroll horizontal após animações em ${name}`, scrollAfter);
    await page.screenshot({ path: `${out}/${name}-home-full.png`, fullPage: true });
    await ctx.close();
  }

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR", reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  runtimeWatch(reducedPage, "home-reduced-motion");
  const reducedResponse = await reducedPage.goto(`${BASE}/?qa=v2-reduced-${SHA.slice(0, 10)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!reducedResponse?.ok()) fail("Homepage HTTP inválido em reduced-motion", reducedResponse?.status() ?? null);
  await settle(reducedPage);
  for (const expected of TITLES) {
    const { roots, matches } = await rootFor(reducedPage, expected);
    if (matches.length !== 1) {
      fail(`${expected}: reveal reduced-motion deve existir exatamente uma vez`, matches);
      continue;
    }
    const root = roots.nth(matches[0]);
    await root.scrollIntoViewIfNeeded();
    await reducedPage.waitForTimeout(100);
    const result = await metrics(root, expected);
    const styles = await root.locator("[data-slide-character] > span").evaluateAll((nodes) => nodes.map((node) => {
      const s = getComputedStyle(node);
      return { opacity: s.opacity, transform: s.transform, transitionProperty: s.transitionProperty };
    }));
    const ok = styles.every((s) => Number.parseFloat(s.opacity) >= 0.99 && s.transform === "none" && s.transitionProperty === "none");
    if (!ok) fail(`${expected}: prefers-reduced-motion não desativa movimento`, styles.slice(0, 6));
    report.reducedMotion[expected] = { ok, result, sampleStyles: styles.slice(0, 6) };
  }
  await reduced.close();

  const routes = ["/", "/products", "/login", "/cadastro", "/cart", "/admin"];
  const routeCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  for (const path of routes) {
    const page = await routeCtx.newPage();
    runtimeWatch(page, `route-${path}`);
    const response = await page.goto(`${BASE}${path}?qa=v2-${SHA.slice(0, 8)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await settle(page);
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const horizontalScroll = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    const item = { status: response?.status() ?? null, finalUrl: page.url(), bodyTextLength: bodyText.trim().length, horizontalScroll };
    report.routes[path] = item;
    if (!response || response.status() >= 400) fail(`${path}: HTTP inválido`, item);
    if (item.bodyTextLength < 20) fail(`${path}: página aparentemente vazia`, item);
    if (horizontalScroll > 1) fail(`${path}: scroll horizontal em 390px`, horizontalScroll);
    if (path === "/admin" && !/\/login(?:\?|$)/.test(page.url())) fail("/admin: visitante não foi redirecionado ao login", item);
    await page.screenshot({ path: `${out}/route-${slug(path || "home") || "home"}.png` });
    await page.close();
  }
  await routeCtx.close();
} finally {
  await browser.close();
}

report.finishedAt = new Date().toISOString();
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log("PRODUCTION_QA_V2");
console.log(JSON.stringify({ sha: SHA, failures: report.failures, runtime: report.runtime, routes: report.routes }, null, 2));
if (report.failures.length) process.exit(1);
console.log("Production browser QA v2 passed.");
