import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "https://bigofertas.net";
const FINAL_SHA = "8615db775e3ba8bc79cca3fe58dd9fd5a966a8b4";
const SINGLE = {
  slug: "manchester-city-camisa-ii-26-27-puma-p000003",
  expectedVariants: 1,
  name: "Manchester City 1 variante",
};
const CASES = [
  { slug: "chelsea-camisa-i-26-27-nike-p000001", expectedVariants: 2, name: "Chelsea 2 variantes" },
  { slug: "flamengo-camisa-i-25-26-adidas-p001217", expectedVariants: 3, name: "Flamengo 3 variantes" },
];

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

function sortedVariantImages(detail, variantId) {
  return (detail.images ?? [])
    .filter((image) => image.status === "ready" && image.variant_id === variantId)
    .slice()
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return String(left.created_at).localeCompare(String(right.created_at));
    });
}

function expectedGalleryImages(detail, variantId) {
  const variantImages = sortedVariantImages(detail, variantId);
  const shared = (detail.images ?? [])
    .filter((image) => image.status === "ready" && image.variant_id == null)
    .slice()
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return String(left.created_at).localeCompare(String(right.created_at));
    });
  return [...variantImages, ...shared];
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
  if (await button.count()) await button.click({ timeout: 1000 }).catch(() => {});
}

async function selectedId(page) {
  const selected = page.locator('[data-variant-preview][aria-pressed="true"]');
  return (await selected.count()) === 1 ? selected.getAttribute("data-variant-preview") : null;
}

async function shownPrice(page) {
  return page.locator("#product-title").locator("xpath=following::div[contains(@class,'text-red-600')][1]").innerText();
}

function watchRuntime(page) {
  const consoleErrors = [];
  const relevantNetwork = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(BASE) || request.url().includes("storefront_product_detail_v2")) {
      relevantNetwork.push(`FAILED ${request.url()} ${request.failure()?.errorText ?? ""}`);
    }
  });
  page.on("response", (response) => {
    if (
      (response.url().startsWith(BASE) || response.url().includes("storefront_product_detail_v2")) &&
      response.status() >= 400
    ) {
      relevantNetwork.push(`HTTP ${response.status()} ${response.url()}`);
    }
  });
  return { consoleErrors, relevantNetwork };
}

async function checkRuntime(page, label, runtime) {
  const relevantConsole = runtime.consoleErrors.filter(
    (text) => !/favicon|ResizeObserver|third-party cookie/i.test(text),
  );
  check(`${label}: sem erro relevante de console`, relevantConsole.length === 0, relevantConsole.join(" | "));
  check(`${label}: sem 4xx/5xx/falha de rede relevante`, runtime.relevantNetwork.length === 0, runtime.relevantNetwork.join(" | "));
  const broken = await page
    .locator("img")
    .evaluateAll((images) => images.filter((img) => img.complete && img.naturalWidth === 0).length);
  check(`${label}: sem imagem quebrada visível`, broken === 0, `count=${broken}`);
}

async function runSingle(browser) {
  const detail = await fetchDetail(SINGLE.slug);
  const variants = detail.variants ?? [];
  const variant = variants[0];
  const label = `${SINGLE.name} desktop-1440`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const runtime = watchRuntime(page);
  const response = await page.goto(`${BASE}/product/${SINGLE.slug}`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissCookies(page);

  check(`${label}: rota direta carrega`, response?.ok() === true, `HTTP ${response?.status()}`);
  check(`${label}: possui uma única variante`, variants.length === SINGLE.expectedVariants, `count=${variants.length}`);
  check(`${label}: variante única é default real`, variant?.is_default === true);
  check(`${label}: não cria seletor redundante`, (await page.locator("[data-variant-selector]").count()) === 0);
  const expectedImage = sortedVariantImages(detail, variant.id)[0]?.id ?? null;
  check(
    `${label}: galeria abre na imagem da variante única`,
    (await page.locator("[data-active-image-id]").getAttribute("data-active-image-id")) === expectedImage,
    `expected=${expectedImage}`,
  );
  check(
    `${label}: preço da variante única preservado`,
    (await shownPrice(page)).includes(currency.format(effectivePrice(detail, variant))),
  );
  check(
    `${label}: não pede seleção redundante`,
    !(await page.getByText("Selecione uma opção", { exact: true }).isVisible().catch(() => false)),
  );
  await checkRuntime(page, label, runtime);
  await context.close();
}

async function runCase(browser, testCase, viewport, suffix) {
  const detail = await fetchDetail(testCase.slug);
  const variants = detail.variants ?? [];
  const realDefaultIndex = variants.findIndex((variant) => variant.is_default);
  const defaultVariant = variants[realDefaultIndex] ?? variants[0];
  const url = `${BASE}/product/${testCase.slug}`;
  const label = `${testCase.name} ${suffix}`;
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width <= 390,
    hasTouch: viewport.width <= 390,
  });
  const page = await context.newPage();
  const runtime = watchRuntime(page);

  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissCookies(page);

  check(`${label}: hard refresh carrega`, response?.ok() === true, `HTTP ${response?.status()}`);
  check(`${label}: quantidade real de variantes`, variants.length === testCase.expectedVariants, `count=${variants.length}`);
  check(`${label}: produto tem default real`, realDefaultIndex >= 0, `defaultIndex=${realDefaultIndex}`);
  console.log(`INFO - ${label}: índice do is_default em produção = ${realDefaultIndex}`);
  check(`${label}: seletor visual aparece`, (await page.locator("[data-variant-selector]").count()) === 1);
  check(`${label}: todos os previews já estão visíveis`, (await page.locator("[data-variant-preview]").count()) === variants.length);

  const expectedPreviewIds = [];
  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    const text = variantLabel(detail, variant, index);
    const preview = page.locator(`[data-variant-preview="${variant.id}"]`);
    const title = page.locator(`[data-variant-label="${variant.id}"]`);
    const expectedPrimary = sortedVariantImages(detail, variant.id)[0]?.id ?? null;
    expectedPreviewIds.push(expectedPrimary);
    check(
      `${label}: título ${text} é somente texto`,
      (await title.evaluate((node) => node.tagName)) === "P" &&
        (await title.evaluate((node) => node.tabIndex)) === -1,
    );
    check(`${label}: preview ${text} é button`, (await preview.evaluate((node) => node.tagName)) === "BUTTON");
    check(
      `${label}: preview ${text} tem aria-label`,
      (await preview.getAttribute("aria-label")) === `Selecionar variação ${text}`,
    );
    check(
      `${label}: preview ${text} usa imagem da própria variante`,
      (await preview.getAttribute("data-variant-preview-image-id")) === expectedPrimary,
      `expected=${expectedPrimary}`,
    );
    const img = page.locator(`[data-variant-preview-image="${variant.id}"]`);
    check(
      `${label}: preview ${text} carregou`,
      (await img.count()) === 1 && (await img.evaluate((node) => node.complete && node.naturalWidth > 0)),
    );
  }
  check(
    `${label}: previews não misturam a mesma imagem entre variantes`,
    expectedPreviewIds.filter(Boolean).length === new Set(expectedPreviewIds.filter(Boolean)).size,
    JSON.stringify(expectedPreviewIds),
  );

  check(
    `${label}: default abre selecionado`,
    (await selectedId(page)) === defaultVariant.id,
    `expected=${defaultVariant.id}`,
  );
  const defaultPreview = page.locator(`[data-variant-preview="${defaultVariant.id}"]`);
  check(`${label}: default tem estado acessível`, (await defaultPreview.getAttribute("aria-pressed")) === "true");
  check(
    `${label}: default tem destaque vermelho`,
    (await defaultPreview.getAttribute("class"))?.includes("border-red-600") === true,
  );
  const expectedDefaultImage = sortedVariantImages(detail, defaultVariant.id)[0]?.id ?? null;
  check(
    `${label}: imagem principal corresponde ao default`,
    (await page.locator("[data-active-image-id]").getAttribute("data-active-image-id")) === expectedDefaultImage,
    `expected=${expectedDefaultImage}`,
  );
  check(
    `${label}: preço do default preservado`,
    (await shownPrice(page)).includes(currency.format(effectivePrice(detail, defaultVariant))),
  );

  const target = variants.find((variant) => variant.id !== defaultVariant.id);
  const beforeTextClick = await selectedId(page);
  await page.locator(`[data-variant-label="${target.id}"]`).click();
  check(`${label}: clicar no título não seleciona`, (await selectedId(page)) === beforeTextClick);

  for (const variant of variants) {
    const preview = page.locator(`[data-variant-preview="${variant.id}"]`);
    await preview.click();
    await page.waitForFunction(
      (id) => document.querySelector(`[data-variant-preview="${id}"]`)?.getAttribute("aria-pressed") === "true",
      variant.id,
    );
    check(`${label}: preview seleciona ${variant.id}`, (await selectedId(page)) === variant.id);
    const expectedImage = sortedVariantImages(detail, variant.id)[0]?.id ?? null;
    check(
      `${label}: imagem principal acompanha ${variant.id}`,
      (await page.locator("[data-active-image-id]").getAttribute("data-active-image-id")) === expectedImage,
      `expected=${expectedImage}`,
    );
    check(
      `${label}: preço acompanha ${variant.id}`,
      (await shownPrice(page)).includes(currency.format(effectivePrice(detail, variant))),
    );
    if (viewport.width >= 640) {
      const galleryButtons = page.locator(
        `section[aria-label^="Galeria de"] button[aria-label^="Ver imagem de"]`,
      );
      check(
        `${label}: galeria corresponde a ${variant.id}`,
        (await galleryButtons.count()) === expectedGalleryImages(detail, variant.id).length,
        `dom=${await galleryButtons.count()} expected=${expectedGalleryImages(detail, variant.id).length}`,
      );
    }
  }

  await defaultPreview.focus();
  const focusState = await defaultPreview.evaluate((node) => ({
    focused: document.activeElement === node,
    focusVisible: node.matches(":focus-visible"),
    boxShadow: getComputedStyle(node).boxShadow,
  }));
  check(
    `${label}: foco de teclado é visível`,
    focusState.focused && focusState.focusVisible && focusState.boxShadow !== "none",
    JSON.stringify(focusState),
  );
  const keyboardTarget = variants.find((variant) => variant.id !== defaultVariant.id) ?? defaultVariant;
  await page.locator(`[data-variant-preview="${keyboardTarget.id}"]`).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (id) => document.querySelector(`[data-variant-preview="${id}"]`)?.getAttribute("aria-pressed") === "true",
    keyboardTarget.id,
  );
  check(`${label}: teclado Enter seleciona preview`, (await selectedId(page)) === keyboardTarget.id);

  const geometry = await page.evaluate(() => {
    const rail = document.querySelector("[data-variant-selector] > div");
    return {
      doc: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      scrollbarWidth: rail ? getComputedStyle(rail).scrollbarWidth : null,
    };
  });
  check(`${label}: sem overflow horizontal da página`, geometry.doc <= geometry.viewport + 1, JSON.stringify(geometry));
  if (viewport.width <= 390) {
    const box = await page.locator("[data-variant-preview]").first().boundingBox();
    check(
      `${label}: alvo mobile confortável`,
      Boolean(box && box.width >= 96 && box.height >= 96),
      box ? JSON.stringify(box) : "sem box",
    );
    check(`${label}: scrollbar visual oculta`, geometry.scrollbarWidth === "none", JSON.stringify(geometry));
  }

  await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  check(
    `${label}: refresh reinicializa o default real`,
    (await selectedId(page)) === defaultVariant.id,
    `expected=${defaultVariant.id}`,
  );
  check(
    `${label}: galeria após refresh corresponde ao default`,
    (await page.locator("[data-active-image-id]").getAttribute("data-active-image-id")) === expectedDefaultImage,
    `expected=${expectedDefaultImage}`,
  );

  await checkRuntime(page, label, runtime);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runSingle(browser);
  await runCase(browser, CASES[0], { width: 1440, height: 1000 }, "desktop-1440");
  await runCase(browser, CASES[1], { width: 1440, height: 1000 }, "desktop-1440");
  await runCase(browser, CASES[1], { width: 834, height: 1112 }, "tablet-834");
  await runCase(browser, CASES[0], { width: 390, height: 844 }, "mobile-390");
  await runCase(browser, CASES[1], { width: 390, height: 844 }, "mobile-390");
} finally {
  await browser.close();
}

console.log(`QA_STAGE1_PROD_SUMMARY ${JSON.stringify({ sha: FINAL_SHA, passed, failed: failures.length })}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("QA_STAGE1_PRODUCTION_OK");
