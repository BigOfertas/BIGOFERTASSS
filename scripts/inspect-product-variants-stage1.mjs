import { chromium } from "playwright";

const BASE = "https://bigofertas.net";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

async function collectProductUrls(url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  return page
    .locator('a[href^="/product/"]')
    .evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute("href")).filter(Boolean))])
    .then((hrefs) => hrefs.map((href) => new URL(href, BASE).href));
}

const urls = [
  ...(await collectProductUrls(`${BASE}/`)),
  ...(await collectProductUrls(`${BASE}/products`)),
].filter((url, index, list) => list.indexOf(url) === index);

const samples = [];
for (const url of urls.slice(0, 40)) {
  const detailPage = await context.newPage();
  try {
    const responsePromise = detailPage.waitForResponse(
      (response) => response.url().includes("/rest/v1/rpc/storefront_product_detail_v2"),
      { timeout: 20000 },
    );
    await detailPage.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    const response = await responsePromise;
    const payload = await response.json();
    if (!payload?.product || !Array.isArray(payload.variants)) continue;

    const images = Array.isArray(payload.images) ? payload.images : [];
    const variants = payload.variants.map((variant, index) => ({
      index,
      id: variant.id,
      name: variant.name,
      is_default: variant.is_default,
      sort_order: variant.sort_order,
      optionValueIds: variant.optionValueIds ?? {},
      imageCount: images.filter((image) => image.variant_id === variant.id).length,
      primaryImageCount: images.filter(
        (image) => image.variant_id === variant.id && image.is_primary === true,
      ).length,
    }));
    const options = (payload.options ?? []).map((option) => ({
      id: option.id,
      name: option.name,
      kind: option.kind,
      is_required: option.is_required,
      values: (option.values ?? []).map((value) => ({ id: value.id, value: value.value })),
    }));
    const defaultIndex = variants.findIndex((variant) => variant.is_default === true);

    samples.push({
      url,
      product: payload.product.name,
      slug: payload.product.slug,
      options,
      variants,
      defaultIndex,
      productLevelImages: images.filter((image) => image.variant_id == null).length,
    });

    const haveOne = samples.some((sample) => sample.variants.length === 1);
    const haveTwo = samples.some((sample) => sample.variants.length === 2);
    const haveMany = samples.some((sample) => sample.variants.length >= 3);
    const haveDefaultNotFirst = samples.some((sample) => sample.defaultIndex > 0);
    if (haveOne && haveTwo && haveMany && haveDefaultNotFirst) break;
  } catch (error) {
    console.log(`SKIP ${url}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await detailPage.close();
  }
}

console.log(`VARIANT_INSPECTION_COUNT=${samples.length}`);
for (const sample of samples) {
  console.log(`VARIANT_SAMPLE ${JSON.stringify(sample)}`);
}

const summary = {
  one: samples.filter((sample) => sample.variants.length === 1).map((sample) => sample.url),
  two: samples.filter((sample) => sample.variants.length === 2).map((sample) => sample.url),
  many: samples.filter((sample) => sample.variants.length >= 3).map((sample) => sample.url),
  defaultNotFirst: samples.filter((sample) => sample.defaultIndex > 0).map((sample) => sample.url),
};
console.log(`VARIANT_INSPECTION_SUMMARY ${JSON.stringify(summary)}`);

await browser.close();
