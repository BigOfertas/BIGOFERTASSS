import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "https://bigofertas.net";
const OUT = "qa-runtime-diagnostic";
fs.mkdirSync(OUT, { recursive: true });

const report = { startedAt: new Date().toISOString(), attempts: [], launchHeading: null, reducedMotion: null };
const browser = await chromium.launch({ headless: true });

function canonical(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLocaleUpperCase("pt-BR");
}

try {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: "pt-BR" });
    const page = await context.newPage();
    const entry = { attempt, responseStatus: null, rpc: [], consoleErrors: [], requestFailures: [] };

    page.on("response", async (response) => {
      if (!response.url().includes("/rest/v1/rpc/")) return;
      const request = response.request();
      let headers = {};
      try { headers = await response.allHeaders(); } catch {}
      entry.rpc.push({
        url: response.url(),
        method: request.method(),
        status: response.status(),
        allowOrigin: headers["access-control-allow-origin"] ?? null,
        contentType: headers["content-type"] ?? null,
        postData: request.postData() ?? null,
      });
    });

    page.on("requestfailed", (request) => {
      if (!request.url().includes("supabase.co")) return;
      entry.requestFailures.push({ url: request.url(), method: request.method(), failure: request.failure()?.errorText ?? null });
    });

    page.on("console", (message) => {
      if (message.type() === "error") entry.consoleErrors.push(message.text());
    });

    const response = await page.goto(`${BASE}/?qa=rpc-diagnostic-${Date.now()}-${attempt}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    entry.responseStatus = response?.status() ?? null;

    if (attempt === 1) {
      const roots = page.locator("[data-slide-up-reveal]");
      await roots.first().waitFor({ state: "attached", timeout: 10000 });
      const count = await roots.count();
      for (let i = 0; i < count; i += 1) {
        const root = roots.nth(i);
        const sr = canonical(await root.locator(".sr-only").first().textContent().catch(() => ""));
        if (sr !== "LANÇAMENTOS") continue;
        const immediate = await root.evaluate((node) => {
          const chars = [...node.querySelectorAll("[data-slide-character] > span")];
          return chars.map((el) => {
            const style = getComputedStyle(el);
            return { char: el.textContent, opacity: style.opacity, transform: style.transform, transitionProperty: style.transitionProperty, transitionDelay: style.transitionDelay };
          });
        });
        await page.waitForTimeout(120);
        const early = await root.evaluate((node) => {
          const chars = [...node.querySelectorAll("[data-slide-character] > span")];
          return chars.map((el) => {
            const style = getComputedStyle(el);
            return { char: el.textContent, opacity: style.opacity, transform: style.transform, transitionProperty: style.transitionProperty, transitionDelay: style.transitionDelay };
          });
        });
        report.launchHeading = {
          immediate,
          early,
          distinctImmediateDelays: new Set(immediate.map((row) => row.transitionDelay)).size,
          distinctEarlyDelays: new Set(early.map((row) => row.transitionDelay)).size,
        };
        break;
      }
    }

    await page.waitForTimeout(7000);
    await page.screenshot({ path: `${OUT}/attempt-${attempt}.png`, fullPage: true });
    report.attempts.push(entry);
    await context.close();
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR", reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`${BASE}/?qa=reduced-diagnostic-${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const roots = reducedPage.locator("[data-slide-up-reveal]");
  await roots.first().waitFor({ state: "attached", timeout: 10000 });
  const count = await roots.count();
  for (let i = 0; i < count; i += 1) {
    const root = roots.nth(i);
    const sr = canonical(await root.locator(".sr-only").first().textContent().catch(() => ""));
    if (sr !== "LANÇAMENTOS") continue;
    await reducedPage.waitForTimeout(100);
    report.reducedMotion = await root.evaluate((node) => [...node.querySelectorAll("[data-slide-character] > span")].map((el) => {
      const style = getComputedStyle(el);
      return { char: el.textContent, opacity: style.opacity, transform: style.transform, transitionProperty: style.transitionProperty, transitionDuration: style.transitionDuration, transitionDelay: style.transitionDelay };
    }));
    break;
  }
  await reducedContext.close();
} finally {
  await browser.close();
}

report.finishedAt = new Date().toISOString();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log("PRODUCTION_RUNTIME_DIAGNOSTIC");
console.log(JSON.stringify(report, null, 2));

const catalogEvents = report.attempts.flatMap((attempt) => attempt.rpc.filter((item) => item.url.includes("catalog_products_page_v3")));
const catalogFailures = report.attempts.flatMap((attempt) => attempt.requestFailures.filter((item) => item.url.includes("catalog_products_page_v3")));
const hasSuccessfulCatalog = catalogEvents.some((item) => item.status >= 200 && item.status < 300 && item.allowOrigin);
const launchAnimated = report.launchHeading && report.launchHeading.distinctImmediateDelays > 1 && report.launchHeading.immediate.some((row) => row.transitionProperty.includes("transform") && row.transitionProperty.includes("opacity"));
const reducedClean = Array.isArray(report.reducedMotion) && report.reducedMotion.length > 0 && report.reducedMotion.every((row) => Number(row.opacity) >= 0.99 && (row.transform === "none" || row.transform === "matrix(1, 0, 0, 1, 0, 0)") && row.transitionProperty === "none");

if (!hasSuccessfulCatalog || catalogFailures.length > 0 || !launchAnimated || !reducedClean) {
  console.error(JSON.stringify({ hasSuccessfulCatalog, catalogFailures, launchAnimated, reducedClean }, null, 2));
  process.exit(1);
}
