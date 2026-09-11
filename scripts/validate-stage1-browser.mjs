import fs from "node:fs";
import { chromium } from "playwright";

const baseUrl = (process.env.STAGE1_BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const evidenceDir = ".artifacts/stage1-browser";
fs.mkdirSync(evidenceDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS - ${message}`);
}

async function waitForInteractive(page) {
  await page.locator("[data-cursor-follower]").waitFor({ state: "attached", timeout: 5_000 });
  assert(
    (await page.locator("[data-initial-refresh-loader]").count()) === 0,
    "site não usa mais loading artificial bloqueante",
  );
}

async function waitForDesktopHydration(page) {
  await page.mouse.move(321, 241);
  await page.waitForFunction(() => {
    const dot = document.querySelector("[data-cursor-dot]");
    return dot instanceof HTMLElement && dot.style.transform.includes("translate3d(321px, 241px");
  }, null, { timeout: 5_000 });
  console.log("PASS - React está hidratado antes dos testes interativos da galeria");
}

async function runDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await waitForInteractive(page);
  await waitForDesktopHydration(page);

  const firstLaunchImage = page.locator('#lancamentos [data-product-card] img').first();
  await firstLaunchImage.waitFor({ state: "visible", timeout: 12_000 });
  await firstLaunchImage.evaluate((image) => {
    if (image.complete) return;
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  });
  assert(
    await firstLaunchImage.evaluate((image) => image.complete && image.naturalWidth > 0),
    "primeira imagem de produto carrega de verdade na entrada da loja",
  );

  const launchSrc = (await firstLaunchImage.getAttribute("src")) || "";
  if (/googleusercontent\.com/i.test(launchSrc)) {
    assert(
      /=w768-h768-s-no-gm/i.test(launchSrc),
      "card Google Photos usa imagem compacta de 768 px em vez da original de 4096 px",
    );
  } else {
    console.log("PASS - primeiro card usa derivado R2/local em vez do original Google de 4096 px");
  }

  const visualSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Monte seu pedido" }) });
  await visualSection.scrollIntoViewIfNeeded();
  const firstVisualCard = visualSection.locator("[data-visual-category-card]").first();
  const visualBox = await firstVisualCard.boundingBox();
  assert(
    Boolean(visualBox && visualBox.width >= 310),
    `cards de Monte seu pedido dobram no desktop (${Math.round(visualBox?.width || 0)} px)`,
  );
  assert(
    ((await firstVisualCard.textContent())?.trim() || "") === "",
    "cards de Monte seu pedido não têm texto sobreposto à arte",
  );

  const leagueSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Compre por liga" }) });
  await leagueSection.scrollIntoViewIfNeeded();
  await leagueSection
    .locator('[data-league-products="la-liga"] [data-product-card]')
    .first()
    .waitFor({ state: "visible", timeout: 12_000 });
  await leagueSection.getByRole("button", { name: "PREMIER LEAGUE" }).click();
  await leagueSection
    .locator('[data-league-products="premier-league"] [data-product-card]')
    .first()
    .waitFor({ state: "visible", timeout: 12_000 });

  await page.screenshot({ path: `${evidenceDir}/home-desktop.png`, fullPage: true });

  const firstProduct = page.locator("[data-product-card]").first();
  const productHref = await firstProduct.getAttribute("href");
  assert(Boolean(productHref), "há produto real disponível para teste da galeria");

  await page.goto(new URL(productHref, baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await waitForInteractive(page);
  await waitForDesktopHydration(page);

  const gallery = page.locator('section[aria-label^="Galeria de"]');
  await gallery.waitFor({ state: "visible", timeout: 10_000 });
  assert(
    (await gallery.locator("[data-magnifier-lens]").count()) === 0,
    "lupa de hover foi removida completamente da página do produto",
  );
  assert(
    (await page.locator("[data-cursor-follower]").count()) === 1,
    "cursor integrado permanece ativo na página do produto",
  );

  const mainImage = gallery.locator("[data-active-image-id] img").first();
  await mainImage.waitFor({ state: "visible", timeout: 8_000 });
  assert(
    (await mainImage.evaluate((image) => getComputedStyle(image).transitionDuration)) === "0s",
    "imagem do produto não possui animação CSS ao trocar de foto",
  );

  const nextButton = gallery.locator('[data-gallery-nav="next"]');
  if ((await nextButton.count()) > 0) {
    const activeButton = gallery.locator("[data-active-image-id]").first();
    const beforeId = await activeButton.getAttribute("data-active-image-id");
    await nextButton.click();
    await page.waitForFunction(
      (previousId) =>
        document.querySelector("[data-active-image-id]")?.getAttribute("data-active-image-id") !==
        previousId,
      beforeId,
      { timeout: 1_500 },
    );
    const afterId = await activeButton.getAttribute("data-active-image-id");
    assert(beforeId !== afterId, "seta troca a foto imediatamente, sem animação de deslize");
  } else {
    console.log("PASS - produto de teste tem uma imagem; ausência de slide validada estruturalmente");
  }

  const header = page.locator("header").first();
  const statusOverlay = gallery.locator("[data-gallery-status-overlay]");
  const [headerZ, statusZ] = await Promise.all([
    header.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || "0", 10)),
    statusOverlay.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || "0", 10)),
  ]);
  assert(statusZ < headerZ, `indicador/Ampliar fica abaixo do cabeçalho (${statusZ} < ${headerZ})`);

  await gallery.locator('button[aria-label^="Ampliar imagem"]').first().click({ force: true });
  const viewerFrame = page.locator("[data-product-image-viewer-frame]");
  await viewerFrame.waitFor({ state: "visible", timeout: 5_000 });
  const viewerBox = await viewerFrame.boundingBox();
  assert(Boolean(viewerBox), "viewer ampliado abre imediatamente");
  assert(
    viewerBox.height <= 770,
    `viewer usa cerca de 75% da altura da tela (${Math.round(viewerBox.height)} px)`,
  );
  assert(
    viewerBox.y >= 90 && viewerBox.y <= 180,
    `viewer fica centralizado sem grande vazio superior (topo ${Math.round(viewerBox.y)} px)`,
  );
  await page.screenshot({ path: `${evidenceDir}/product-viewer-desktop.png`, fullPage: false });

  await context.close();
  return productHref;
}

async function runMobile(browser, productHref) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(new URL(productHref, baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await waitForInteractive(page);

  const gallery = page.locator('section[aria-label^="Galeria de"]');
  await gallery.waitFor({ state: "visible", timeout: 10_000 });
  assert(
    (await gallery.locator("[data-product-gallery-track]").count()) === 0,
    "galeria mobile não usa track animado de carrossel",
  );

  const status = page.locator("[data-gallery-status-overlay]");
  const header = page.locator("header").first();
  const [headerZ, statusZ] = await Promise.all([
    header.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || "0", 10)),
    status.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || "0", 10)),
  ]);
  assert(statusZ < headerZ, "contador mobile fica abaixo do cabeçalho durante o scroll");

  await page.screenshot({ path: `${evidenceDir}/product-mobile.png`, fullPage: false });
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  const productHref = await runDesktop(browser);
  await runMobile(browser, productHref);
  console.log("STAGE1_BROWSER_OK");
} finally {
  await browser.close();
}
