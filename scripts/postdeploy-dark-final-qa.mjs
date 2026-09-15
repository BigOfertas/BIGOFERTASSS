import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const BASE_URL = "https://bigofertas.net";
const SUPABASE_ORIGIN = "https://hootwcacnrtidfmqsvrn.supabase.co";
const AUTH_STORAGE_KEY = "sb-hootwcacnrtidfmqsvrn-auth-token";
const OUT = path.join(process.cwd(), "postdeploy-dark-qa");

const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function fakeAuthSession() {
  const now = Math.floor(Date.now() / 1000);
  const userId = "11111111-2222-4333-8444-555555555555";
  const payload = {
    aud: "authenticated",
    exp: now + 86400,
    iat: now,
    sub: userId,
    email: "postdeploy-dark-qa@dropbox.local",
    role: "authenticated",
  };
  const accessToken = `${base64url({ alg: "none", typ: "JWT" })}.${base64url(payload)}.audit`;
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 86400,
    expires_at: now + 86400,
    refresh_token: "postdeploy-dark-qa-refresh-token",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "postdeploy-dark-qa@dropbox.local",
      email_confirmed_at: new Date().toISOString(),
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { full_name: "Postdeploy Dark QA" },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

async function setupContext(browser, viewportName, authenticated = false) {
  const context = await browser.newContext({
    viewport: viewports[viewportName],
    colorScheme: "dark",
    locale: "pt-BR",
  });

  const authSession = authenticated ? fakeAuthSession() : null;
  await context.addInitScript(
    ({ authKey, authValue }) => {
      localStorage.setItem("dropbox-theme", "dark");
      localStorage.setItem("dropbox-locale", "pt");
      if (authValue) localStorage.setItem(authKey, JSON.stringify(authValue));
    },
    { authKey: AUTH_STORAGE_KEY, authValue: authSession },
  );

  if (authenticated) {
    await context.route(`${SUPABASE_ORIGIN}/rest/v1/**`, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const accept = request.headers()["accept"] ?? "";

      if (url.pathname.includes("/user_roles")) {
        const body = accept.includes("object") ? { role: "owner" } : [{ role: "owner" }];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        return;
      }

      const body = accept.includes("object") ? {} : [];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });

    await context.route(`${SUPABASE_ORIGIN}/functions/v1/**`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
  }

  return context;
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("body", { timeout: 20_000 });
  await page.waitForTimeout(650);
  await page.evaluate(() => {
    document.querySelector("[data-initial-boot-splash]")?.remove();
    document.documentElement.classList.add("dark");
    document.body.style.overflow = "auto";
  });
  await page.waitForTimeout(350);
}

function parseRgb(value) {
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const p = match[1].split(",").map((x) => Number.parseFloat(x.trim()));
  return { r: p[0], g: p[1], b: p[2], a: Number.isFinite(p[3]) ? p[3] : 1 };
}

function luminance(rgb) {
  const channel = (v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

async function checkKickers(browser, viewportName, results) {
  const context = await setupContext(browser, viewportName, false);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await settle(page);
  await page.locator(".display-kicker").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(500);

  const themeDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  const kickers = await page.locator(".display-kicker").evaluateAll((elements) =>
    elements
      .filter((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
      })
      .map((el) => ({
        text: (el.textContent ?? "").trim(),
        color: getComputedStyle(el).color,
      })),
  );

  const expected = { r: 239, g: 68, b: 68 };
  const background = { r: 9, g: 9, b: 9 };
  const expectedContrast = contrast(expected, background);
  const wrong = kickers.filter((k) => {
    const rgb = parseRgb(k.color);
    return !rgb || Math.round(rgb.r) !== 239 || Math.round(rgb.g) !== 68 || Math.round(rgb.b) !== 68;
  });

  await page.screenshot({ path: path.join(OUT, `home-${viewportName}.png`), fullPage: true });
  results.push({
    viewport: viewportName,
    check: "display-kicker",
    themeDark,
    visibleKickers: kickers.length,
    wrong,
    expectedContrast,
    consoleErrors,
    pageErrors,
    pass: themeDark && kickers.length > 0 && wrong.length === 0 && expectedContrast >= 4.5,
  });

  await page.close();
  await context.close();
}

async function checkOrderDetail(browser, viewportName, results) {
  const context = await setupContext(browser, viewportName, true);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  const expectedPath = "/conta/pedidos/BIG-2026-000001";
  await page.goto(`${BASE_URL}${expectedPath}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await settle(page);

  const finalPath = new URL(page.url()).pathname;
  const themeDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  const detail = await page.evaluate(() => {
    const root = document.querySelector("div.flex.min-h-screen.flex-col");
    if (!root) return null;
    const style = getComputedStyle(root);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      className: root.className,
    };
  });

  const bg = detail ? parseRgb(detail.backgroundColor) : null;
  const bgLum = bg ? luminance(bg) : null;
  await page.screenshot({ path: path.join(OUT, `order-detail-${viewportName}.png`), fullPage: true });

  results.push({
    viewport: viewportName,
    check: "order-detail-dark-background",
    finalPath,
    themeDark,
    detail,
    backgroundLuminance: bgLum,
    consoleErrors,
    pageErrors,
    pass: finalPath === expectedPath && themeDark && bgLum !== null && bgLum <= 0.02,
  });

  await page.close();
  await context.close();
}

await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewportName of Object.keys(viewports)) {
    await checkKickers(browser, viewportName, results);
    await checkOrderDetail(browser, viewportName, results);
  }
} finally {
  await browser.close();
}

const summary = {
  production: BASE_URL,
  checks: results.length,
  passed: results.filter((r) => r.pass).length,
  failed: results.filter((r) => !r.pass).length,
};

await fs.writeFile(path.join(OUT, "report.json"), JSON.stringify({ summary, results }, null, 2) + "\n");
console.log(`POSTDEPLOY_DARK_FINAL_QA ${JSON.stringify(summary)}`);
for (const result of results) console.log(JSON.stringify(result));
if (summary.failed > 0) process.exitCode = 1;
