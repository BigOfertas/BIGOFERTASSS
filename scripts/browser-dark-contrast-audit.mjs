import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import axe from "axe-core";

const BASE_URL = "https://bigofertas.net";
const SUPABASE_ORIGIN = "https://hootwcacnrtidfmqsvrn.supabase.co";
const AUTH_STORAGE_KEY = "sb-hootwcacnrtidfmqsvrn-auth-token";
const MODE = process.env.AUDIT_MODE ?? "routes";
const VIEWPORT_NAME = process.env.AUDIT_VIEWPORT ?? "desktop";
const SHARD_INDEX = Number(process.env.AUDIT_SHARD_INDEX ?? 0);
const SHARD_TOTAL = Number(process.env.AUDIT_SHARD_TOTAL ?? 1);
const OUTPUT_ROOT = path.join(
  process.cwd(),
  "browser-audit",
  `${MODE}-${VIEWPORT_NAME}-${SHARD_INDEX}-of-${SHARD_TOTAL}`,
);

const VIEWPORTS = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};
const viewport = VIEWPORTS[VIEWPORT_NAME] ?? VIEWPORTS.desktop;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safeName = (value) =>
  value
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150) || "page";

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function fakeAuthSession() {
  const now = Math.floor(Date.now() / 1000);
  const userId = "11111111-2222-4333-8444-555555555555";
  const payload = {
    aud: "authenticated",
    exp: now + 24 * 60 * 60,
    iat: now,
    sub: userId,
    email: "browser-audit@dropbox.local",
    role: "authenticated",
  };
  const accessToken = `${base64url({ alg: "none", typ: "JWT" })}.${base64url(payload)}.audit`;
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 86400,
    expires_at: now + 86400,
    refresh_token: "browser-audit-refresh-token",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "browser-audit@dropbox.local",
      email_confirmed_at: new Date().toISOString(),
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "Auditoria Browser" },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

function seededCart() {
  return {
    version: 2,
    items: [
      {
        lineId: "audit::variant::seed",
        productId: "11111111-1111-4111-8111-111111111111",
        productSlug: "produto-auditoria-visual",
        variantId: "22222222-2222-4222-8222-222222222222",
        sku: "AUDIT-G",
        name: "Produto de auditoria visual",
        variantName: "Torcedor",
        unitPrice: 219.9,
        imageUrl: null,
        quantity: 2,
        availableStock: null,
        selectedOptions: [
          {
            optionId: "purchase-size",
            optionName: "Tamanho",
            optionKind: "size",
            valueId: "g",
            valueLabel: "G",
          },
        ],
        customization: {
          size: "G",
          personalization: null,
          phrase: null,
          patchCode: null,
          patchCodes: [],
        },
        status: "available",
      },
    ],
  };
}

async function ensureOutput() {
  await fs.mkdir(path.join(OUTPUT_ROOT, "screenshots"), { recursive: true });
}

async function configureContext(browser, { authenticated = false, cart = false } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: "dark",
    locale: "pt-BR",
  });

  const authSession = authenticated ? fakeAuthSession() : null;
  const cartState = cart ? seededCart() : null;
  await context.addInitScript(
    ({ authKey, authValue, cartValue }) => {
      localStorage.setItem("dropbox-theme", "dark");
      localStorage.setItem("dropbox-locale", "pt");
      if (authValue) localStorage.setItem(authKey, JSON.stringify(authValue));
      if (cartValue) localStorage.setItem("bigofertas_cart", JSON.stringify(cartValue));
    },
    { authKey: AUTH_STORAGE_KEY, authValue: authSession, cartValue: cartState },
  );

  if (authenticated || cart) {
    await context.route(`${SUPABASE_ORIGIN}/rest/v1/**`, async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.pathname.includes("/user_roles")) {
        const accept = request.headers()["accept"] ?? "";
        const body = accept.includes("object") ? { role: "owner" } : [{ role: "owner" }];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        return;
      }

      if (url.pathname.includes("/rpc/validate_cart_items")) {
        let incoming = [];
        try {
          const body = JSON.parse(request.postData() ?? "{}");
          incoming = Array.isArray(body?.p_items) ? body.p_items : [];
        } catch {
          incoming = [];
        }
        const rows = incoming.map((item) => ({
          line_id: item.line_id,
          product_id: item.product_id,
          product_slug: "produto-auditoria-visual",
          product_name: "Produto de auditoria visual",
          variant_id: item.variant_id,
          variant_sku: "AUDIT-G",
          variant_name: "Torcedor",
          unit_price: 219.9,
          available_stock: null,
          customization: item.customization ?? {},
          status: "available",
        }));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows) });
        return;
      }

      const accept = request.headers()["accept"] ?? "";
      const generic = accept.includes("object") ? {} : [];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(generic) });
    });

    await context.route(`${SUPABASE_ORIGIN}/functions/v1/**`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
  }

  return context;
}

async function settlePage(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("body", { timeout: 20_000 });
  await sleep(450);
  await page.evaluate(() => {
    document.querySelector("[data-initial-boot-splash]")?.remove();
    document.documentElement.classList.add("dark");
    document.body.style.overflow = "auto";
  });
  await sleep(250);
}

async function collectVisualSignals(page) {
  await page.addScriptTag({ content: axe.source });
  const axeResults = await page.evaluate(async () => {
    const result = await globalThis.axe.run(document, {
      runOnly: { type: "rule", values: ["color-contrast"] },
      resultTypes: ["violations", "incomplete"],
    });
    return {
      violations: result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.slice(0, 25).map((node) => ({
          html: node.html.slice(0, 350),
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
      incomplete: result.incomplete
        .filter((entry) => entry.id === "color-contrast")
        .map((entry) => ({
          id: entry.id,
          impact: entry.impact,
          nodes: entry.nodes.slice(0, 25).map((node) => ({
            html: node.html.slice(0, 350),
            target: node.target,
            summary: node.failureSummary,
          })),
        })),
    };
  });

  const surfaces = await page.evaluate(() => {
    const selectors = [
      "[data-product-card]",
      ".glass-card",
      ".glass-panel",
      ".liquid-glass-card",
      ".account-action-card",
      ".account-profile-card",
      ".auth-form-card",
      "article",
      "aside",
      "form",
      "[role='dialog']",
      "[class*='card']",
      "[class*='panel']",
    ];

    const parseRgb = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/i);
      if (!match) return null;
      const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
      if (parts.length < 3 || parts.some((part, index) => index < 3 && !Number.isFinite(part))) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
    };

    const luminance = ({ r, g, b }) => {
      const channel = (value) => {
        const normalized = value / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : Math.pow((normalized + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };

    const bodyColor = parseRgb(getComputedStyle(document.body).backgroundColor) ?? { r: 0, g: 0, b: 0, a: 1 };
    const bodyLum = luminance(bodyColor);
    const seen = new Set();
    const rows = [];

    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (seen.has(element)) continue;
        seen.add(element);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
        if (rect.width < 120 || rect.height < 42 || rect.width * rect.height < 7000) continue;
        const rgb = parseRgb(style.backgroundColor);
        const bgLum = rgb && rgb.a > 0.45 ? luminance(rgb) : null;
        const border = parseRgb(style.borderTopColor);
        const borderLum = border && border.a > 0.2 ? luminance(border) : null;
        const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
        if (!text) continue;
        const className = typeof element.className === "string" ? element.className.slice(0, 240) : "";
        const lightSurface = bgLum !== null && bgLum > 0.24;
        const mergesIntoBody =
          bgLum !== null && Math.abs(bgLum - bodyLum) < 0.012 && (borderLum === null || Math.abs(borderLum - bodyLum) < 0.02);
        rows.push({
          tag: element.tagName,
          className,
          text,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage.slice(0, 260),
          color: style.color,
          borderColor: style.borderTopColor,
          bgLum,
          bodyLum,
          lightSurface,
          mergesIntoBody,
        });
      }
    }

    return {
      lightSurfaces: rows.filter((row) => row.lightSurface).slice(0, 50),
      mergedSurfaces: rows.filter((row) => row.mergesIntoBody).slice(0, 50),
      sampled: rows.length,
    };
  });

  return { axeResults, surfaces };
}

async function auditPage(context, { label, url, screenshot = true, expectedPath = null }) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 700));
  });
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 700)));

  let navigationError = null;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await settlePage(page);
  } catch (error) {
    navigationError = String(error);
  }

  let signals = { axeResults: { violations: [], incomplete: [] }, surfaces: { lightSurfaces: [], mergedSurfaces: [], sampled: 0 } };
  if (!navigationError) {
    try {
      signals = await collectVisualSignals(page);
    } catch (error) {
      pageErrors.push(`audit: ${String(error)}`);
    }
  }

  const finalUrl = page.url();
  const finalPath = (() => {
    try {
      return new URL(finalUrl).pathname;
    } catch {
      return finalUrl;
    }
  })();
  const unexpectedRedirect = expectedPath ? finalPath !== expectedPath : false;
  const violationCount = signals.axeResults.violations.reduce((sum, item) => sum + item.nodes.length, 0);
  const shouldScreenshot =
    screenshot ||
    violationCount > 0 ||
    signals.surfaces.lightSurfaces.length > 0 ||
    signals.surfaces.mergedSurfaces.length > 0 ||
    unexpectedRedirect;
  let screenshotPath = null;
  if (shouldScreenshot && !navigationError) {
    screenshotPath = path.join(
      OUTPUT_ROOT,
      "screenshots",
      `${safeName(`${label}-${VIEWPORT_NAME}`)}.png`,
    );
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (error) {
      pageErrors.push(`screenshot: ${String(error)}`);
    }
  }

  const result = {
    label,
    requestedUrl: url,
    finalUrl,
    expectedPath,
    unexpectedRedirect,
    navigationError,
    violationCount,
    axe: signals.axeResults,
    surfaces: signals.surfaces,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 15),
    pageErrors: [...new Set(pageErrors)].slice(0, 15),
    screenshotPath: screenshotPath ? path.relative(OUTPUT_ROOT, screenshotPath) : null,
  };

  await page.close();
  return result;
}

async function discoverProductLinks(context) {
  const page = await context.newPage();
  const links = new Set();
  let emptyPages = 0;

  for (let current = 1; current <= 100; current += 1) {
    const url = `${BASE_URL}/products?pageSize=48&page=${current}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await settlePage(page);
    const found = await page.locator('a[href^="/product/"]').evaluateAll((anchors) =>
      anchors
        .map((anchor) => anchor.getAttribute("href"))
        .filter((href) => typeof href === "string" && href.startsWith("/product/")),
    );
    const before = links.size;
    for (const href of found) links.add(href.split("?")[0]);
    if (found.length === 0 || links.size === before) emptyPages += 1;
    else emptyPages = 0;
    if (emptyPages >= 2) break;
  }

  await page.close();
  return [...links].sort();
}

async function auditRoutes(browser) {
  const results = [];
  const publicContext = await configureContext(browser);
  const cartContext = await configureContext(browser, { cart: true });
  const authContext = await configureContext(browser, { authenticated: true });

  const publicRoutes = [
    ["home", "/"],
    ["products", "/products?pageSize=48"],
    ["login", "/login"],
    ["cadastro", "/cadastro"],
    ["confirmar-email", "/confirmar-email?email=browser-audit%40dropbox.local"],
    ["esqueci-senha", "/esqueci-senha"],
    ["redefinir-senha", "/redefinir-senha"],
    ["contato", "/contato"],
    ["privacidade", "/privacidade"],
    ["producao-e-envio", "/producao-e-envio"],
    ["termos-de-compra", "/termos-de-compra"],
    ["trocas-e-devolucoes", "/trocas-e-devolucoes"],
  ];

  for (const [label, route] of publicRoutes) {
    results.push(
      await auditPage(publicContext, {
        label,
        url: `${BASE_URL}${route}`,
        screenshot: true,
        expectedPath: route.split("?")[0],
      }),
    );
  }

  const productLinks = await discoverProductLinks(publicContext);
  if (productLinks[0]) {
    results.push(
      await auditPage(publicContext, {
        label: "product-representative",
        url: `${BASE_URL}${productLinks[0]}`,
        screenshot: true,
        expectedPath: productLinks[0],
      }),
    );
  }

  for (const [label, route] of [
    ["cart-filled", "/cart"],
    ["checkout-filled", "/checkout"],
  ]) {
    results.push(
      await auditPage(cartContext, {
        label,
        url: `${BASE_URL}${route}`,
        screenshot: true,
        expectedPath: route,
      }),
    );
  }

  const accountRoutes = [
    ["account-overview", "/conta"],
    ["account-data", "/conta?secao=dados"],
    ["account-addresses", "/conta?secao=enderecos"],
    ["account-orders", "/conta?secao=pedidos"],
    ["account-affiliates", "/conta?secao=afiliados"],
    ["account-order-detail", "/conta/pedidos/BIG-2026-000001"],
  ];
  for (const [label, route] of accountRoutes) {
    results.push(
      await auditPage(authContext, {
        label,
        url: `${BASE_URL}${route}`,
        screenshot: true,
        expectedPath: route.split("?")[0],
      }),
    );
  }

  const adminPage = await authContext.newPage();
  const adminConsoleErrors = [];
  adminPage.on("console", (message) => {
    if (message.type() === "error") adminConsoleErrors.push(message.text().slice(0, 700));
  });
  await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await settlePage(adminPage);
  const adminSections = ["Visão geral", "Pedidos", "Financeiro", "Produtos", "Personalização", "Afiliados"];
  for (const section of adminSections) {
    const button = adminPage.getByRole("button", { name: new RegExp(section, "i") }).first();
    if (await button.count()) {
      await button.click().catch(() => {});
      await sleep(350);
    }
    const signals = await collectVisualSignals(adminPage).catch(() => ({
      axeResults: { violations: [], incomplete: [] },
      surfaces: { lightSurfaces: [], mergedSurfaces: [], sampled: 0 },
    }));
    const screenshotPath = path.join(
      OUTPUT_ROOT,
      "screenshots",
      `${safeName(`admin-${section}-${VIEWPORT_NAME}`)}.png`,
    );
    await adminPage.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    results.push({
      label: `admin-${section}`,
      requestedUrl: `${BASE_URL}/admin`,
      finalUrl: adminPage.url(),
      expectedPath: "/admin",
      unexpectedRedirect: new URL(adminPage.url()).pathname !== "/admin",
      navigationError: null,
      violationCount: signals.axeResults.violations.reduce((sum, item) => sum + item.nodes.length, 0),
      axe: signals.axeResults,
      surfaces: signals.surfaces,
      consoleErrors: [...new Set(adminConsoleErrors)].slice(0, 15),
      pageErrors: [],
      screenshotPath: path.relative(OUTPUT_ROOT, screenshotPath),
    });
  }
  await adminPage.close();

  await Promise.all([publicContext.close(), cartContext.close(), authContext.close()]);
  return { results, discoveredProducts: productLinks.length };
}

async function auditProducts(browser) {
  const context = await configureContext(browser);
  const productLinks = await discoverProductLinks(context);
  const assigned = productLinks.filter((_, index) => index % SHARD_TOTAL === SHARD_INDEX);
  const results = [];

  for (let index = 0; index < assigned.length; index += 1) {
    const href = assigned[index];
    const result = await auditPage(context, {
      label: `product-${SHARD_INDEX}-${index}-${href}`,
      url: `${BASE_URL}${href}`,
      screenshot: index === 0 || index % 75 === 0,
      expectedPath: href,
    });
    results.push(result);
    if ((index + 1) % 25 === 0) {
      console.log(
        `BROWSER_PRODUCT_AUDIT_PROGRESS viewport=${VIEWPORT_NAME} shard=${SHARD_INDEX}/${SHARD_TOTAL} checked=${index + 1}/${assigned.length}`,
      );
    }
  }

  await context.close();
  return { results, discoveredProducts: productLinks.length, assignedProducts: assigned.length };
}

await ensureOutput();
const browser = await chromium.launch({ headless: true });
let payload;
try {
  payload = MODE === "products" ? await auditProducts(browser) : await auditRoutes(browser);
} finally {
  await browser.close();
}

const summary = {
  mode: MODE,
  viewport: VIEWPORT_NAME,
  shardIndex: SHARD_INDEX,
  shardTotal: SHARD_TOTAL,
  discoveredProducts: payload.discoveredProducts ?? null,
  assignedProducts: payload.assignedProducts ?? null,
  pagesChecked: payload.results.length,
  pagesWithContrastViolations: payload.results.filter((item) => item.violationCount > 0).length,
  contrastViolationNodes: payload.results.reduce((sum, item) => sum + item.violationCount, 0),
  pagesWithLightCardSurfaces: payload.results.filter((item) => item.surfaces.lightSurfaces.length > 0).length,
  pagesWithMergedCardSurfaces: payload.results.filter((item) => item.surfaces.mergedSurfaces.length > 0).length,
  unexpectedRedirects: payload.results.filter((item) => item.unexpectedRedirect).length,
  navigationErrors: payload.results.filter((item) => item.navigationError).length,
  pageErrors: payload.results.reduce((sum, item) => sum + item.pageErrors.length, 0),
};

await fs.writeFile(
  path.join(OUTPUT_ROOT, "report.json"),
  JSON.stringify({ summary, results: payload.results }, null, 2) + "\n",
);
await fs.writeFile(path.join(OUTPUT_ROOT, "summary.json"), JSON.stringify(summary, null, 2) + "\n");

console.log(`BROWSER_DARK_CONTRAST_SUMMARY ${JSON.stringify(summary)}`);

if (summary.navigationErrors > 0 || summary.unexpectedRedirects > 0) process.exitCode = 2;
if (summary.pagesWithContrastViolations > 0 || summary.pagesWithLightCardSurfaces > 0) process.exitCode = 3;
