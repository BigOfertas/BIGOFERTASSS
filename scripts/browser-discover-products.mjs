import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = "https://bigofertas.net";
const OUTPUT = path.join(process.cwd(), "browser-audit-discovery");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await fs.mkdir(OUTPUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "dark",
  reducedMotion: "reduce",
  locale: "pt-BR",
});
await context.addInitScript(() => {
  localStorage.setItem("dropbox-theme", "dark");
  localStorage.setItem("dropbox-locale", "pt");
});

const page = await context.newPage();
const links = new Set();
let lastFirst = null;

for (let attempt = 1; attempt <= 5; attempt += 1) {
  await page.goto(`${BASE_URL}/products?pageSize=48`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForSelector("body", { timeout: 20_000 });
  await page.evaluate(() => {
    document.querySelector("[data-initial-boot-splash]")?.remove();
    document.documentElement.classList.add("dark");
    document.body.style.overflow = "auto";
  });
  await page
    .locator('a[href*="/product/"]')
    .first()
    .waitFor({ state: "attached", timeout: 25_000 })
    .catch(() => {});
  const count = await page.locator('a[href*="/product/"]').count();
  if (count > 0) break;
  const errorText = (await page.locator("body").innerText()).slice(0, 500);
  console.log(`PRODUCT_DISCOVERY_RETRY attempt=${attempt} body=${JSON.stringify(errorText)}`);
  await sleep(1500 * attempt);
}

if ((await page.locator('a[href*="/product/"]').count()) === 0) {
  throw new Error("Catalog did not become available after 5 browser retries");
}

for (let current = 1; current <= 100; current += 1) {
  await page
    .locator('a[href*="/product/"]')
    .first()
    .waitFor({ state: "attached", timeout: 25_000 });
  await sleep(350);

  const found = await page.locator('a[href*="/product/"]').evaluateAll((anchors) =>
    anchors.flatMap((anchor) => {
      const href = anchor.href || anchor.getAttribute("href");
      if (!href || !href.includes("/product/")) return [];
      try {
        return [new URL(href, window.location.origin).pathname];
      } catch {
        return [];
      }
    }),
  );
  for (const href of found) links.add(href.split("?")[0]);
  console.log(`PRODUCT_DISCOVERY_PAGE page=${current} page_links=${found.length} unique=${links.size}`);

  const next = page.getByRole("button", { name: /Próxima página/i }).first();
  if ((await next.count()) === 0 || (await next.isDisabled())) break;

  const before = found[0] ?? lastFirst;
  await next.click();
  await page
    .waitForFunction(
      (oldHref) => {
        const first = document.querySelector('a[href*="/product/"]');
        const href = first?.getAttribute("href") ?? null;
        return Boolean(href && href !== oldHref);
      },
      before,
      { timeout: 25_000 },
    )
    .catch(() => {});
  lastFirst = before;
  await sleep(450);
}

const productLinks = [...links].sort();
if (productLinks.length < 100) {
  throw new Error(`Catalog discovery unexpectedly found only ${productLinks.length} products`);
}

await fs.writeFile(
  path.join(OUTPUT, "product-links.json"),
  JSON.stringify(productLinks, null, 2) + "\n",
);
await fs.writeFile(
  path.join(OUTPUT, "summary.json"),
  JSON.stringify({ discoveredProducts: productLinks.length }, null, 2) + "\n",
);
console.log(`PRODUCT_DISCOVERY_OK products=${productLinks.length}`);

await page.close();
await context.close();
await browser.close();
