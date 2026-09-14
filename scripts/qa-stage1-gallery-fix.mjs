import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4173";
const CASES = [
  { slug: "chelsea-camisa-i-26-27-nike-p000001", expectedVariants: 2, name: "Chelsea" },
  { slug: "flamengo-camisa-i-25-26-adidas-p001217", expectedVariants: 3, name: "Flamengo" },
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

let passed = 0;
const failures = [];
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

function expectedGalleryCount(detail, variantId) {
  const variantImages = (detail.images ?? []).filter(
    (image) => image.status === "ready" && image.variant_id === variantId,
  );
  const shared = (detail.images ?? []).filter(
    (image) => image.status === "ready" && image.variant_id == null,
  );
  return variantImages.length + shared.length;
}

async function focusVariantWithKeyboard(page) {
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  for (let attempt = 0; attempt < 60; attempt += 1) {
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

async function runCase(browser, testCase, viewport, suffix) {
  const detail = await fetchDetail(testCase.slug);
  const variants = detail.variants ?? [];
  const defaultVariant = variants.find((variant) => variant.is_default) ?? variants[0];
  const label = `${testCase.name} ${suffix}`;
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto(`${BASE}/product/${testCase.slug}`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  check(`${label}: rota carrega`, response?.ok() === true, `HTTP ${response?.status()}`);
  check(`${label}: quantidade de variantes`, variants.length === testCase.expectedVariants, `count=${variants.length}`);
  check(
    `${label}: default abre selecionado`,
    (await page.locator('[data-variant-preview][aria-pressed="true"]').getAttribute("data-variant-preview")) === defaultVariant.id,
  );

  for (const variant of variants) {
    await page.locator(`[data-variant-preview="${variant.id}"]`).click();
    await page.waitForFunction(
      (id) => document.querySelector(`[data-variant-preview="${id}"]`)?.getAttribute("aria-pressed") === "true",
      variant.id,
    );
    const galleryButtons = page.locator(
      'section[aria-label^="Galeria de"] button[aria-label^="Ver imagem de"]',
    );
    const actualCount = await galleryButtons.count();
    const expectedCount = expectedGalleryCount(detail, variant.id);
    check(
      `${label}: galeria não mistura legacy em ${variant.id}`,
      actualCount === expectedCount,
      `dom=${actualCount} expected=${expectedCount}`,
    );
  }

  await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const focusState = await focusVariantWithKeyboard(page);
  check(`${label}: Tab alcança preview`, Boolean(focusState.variantId), JSON.stringify(focusState));
  check(
    `${label}: foco por teclado é visível`,
    focusState.focusVisible && focusState.boxShadow !== "none",
    JSON.stringify(focusState),
  );
  if (focusState.variantId) {
    await page.keyboard.press("Enter");
    check(
      `${label}: Enter seleciona preview focado`,
      (await page.locator('[data-variant-preview][aria-pressed="true"]').getAttribute("data-variant-preview")) ===
        focusState.variantId,
    );
  }

  check(
    `${label}: sem erro relevante de console`,
    consoleErrors.filter((text) => !/favicon|ResizeObserver|third-party cookie/i.test(text)).length === 0,
    consoleErrors.join(" | "),
  );
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runCase(browser, CASES[0], { width: 1440, height: 1000 }, "desktop-1440");
  await runCase(browser, CASES[1], { width: 834, height: 1112 }, "tablet-834");
  await runCase(browser, CASES[1], { width: 390, height: 844 }, "mobile-390");
} finally {
  await browser.close();
}

console.log(`QA_STAGE1_GALLERY_FIX_SUMMARY ${JSON.stringify({ passed, failed: failures.length })}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("QA_STAGE1_GALLERY_FIX_OK");
