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
  const sharedCatalogFile = process.env.AUDIT_PRODUCT_LINKS_FILE;
  if (sharedCatalogFile) {
    const raw = await fs.readFile(path.resolve(sharedCatalogFile), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(\`Shared product catalog is empty or invalid: \${sharedCatalogFile}\`);
    }
    const normalized = [...new Set(parsed.filter((href) => typeof href === "string" && href.startsWith("/product/")))].sort();
    if (normalized.length === 0) {
      throw new Error(\`Shared product catalog has no valid /product/ links: \${sharedCatalogFile}\`);
    }
    console.log(\`BROWSER_AUDIT_SHARED_CATALOG products=\${normalized.length}\`);
    return normalized;
  }

  const page = await context.newPage();
  const links = new Set();
  let pageNumber = 1;

  for (let current = 1; current <= 100; current += 1) {
    let found = [];
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await page.goto(\`${"${BASE_URL}"}/products?pageSize=48&page=\${pageNumber}\`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await settlePage(page);
      found = await page.locator('a[href*="/product/"]').evaluateAll((anchors) =>
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
      if (found.length > 0) break;
      await sleep(1200 * attempt);
    }

    if (found.length === 0) {
      const bodyText = (await page.locator("body").innerText()).slice(0, 2500);
      await page.close();
      throw new Error(\`Product discovery failed on catalog page \${pageNumber}. Body: \${bodyText}\`);
    }

    const before = links.size;
    for (const href of found) links.add(href.split("?")[0]);
    console.log(\`BROWSER_AUDIT_DISCOVERY page=\${pageNumber} pageLinks=\${found.length} unique=\${links.size}\`);

    const next = page.getByRole("button", { name: /Próxima página/i }).first();
    if ((await next.count()) === 0 || (await next.isDisabled())) break;
    if (links.size === before) break;
    pageNumber += 1;
  }

  await page.close();
  if (links.size === 0) throw new Error("Product discovery produced an empty catalog");
  return [...links].sort();
}`;

source = source.slice(0, start) + replacement + source.slice(end);
await fs.writeFile(file, source);
console.log("BROWSER_AUDIT_DISCOVERY_PATCH_APPLIED");
