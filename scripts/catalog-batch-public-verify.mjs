import fs from "node:fs";
import { chromium } from "playwright";

function parseArgs(argv) {
  const out = {
    verification: ".artifacts/catalog-batch/verification.json",
    baseUrl: "https://bigofertas.net",
    launchCount: 10,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--verification") out.verification = argv[++index];
    else if (arg === "--base-url") out.baseUrl = argv[++index];
    else if (arg === "--launch-count") out.launchCount = Number.parseInt(argv[++index], 10);
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!Number.isInteger(out.launchCount) || out.launchCount < 0 || out.launchCount > 100) {
    throw new Error("Contagem de lançamentos inválida.");
  }
  return out;
}

const options = parseArgs(process.argv.slice(2));
const verification = JSON.parse(fs.readFileSync(options.verification, "utf8"));
const samples = Array.isArray(verification.samples) ? verification.samples : [];
if (samples.length === 0) throw new Error("Verificação não contém produtos de amostra.");

const base = new URL(options.baseUrl);
if (base.protocol !== "https:") throw new Error("A URL pública precisa usar HTTPS.");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(45_000);
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  const homeResponse = await page.goto(base.href, { waitUntil: "commit", timeout: 45_000 });
  if (!homeResponse?.ok()) throw new Error(`Homepage HTTP ${homeResponse?.status()}`);
  await page.locator("#lancamentos").waitFor({ state: "visible" });

  if (options.launchCount > 0) {
    await page.waitForFunction((expected) => {
      const links = [...document.querySelectorAll('#lancamentos a[href*="/product/"]')];
      return (
        new Set(links.map((node) => node.getAttribute("href")).filter(Boolean)).size >= expected
      );
    }, options.launchCount);
    const launchLinks = await page
      .locator('#lancamentos a[href*="/product/"]')
      .evaluateAll((nodes) => [
        ...new Set(nodes.map((node) => node.getAttribute("href")).filter(Boolean)),
      ]);
    if (launchLinks.length !== options.launchCount) {
      throw new Error(
        `Lançamentos: esperado ${options.launchCount}, recebido ${launchLinks.length}`,
      );
    }
    console.log(`CATALOG_BATCH_PUBLIC_LAUNCHES_OK count=${launchLinks.length}`);
  }

  const verifiedCategories = new Set();
  for (const sample of samples) {
    if (!sample?.slug || !sample?.name) throw new Error("Amostra pública incompleta.");
    const detailUrl = new URL(`/product/${encodeURIComponent(sample.slug)}`, base).href;
    const response = await page.goto(detailUrl, { waitUntil: "commit", timeout: 45_000 });
    if (!response?.ok())
      throw new Error(`${sample.catalog_code ?? sample.slug}: HTTP ${response?.status()}`);
    await page.locator("main").waitFor({ state: "visible" });
    await page.waitForFunction(
      (expectedName) => document.querySelector("main")?.innerText.includes(expectedName),
      sample.name,
    );
    await page.waitForFunction(() => {
      const main = document.querySelector("main");
      if (!main?.innerText.includes("R$")) return false;
      return [...document.images].some((image) => {
        const source = image.currentSrc || image.src;
        return /googleusercontent\.com/.test(source) && image.complete && image.naturalWidth > 0;
      });
    });
    console.log(`CATALOG_BATCH_PUBLIC_DETAIL_OK code=${sample.catalog_code} slug=${sample.slug}`);

    if (sample.category_slug && !verifiedCategories.has(sample.category_slug)) {
      verifiedCategories.add(sample.category_slug);
      const categoryUrl = new URL(
        `/products?category=${encodeURIComponent(sample.category_slug)}`,
        base,
      ).href;
      const categoryResponse = await page.goto(categoryUrl, {
        waitUntil: "commit",
        timeout: 45_000,
      });
      if (!categoryResponse?.ok()) {
        throw new Error(`Categoria ${sample.category_slug}: HTTP ${categoryResponse?.status()}`);
      }
      await page
        .getByRole("heading", { name: "Produtos", exact: true })
        .waitFor({ state: "visible" });
      await page.locator('main a[href*="/product/"]').first().waitFor({ state: "visible" });
      console.log(`CATALOG_BATCH_PUBLIC_CATEGORY_OK category=${sample.category_slug}`);
    }
  }

  if (pageErrors.length > 0) {
    throw new Error(`Erros de página detectados: ${pageErrors.join(" | ").slice(0, 1500)}`);
  }

  console.log(
    `CATALOG_BATCH_PUBLIC_OK samples=${samples.length} categories=${verifiedCategories.size}`,
  );
} finally {
  await browser.close();
}
