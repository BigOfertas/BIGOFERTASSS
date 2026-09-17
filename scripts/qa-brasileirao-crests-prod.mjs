import { chromium } from "playwright";
import fs from "node:fs";

const production = "https://bigofertas.net";
const outDir = "qa-brasileirao-crests-prod";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

function record(viewport, check, pass, details = {}) {
  results.push({ viewport, check, pass, ...details });
}

async function verify(viewportName, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${production}/?qa_brasileirao_crests=${Date.now()}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });

  const section = page.locator('[data-team-slot-count="30"]');
  await section.waitFor({ state: "visible", timeout: 30000 });

  const slots = section.locator("[data-team-slot]");
  const count = await slots.count();
  record(viewportName, "slots-30", count === 30, { count });

  const expectedTeams = [
    "flamengo",
    "atletico-mineiro",
    "cruzeiro",
    "sao-paulo",
    "corinthians",
    "palmeiras",
    "santos",
    "botafogo",
    "fluminense",
    "gremio",
    "internacional",
  ];

  let realCrestsOk = true;
  for (const team of expectedTeams) {
    const slot = section.locator(`[data-team-slot="${team}"]`);
    if ((await slot.count()) !== 1) {
      realCrestsOk = false;
      break;
    }
    const bg = await slot.locator("span").evaluate((el) => getComputedStyle(el).backgroundImage);
    if (!bg.includes("data:image/webp")) {
      realCrestsOk = false;
      break;
    }
  }
  record(viewportName, "11-real-crests", realCrestsOk);

  let reservedOk = true;
  for (let i = 1; i <= 19; i += 1) {
    if ((await section.locator(`[data-team-slot="reserved-${i}"]`)).count() !== 1) {
      reservedOk = false;
      break;
    }
  }
  record(viewportName, "19-reserved-slots", reservedOk);

  const rail = section.locator(".overflow-x-auto").first();
  const geometry = await rail.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    initialScrollLeft: el.scrollLeft,
  }));
  record(viewportName, "horizontal-rail", geometry.scrollWidth > geometry.clientWidth, geometry);

  if (viewportName === "mobile") {
    await rail.evaluate((el) => el.scrollTo({ left: Math.min(600, el.scrollWidth - el.clientWidth), behavior: "instant" }));
    await page.waitForTimeout(200);
    const after = await rail.evaluate((el) => el.scrollLeft);
    const bodyWidth = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    record(viewportName, "rail-scrolls", after > 0, { after });
    record(viewportName, "no-page-overflow", bodyWidth.scrollWidth <= bodyWidth.clientWidth + 1, bodyWidth);
  } else {
    const left = section.getByRole("button", { name: "Ver times anteriores" });
    const right = section.getByRole("button", { name: "Ver próximos times" });
    const arrowsVisible = await left.isVisible() && await right.isVisible();
    record(viewportName, "desktop-arrows", arrowsVisible);
    if (arrowsVisible) {
      await right.click();
      await page.waitForTimeout(700);
      const after = await rail.evaluate((el) => el.scrollLeft);
      record(viewportName, "desktop-arrow-scroll", after > 0, { after });
    }
  }

  const flamengoHref = await section.locator('[data-team-slot="flamengo"] a').getAttribute("href");
  record(viewportName, "flamengo-click-filter", Boolean(flamengoHref?.includes("time=flamengo")), { href: flamengoHref });

  const reservedHref = await section.locator('[data-team-slot="reserved-1"] a').getAttribute("href");
  record(viewportName, "reserved-safe-link", Boolean(reservedHref?.includes("campeonato=brasileirao")), { href: reservedHref });

  await page.screenshot({ path: `${outDir}/${viewportName}.png`, fullPage: true });
  await context.close();
}

await verify("desktop", { width: 1440, height: 1000 });
await verify("mobile", { width: 390, height: 844 });
await browser.close();

const failed = results.filter((item) => !item.pass);
console.log("BRAZILEIRAO_CRESTS_PROD_QA", JSON.stringify({ production, checks: results.length, passed: results.length - failed.length, failed: failed.length }));
for (const result of results) console.log(JSON.stringify(result));
fs.writeFileSync(`${outDir}/results.json`, JSON.stringify(results, null, 2));
if (failed.length > 0) process.exit(1);
