import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4173";
const CASES = {
  one: "manchester-city-camisa-ii-26-27-puma-p000003",
  two: "chelsea-camisa-i-26-27-nike-p000001",
  many: "flamengo-camisa-i-25-26-adidas-p001217",
};

function readEnvFile() {
  const values = {};
  for (const rawLine of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    values[line.slice(0, index)] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = readEnvFile();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("Public Supabase configuration unavailable");

async function fetchDetail(identifier) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/storefront_product_detail_v2`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_identifier: identifier }),
  });
  if (!response.ok) throw new Error(`detail RPC ${response.status}`);
  return response.json();
}

function sortVariantImages(images, variantId) {
  return images
    .filter((image) => image.status === "ready" && image.variant_id === variantId)
    .slice()
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return String(left.created_at).localeCompare(String(right.created_at));
    });
}

function expectedImageId(detail, variant) {
  return sortVariantImages(detail.images ?? [], variant.id)[0]?.id ?? null;
}

function variantLabel(detail, variant, index) {
  const labels = (detail.options ?? []).flatMap((option) => {
    const valueId = variant.optionValueIds?.[option.id];
    const value = (option.values ?? []).find((candidate) => candidate.id === valueId);
    return value ? [value.value] : [];
  });
  return labels.join(" — ") || variant.name?.trim() || `Variação ${index + 1}`;
}

function effectivePrice(detail, variant) {
  const product = detail.product;
  const base = variant.price_override ?? product.price;
  const candidate =
    variant.promotional_price_override ??
    (variant.price_override == null ? product.promotional_price : null);
  return candidate != null && candidate >= 0 && candidate < base ? candidate : base;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const failures = [];
let passed = 0;
function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS - ${name}${detail ? ` :: ${detail}` : ""}`);
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ""}`);
    console.error(`FAIL - ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

async function dismissCookies(page) {
  const button = page.getByRole("button", { name: /aceitar|entendi|continuar/i }).first();
  if (await button.count()) await button.click({ timeout: 1000 }).catch(() => {});
}

async function currentSelectedId(page) {
  const selected = page.locator('[data-variant-preview][aria-pressed="true"]');
  return (await selected.count()) === 1 ? selected.getAttribute("data-variant-preview") : null;
}

async function displayedBasePrice(page) {
  return page.locator("#product-title").locator("xpath=following::div[contains(@class,'text-red-600')][1]").innerText();
}

async function validateMulti(browser, slug, expectedCount, viewport, label) {
  const detail = await fetchDetail(slug);
  const variants = detail.variants ?? [];
  check(`${label}: backend possui ${expectedCount} variantes`, variants.length === expectedCount, `count=${variants.length}`);
  const defaultVariant = variants.find((variant) => variant.is_default) ?? variants[0];
  check(`${label}: backend possui variante padrão`, Boolean(defaultVariant));

  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto(`${BASE}/product/${slug}`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissCookies(page);
  check(`${label}: rota direta responde`, response?.ok() === true, `HTTP ${response?.status()}`);

  const selector = page.locator("[data-variant-selector]");
  check(`${label}: seletor visual aparece`, (await selector.count()) === 1);
  const previews = page.locator("[data-variant-preview]");
  check(`${label}: todos os previews aparecem antes do clique`, (await previews.count()) === expectedCount);

  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    const labelText = variantLabel(detail, variant, index);
    const preview = page.locator(`[data-variant-preview="${variant.id}"]`);
    const text = page.locator(`[data-variant-label="${variant.id}"]`);
    const image = page.locator(`[data-variant-preview-image="${variant.id}"]`);
    const expectedId = expectedImageId(detail, variant);
    check(`${label}: preview ${labelText} é button`, (await preview.evaluate((node) => node.tagName)) === "BUTTON");
    check(`${label}: texto ${labelText} não é botão`, (await text.evaluate((node) => node.tagName)) === "P");
    check(`${label}: texto ${labelText} não entra no tab`, (await text.evaluate((node) => node.tabIndex)) === -1);
    check(`${label}: preview ${labelText} tem aria-label`, (await preview.getAttribute("aria-label")) === `Selecionar variação ${labelText}`);
    check(`${label}: preview ${labelText} usa imagem correta`, (await preview.getAttribute("data-variant-preview-image-id")) === expectedId, `expected=${expectedId}`);
    check(`${label}: imagem ${labelText} está visível`, (await image.count()) === 1 && (await image.evaluate((node) => node.complete && node.naturalWidth > 0)));
  }

  const selectedAtOpen = await currentSelectedId(page);
  check(`${label}: padrão real abre selecionado`, selectedAtOpen === defaultVariant.id, `selected=${selectedAtOpen}; expected=${defaultVariant.id}`);
  const defaultButton = page.locator(`[data-variant-preview="${defaultVariant.id}"]`);
  check(`${label}: selecionada tem destaque vermelho`, (await defaultButton.getAttribute("class"))?.includes("border-red-600") === true);
  const activeAtOpen = await page.locator("[data-active-image-id]").getAttribute("data-active-image-id");
  check(`${label}: imagem principal abre na variante padrão`, activeAtOpen === expectedImageId(detail, defaultVariant), `active=${activeAtOpen}`);
  const expectedOpenPrice = currency.format(effectivePrice(detail, defaultVariant));
  check(`${label}: preço da variante padrão preservado`, (await displayedBasePrice(page)).includes(expectedOpenPrice), expectedOpenPrice);

  const target = variants.find((variant) => variant.id !== defaultVariant.id);
  if (target) {
    const beforeLabelClick = await currentSelectedId(page);
    await page.locator(`[data-variant-label="${target.id}"]`).click();
    check(`${label}: clicar no texto não seleciona`, (await currentSelectedId(page)) === beforeLabelClick);

    await page.locator(`[data-variant-preview="${target.id}"]`).click();
    await page.waitForFunction(
      (variantId) => document.querySelector(`[data-variant-preview="${variantId}"]`)?.getAttribute("aria-pressed") === "true",
      target.id,
    );
    check(`${label}: clicar no preview seleciona`, (await currentSelectedId(page)) === target.id);
    const targetActive = await page.locator("[data-active-image-id]").getAttribute("data-active-image-id");
    check(`${label}: imagem principal troca com a variante`, targetActive === expectedImageId(detail, target), `active=${targetActive}`);
    const expectedTargetPrice = currency.format(effectivePrice(detail, target));
    check(`${label}: preço/regra da variante continua sincronizado`, (await displayedBasePrice(page)).includes(expectedTargetPrice), expectedTargetPrice);

    await defaultButton.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (variantId) => document.querySelector(`[data-variant-preview="${variantId}"]`)?.getAttribute("aria-pressed") === "true",
      defaultVariant.id,
    );
    check(`${label}: teclado Enter seleciona preview`, (await currentSelectedId(page)) === defaultVariant.id);
    check(`${label}: foco de teclado é visível por classe`, (await defaultButton.getAttribute("class"))?.includes("focus-visible:ring-2") === true);
  }

  const widthState = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    selectorScrollWidth: document.querySelector("[data-variant-selector] > div")?.scrollWidth ?? 0,
    selectorClientWidth: document.querySelector("[data-variant-selector] > div")?.clientWidth ?? 0,
    scrollbarWidth: getComputedStyle(document.querySelector("[data-variant-selector] > div")).scrollbarWidth,
  }));
  check(`${label}: sem scroll horizontal da página`, widthState.documentWidth <= widthState.viewportWidth + 1, JSON.stringify(widthState));
  if (viewport.width <= 390) {
    const box = await previews.first().boundingBox();
    check(`${label}: preview mobile mantém toque confortável`, Boolean(box && box.width >= 96 && box.height >= 96), box ? JSON.stringify(box) : "sem box");
    check(`${label}: scrollbar visual está oculto`, widthState.scrollbarWidth === "none", JSON.stringify(widthState));
  }
  check(`${label}: sem erro de console da UI`, consoleErrors.filter((text) => !/supabase|cors|favicon/i.test(text)).length === 0, consoleErrors.join(" | "));

  await context.close();
}

async function validateSingle(browser) {
  const detail = await fetchDetail(CASES.one);
  const variant = detail.variants?.[0];
  check("single: backend possui uma variante", detail.variants?.length === 1);
  check("single: variante única é padrão", variant?.is_default === true);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const response = await page.goto(`${BASE}/product/${CASES.one}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissCookies(page);
  check("single: rota direta carrega", response?.ok() === true, `HTTP ${response?.status()}`);
  check("single: não cria controle redundante", (await page.locator("[data-variant-selector]").count()) === 0);
  const active = await page.locator("[data-active-image-id]").getAttribute("data-active-image-id");
  check("single: galeria abre na imagem da variante única", active === expectedImageId(detail, variant), `active=${active}`);
  check("single: compra não pede seleção redundante", !(await page.getByText("Selecione uma opção", { exact: true }).isVisible().catch(() => false)));
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await validateSingle(browser);
  await validateMulti(browser, CASES.two, 2, { width: 1440, height: 1000 }, "desktop-2");
  await validateMulti(browser, CASES.many, 3, { width: 834, height: 1112 }, "tablet-many");
  await validateMulti(browser, CASES.many, 3, { width: 390, height: 844 }, "mobile-many");
} finally {
  await browser.close();
}

console.log(`QA_STAGE1_SUMMARY ${JSON.stringify({ passed, failed: failures.length })}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("QA_STAGE1_VARIANT_PREVIEWS_OK");
