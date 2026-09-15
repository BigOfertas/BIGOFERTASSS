import fs from "node:fs/promises";

const file = "scripts/browser-dark-contrast-audit.mjs";
let source = await fs.readFile(file, "utf8");

source = source.replace(
  `    colorScheme: "dark",\n    locale: "pt-BR",`,
  `    colorScheme: "dark",\n    reducedMotion: "reduce",\n    locale: "pt-BR",`,
);
source = source.replace("  await sleep(250);", "  await sleep(1200);");

const start = source.indexOf("async function discoverProductLinks(context) {");
const end = source.indexOf("\n\nasync function auditRoutes", start);
if (start < 0 || end < 0) {
  throw new Error("browser audit discovery function changed; patch not applied");
}

const replacement = `async function discoverProductLinks(context) {
  const page = await context.newPage();
  const links = new Set();
  await page.goto(\`${"${BASE_URL}"}/products?pageSize=48\`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await settlePage(page);

  let previousFirstHref = null;
  for (let current = 1; current <= 100; current += 1) {
    await Promise.race([
      page.locator('a[href*="/product/"]').first().waitFor({ state: "attached", timeout: 25_000 }),
      page.getByText(/Nenhum produto encontrado/i).first().waitFor({ state: "visible", timeout: 25_000 }),
      page.getByText(/Erro ao carregar produtos/i).first().waitFor({ state: "visible", timeout: 25_000 }),
    ]).catch(() => {});
    await sleep(500);

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

    if (current === 1 && found.length === 0) {
      const bodyText = (await page.locator("body").innerText()).slice(0, 2500);
      throw new Error(\`Product discovery returned zero links on the first catalog page. Body: \${bodyText}\`);
    }
    for (const href of found) links.add(href.split("?")[0]);

    const next = page.getByRole("button", { name: /Próxima página/i }).first();
    if ((await next.count()) === 0 || (await next.isDisabled())) break;

    const currentFirstHref = found[0] ?? null;
    await next.click();
    await page
      .waitForFunction(
        (oldHref) => {
          const first = document.querySelector('a[href*="/product/"]');
          const href = first?.getAttribute("href") ?? null;
          return href && href !== oldHref;
        },
        currentFirstHref ?? previousFirstHref,
        { timeout: 25_000 },
      )
      .catch(() => {});
    previousFirstHref = currentFirstHref;
    await sleep(550);
  }

  await page.close();
  if (links.size === 0) throw new Error("Product discovery produced an empty catalog");
  return [...links].sort();
}`;

source = source.slice(0, start) + replacement + source.slice(end);
await fs.writeFile(file, source);
console.log("BROWSER_AUDIT_DISCOVERY_PATCH_APPLIED");
