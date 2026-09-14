import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "https://bigofertas.net";
const FINAL_SHA = "95d358bf7a7806ed47e6335b59aa8a913a937fdf";
const SINGLE = {
  slug: "manchester-city-camisa-ii-26-27-puma-p000003",
  expectedVariants: 1,
  name: "Manchester City",
};
const CHELSEA = {
  slug: "chelsea-camisa-i-26-27-nike-p000001",
  expectedVariants: 2,
  name: "Chelsea",
};
const FLAMENGO = {
  slug: "flamengo-camisa-i-25-26-adidas-p001217",
  expectedVariants: 3,
  name: "Flamengo",
};

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("Configuração pública do Supabase indisponível");

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

async function fetchDetail(slug) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/storefront_product_detail_v2`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_identifier: slug }),
  });
  if (!response.ok) throw new Error(`RPC detalhe respondeu ${response.status}`);
  return response.json();
}

function sortReady(images) {
  return images
    .filter((image) => image.status === "ready")
    .slice()
    .sort((left, right) => {
      const leftProductLevel = left.variant_id == null ? 0 : 1;
      const rightProductLevel = right.variant_id == null ? 0 : 1;
      if (leftProductLevel !== rightProductLevel) return leftProductLevel - rightProductLevel;
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return String(left.created_at).localeCompare(String(right.created_at));
    });
}

function variantImages(detail, variantId) {
  return sortReady(detail.images ?? []).filter((image) => image.variant_id === variantId);
}

function expectedGalleryIds(detail, variantId) {
  const ready = sortReady(detail.images ?? []);
  const own = ready.filter((image) => image.variant_id === variantId);
  const shared = ready.filter((image) => image.variant_id == null);
  if (own.length > 0) return [...own, ...shared].map((image) => image.id);
  if (shared.length > 0) return shared.map((image) => image.id);
  return ready.map((image) => image.id);
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
  const base = variant.price_override ?? detail.product.price;
  const promo =
    variant.promotional_price_override ??
    (variant.price_override == null ? detail.product.promotional_price : null);
  return promo != null && promo >= 0 && promo < base ? promo : base;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function dismissCookies(page) {
  const button = page.getByRole("button", { name: /aceitar|entendi|continuar/i }).first();
  if (await button.count()) await button.click({ timeout: 1200 }).catch(() => {});
}

async function currentSelectedId(page) {
  const selected = page.locator('[data-variant-preview][aria-pressed="true"]');
  return (await selected.count()) === 1 ? selected.getAttribute("data-variant-preview") : null;
}

async function displayedPrice(page) {
  return page.locator("#product-title").locator("xpath=following::div[contains(@class,'text-red-600')][1]").innerText();
}

function watchRuntime(page) {
  const consoleErrors = [];
  const networkErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(`PAGEERROR ${error.message}`));
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.startsWith(BASE) || url.includes("storefront_product_detail_v2") || request.resourceType() === "image") {
      networkErrors.push(`FAILED ${request.resourceType()} ${url} ${request.failure()?.errorText ?? ""}`);
    }
  });
  page.on("response", (response) => {
    const url = response.url();
    if (
      response.status() >= 400 &&
      (url.startsWith(BASE) || url.includes("storefront_product_detail_v2") || response.request().resourceType() === "image")
    ) {
      networkErrors.push(`HTTP ${response.status()} ${response.request().resourceType()} ${url}`);
    }
  });
  return { consoleErrors, networkErrors };
}

async function validateRuntime(page, label, runtime) {
  const relevantConsole = runtime.consoleErrors.filter(
    (text) => !/favicon|ResizeObserver|third-party cookie/i.test(text),
  );
  check(`${label}: sem erro relevante de console/runtime`, relevantConsole.length === 0, relevantConsole.join(" | "));
  check(`${label}: sem falha de network/4xx/5xx relevante`, runtime.networkErrors.length === 0, runtime.networkErrors.join(" | "));
  const brokenImages = await page
    .locator("img")
    .evaluateAll((images) => images.filter((img) => img.complete && img.naturalWidth === 0).length);
  check(`${label}: sem imagem quebrada`, brokenImages === 0, `count=${brokenImages}`);
}

async function focusVariantWithKeyboard(page) {
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        variantId: active?.getAttribute?.("data-variant-preview") ?? null,
        focusVisible: active instanceof HTMLElement ? active.matches(":focus-visible") : false,
        boxShadow: active instanceof HTMLElement ? getComputedStyle(active).boxShadow : "none",
      };
    });
    if (state.variantId) return state;
  }
  return { variantId: null, focusVisible: false, boxShadow: "none" };
}

async function assertGalleryIds(page, expectedIds, label) {
  const buttons = page.locator('section[aria-label^="Galeria de"] button[aria-label^="Ver imagem de"]');
  const count = await buttons.count();
  check(`${label}: quantidade de imagens da galeria correta`, count === expectedIds.length, `dom=${count} expected=${expectedIds.length}`);

  const observed = [];
  for (let index = 0; index < count; index += 1) {
    await buttons.nth(index).evaluate((node) => node.click());
    await page.waitForTimeout(25);
    observed.push(await page.locator("[data-active-image-id]").getAttribute("data-active-image-id"));
  }
  check(
    `${label}: galeria contém somente imagens esperadas da variante/compartilhadas`,
    observed.length === expectedIds.length && observed.every((id) => expectedIds.includes(id)),
    `observed=${JSON.stringify(observed)} expected=${JSON.stringify(expectedIds)}`,
  );
  check(
    `${label}: galeria não contém IDs duplicados/misturados`,
    new Set(observed).size === observed.length,
    JSON.stringify(observed),
  );
}

async function runSingle(browser) {
  const detail = await fetchDetail(SINGLE.slug);
  const variants = detail.variants ?? [];
  const variant = variants[0];
  const label = `${SINGLE.name} single desktop-1440`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const runtime = watchRuntime(page);
  const response = await page.goto(`${BASE}/product/${SINGLE.slug}`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissCookies(page);

  check(`${label}: rota abre`, response?.ok() === true, `HTTP ${response?.status()}`);
  check(`${label}: exatamente uma variante`, variants.length === SINGLE.expectedVariants, `count=${variants.length}`);
  check(`${label}: variante única é is_default`, variant?.is_default === true);
  check(`${label}: sem controle redundante`, (await page.locator("[data-variant-selector]").count()) === 0);
  const expectedPrimary = variantImages(detail, variant.id)[0]?.id ?? null;
  check(
    `${label}: galeria inicia na imagem da variante`,
    (await page.locator("[data-active-image-id]").getAttribute("data-active-image-id")) === expectedPrimary,
    `expected=${expectedPrimary}`,
  );
  check(`${label}: preço correto`, (await displayedPrice(page)).includes(currency.format(effectivePrice(detail, variant))));
  check(
    `${label}: não exibe pedido redundante de seleção`,
    !(await page.getByText("Selecione uma opção", { exact: true }).isVisible().catch(() => false)),
  );
  await assertGalleryIds(page, expectedGalleryIds(detail, variant.id), label);
  const geometry = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, viewport: innerWidth }));
  check(`${label}: sem overflow horizontal`, geometry.doc <= geometry.viewport + 1, JSON.stringify(geometry));
  await validateRuntime(page, label, runtime);
  await context.close();
}

async function runMulti(browser, testCase, viewport, suffix) {
  const detail = await fetchDetail(testCase.slug);
  const variants = detail.variants ?? [];
  const realDefaultIndex = variants.findIndex((variant) => variant.is_default);
  const defaultVariant = variants[realDefaultIndex] ?? variants[0];
  const label = `${testCase.name} ${suffix}`;
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width <= 390,
    hasTouch: viewport.width <= 390,
  });
  const page = await context.newPage();
  const runtime = watchRuntime(page);
  const response = await page.goto(`${BASE}/product/${testCase.slug}`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissCookies(page);

  check(`${label}: rota/hard refresh abre`, response?.ok() === true, `HTTP ${response?.status()}`);
  check(`${label}: quantidade de variantes correta`, variants.length === testCase.expectedVariants, `count=${variants.length}`);
  check(`${label}: existe is_default real`, realDefaultIndex >= 0, `defaultIndex=${realDefaultIndex}`);
  console.log(`INFO - ${label}: índice real de is_default = ${realDefaultIndex}`);
  check(`${label}: seletor visual aparece`, (await page.locator("[data-variant-selector]").count()) === 1);
  check(`${label}: todos os previews aparecem antes do clique`, (await page.locator("[data-variant-preview]").count()) === variants.length);

  const previewImageIds = [];
  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    const text = variantLabel(detail, variant, index);
    const preview = page.locator(`[data-variant-preview="${variant.id}"]`);
    const title = page.locator(`[data-variant-label="${variant.id}"]`);
    const expectedPreviewId = variantImages(detail, variant.id)[0]?.id ?? null;
    previewImageIds.push(expectedPreviewId);

    check(
      `${label}: título ${text} é texto e não entra no Tab`,
      (await title.evaluate((node) => node.tagName)) === "P" && (await title.evaluate((node) => node.tabIndex)) === -1,
    );
    check(`${label}: preview ${text} é button`, (await preview.evaluate((node) => node.tagName)) === "BUTTON");
    check(
      `${label}: aria-label de ${text} correto`,
      (await preview.getAttribute("aria-label")) === `Selecionar variação ${text}`,
    );
    check(
      `${label}: preview ${text} usa imagem primária/própria correta`,
      (await preview.getAttribute("data-variant-preview-image-id")) === expectedPreviewId,
      `expected=${expectedPreviewId}`,
    );
    const image = page.locator(`[data-variant-preview-image="${variant.id}"]`);
    check(
      `${label}: imagem do preview ${text} carregou`,
      (await image.count()) === 1 && (await image.evaluate((node) => node.complete && node.naturalWidth > 0)),
    );
  }
  check(
    `${label}: previews usam imagens distintas por variante`,
    previewImageIds.filter(Boolean).length === new Set(previewImageIds.filter(Boolean)).size,
    JSON.stringify(previewImageIds),
  );

  check(`${label}: default já abre selecionado`, (await currentSelectedId(page)) === defaultVariant.id, `expected=${defaultVariant.id}`);
  const defaultPreview = page.locator(`[data-variant-preview="${defaultVariant.id}"]`);
  check(`${label}: default aria-pressed=true`, (await defaultPreview.getAttribute("aria-pressed")) === "true");
  check(
    `${label}: default tem destaque vermelho`,
    (await defaultPreview.getAttribute("class"))?.includes("border-red-600") === true,
  );
  const expectedDefaultPrimary = variantImages(detail, defaultVariant.id)[0]?.id ?? null;
  check(
    `${label}: imagem principal inicial corresponde ao default`,
    (await page.locator("[data-active-image-id]").getAttribute("data-active-image-id")) === expectedDefaultPrimary,
    `expected=${expectedDefaultPrimary}`,
  );
  check(`${label}: preço inicial corresponde ao default`, (await displayedPrice(page)).includes(currency.format(effectivePrice(detail, defaultVariant))));

  const other = variants.find((variant) => variant.id !== defaultVariant.id);
  const beforeTitle = await currentSelectedId(page);
  await page.locator(`[data-variant-label="${other.id}"]`).click();
  check(`${label}: clicar no título não seleciona`, (await currentSelectedId(page)) === beforeTitle);

  for (const variant of variants) {
    const preview = page.locator(`[data-variant-preview="${variant.id}"]`);
    await preview.click();
    await page.waitForFunction(
      (id) => document.querySelector(`[data-variant-preview="${id}"]`)?.getAttribute("aria-pressed") === "true",
      variant.id,
    );
    check(`${label}: preview seleciona ${variant.id}`, (await currentSelectedId(page)) === variant.id);
    check(`${label}: aria-pressed acompanha ${variant.id}`, (await preview.getAttribute("aria-pressed")) === "true");
    const expectedPrimary = variantImages(detail, variant.id)[0]?.id ?? null;
    check(
      `${label}: imagem principal acompanha ${variant.id}`,
      (await page.locator("[data-active-image-id]").getAttribute("data-active-image-id")) === expectedPrimary,
      `expected=${expectedPrimary}`,
    );
    check(`${label}: preço acompanha ${variant.id}`, (await displayedPrice(page)).includes(currency.format(effectivePrice(detail, variant))));
    await assertGalleryIds(page, expectedGalleryIds(detail, variant.id), `${label} ${variant.id}`);
  }

  const focusState = await focusVariantWithKeyboard(page);
  check(`${label}: Tab alcança preview`, Boolean(focusState.variantId), JSON.stringify(focusState));
  check(
    `${label}: foco de teclado é visível`,
    focusState.focusVisible && focusState.boxShadow !== "none",
    JSON.stringify(focusState),
  );
  if (focusState.variantId) {
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (id) => document.querySelector(`[data-variant-preview="${id}"]`)?.getAttribute("aria-pressed") === "true",
      focusState.variantId,
    );
    check(`${label}: Enter seleciona preview focado`, (await currentSelectedId(page)) === focusState.variantId);
  }

  const geometry = await page.evaluate(() => {
    const rail = document.querySelector("[data-variant-selector] > div");
    return {
      doc: document.documentElement.scrollWidth,
      viewport: innerWidth,
      scrollbarWidth: rail ? getComputedStyle(rail).scrollbarWidth : null,
    };
  });
  check(`${label}: sem overflow horizontal da página`, geometry.doc <= geometry.viewport + 1, JSON.stringify(geometry));
  if (viewport.width <= 390) {
    const box = await page.locator("[data-variant-preview]").first().boundingBox();
    check(
      `${label}: preview mobile mantém alvo confortável`,
      Boolean(box && box.width >= 96 && box.height >= 96),
      box ? JSON.stringify(box) : "sem box",
    );
    check(`${label}: scrollbar visual oculta`, geometry.scrollbarWidth === "none", JSON.stringify(geometry));
  }

  await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  check(`${label}: refresh reinicializa default real`, (await currentSelectedId(page)) === defaultVariant.id, `expected=${defaultVariant.id}`);
  check(
    `${label}: galeria após refresh volta ao default`,
    (await page.locator("[data-active-image-id]").getAttribute("data-active-image-id")) === expectedDefaultPrimary,
    `expected=${expectedDefaultPrimary}`,
  );

  await validateRuntime(page, label, runtime);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runSingle(browser);
  await runMulti(browser, CHELSEA, { width: 1440, height: 1000 }, "desktop-1440");
  await runMulti(browser, FLAMENGO, { width: 1440, height: 1000 }, "desktop-1440");
  await runMulti(browser, FLAMENGO, { width: 834, height: 1112 }, "tablet-834");
  await runMulti(browser, CHELSEA, { width: 390, height: 844 }, "mobile-390");
  await runMulti(browser, FLAMENGO, { width: 390, height: 844 }, "mobile-390");
} finally {
  await browser.close();
}

console.log(`QA_STAGE1_PRODUCTION_FINAL_SUMMARY ${JSON.stringify({ sha: FINAL_SHA, passed, failed: failures.length })}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("QA_STAGE1_PRODUCTION_FINAL_OK");
