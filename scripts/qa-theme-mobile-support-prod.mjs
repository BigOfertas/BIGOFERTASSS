import fs from "node:fs/promises";
import { chromium } from "playwright";

const BASE_URL = "https://bigofertas.net";
const OUTPUT = "qa-theme-mobile-support-prod";

await fs.mkdir(OUTPUT, { recursive: true });

const results = [];
const fail = (message) => {
  throw new Error(message);
};

async function preparePage(browser, viewport) {
  const context = await browser.newContext({ viewport, colorScheme: "light", locale: "pt-BR" });
  await context.addInitScript(() => {
    localStorage.setItem("dropbox-theme", "light");
    localStorage.setItem("dropbox-locale", "pt");
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/?qa_theme_mobile=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForSelector("header", { timeout: 20000 });
  await page.waitForTimeout(900);
  return { context, page };
}

async function verifyTheme(page, viewportName) {
  const darkButton = page.locator('button[aria-label="Usar modo escuro"]:visible').first();
  const lightButton = page.locator('button[aria-label="Usar modo claro"]:visible').first();
  if ((await darkButton.count()) !== 1) fail(`${viewportName}: seletor de tema visível não encontrado`);

  await darkButton.click();
  await page.waitForFunction(
    () => document.documentElement.classList.contains("dark") && localStorage.getItem("dropbox-theme") === "dark",
  );

  await lightButton.click();
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("dark") && localStorage.getItem("dropbox-theme") === "light",
  );

  results.push({ viewport: viewportName, check: "theme-toggle", pass: true });
}

async function verifyLanguage(page, viewportName) {
  const select = page.locator("[data-language-switcher]:visible select").first();
  if ((await select.count()) !== 1) fail(`${viewportName}: seletor de idioma visível não encontrado`);

  await select.selectOption("en");
  await page.waitForFunction(() => localStorage.getItem("dropbox-locale") === "en");

  if ((await select.inputValue()) !== "en") fail(`${viewportName}: idioma não permaneceu em inglês`);

  if (viewportName === "desktop") {
    await page.waitForFunction(() => {
      const header = document.querySelector("header");
      const text = header?.textContent ?? "";
      return text.includes("HOME") && !text.includes("INÍCIO");
    });
  }

  results.push({ viewport: viewportName, check: "language-switch", pass: true });
}

async function verifyMobileLayout(page) {
  const controls = page.locator("[data-mobile-header-controls]:visible").first();
  const language = page.locator("[data-language-switcher]:visible").first();
  const theme = page.locator("[data-theme-toggle]:visible").first();

  const [controlsBox, languageBox, themeBox] = await Promise.all([
    controls.boundingBox(),
    language.boundingBox(),
    theme.boundingBox(),
  ]);
  if (!controlsBox || !languageBox || !themeBox) fail("mobile: controles sem bounding box");

  const viewportWidth = page.viewportSize()?.width ?? 390;
  const epsilon = 1;
  if (controlsBox.x < -epsilon || controlsBox.x + controlsBox.width > viewportWidth + epsilon) {
    fail(`mobile: linha de controles extrapola viewport (${JSON.stringify(controlsBox)})`);
  }
  if (languageBox.x + languageBox.width > themeBox.x + epsilon) {
    fail(`mobile: idioma e tema se sobrepõem (${JSON.stringify({ languageBox, themeBox })})`);
  }
  if (languageBox.width < 150) fail(`mobile: seletor de idioma ficou estreito (${languageBox.width})`);
  if (themeBox.x + themeBox.width > viewportWidth + epsilon) {
    fail(`mobile: toggle de tema extrapola viewport (${JSON.stringify(themeBox)})`);
  }

  results.push({
    viewport: "mobile",
    check: "controls-layout",
    pass: true,
    controlsBox,
    languageBox,
    themeBox,
  });
}

async function verifySupportNumber(page, viewportName) {
  await page.goto(`${BASE_URL}/contato?qa_support=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(700);
  const bodyText = await page.locator("body").innerText();
  if (!bodyText.includes("+55 84 8134-7639")) {
    fail(`${viewportName}: novo número de suporte não aparece em /contato`);
  }
  if (bodyText.includes("8134-7939")) fail(`${viewportName}: número antigo ainda aparece em /contato`);

  const whatsapp = page.locator('a[href^="https://wa.me/558481347639"]:visible').first();
  if ((await whatsapp.count()) < 1) fail(`${viewportName}: link novo do WhatsApp não encontrado`);

  results.push({ viewport: viewportName, check: "support-number", pass: true });
}

const browser = await chromium.launch({ headless: true });
try {
  for (const spec of [
    { name: "desktop", viewport: { width: 1440, height: 900 } },
    { name: "mobile", viewport: { width: 390, height: 844 } },
  ]) {
    const { context, page } = await preparePage(browser, spec.viewport);
    try {
      await verifyTheme(page, spec.name);
      await verifyLanguage(page, spec.name);
      if (spec.name === "mobile") await verifyMobileLayout(page);
      await page.screenshot({ path: `${OUTPUT}/${spec.name}-header.png`, fullPage: false });
      await verifySupportNumber(page, spec.name);
      await page.screenshot({ path: `${OUTPUT}/${spec.name}-contact.png`, fullPage: true });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

await fs.writeFile(`${OUTPUT}/results.json`, JSON.stringify(results, null, 2));
console.log(
  "THEME_MOBILE_SUPPORT_QA",
  JSON.stringify({ production: BASE_URL, checks: results.length, passed: results.length, failed: 0 }),
);
for (const result of results) console.log(JSON.stringify(result));
