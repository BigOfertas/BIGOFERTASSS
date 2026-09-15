import fs from "node:fs/promises";

const file = "scripts/browser-dark-contrast-audit.mjs";
const source = await fs.readFile(file, "utf8");
const oldBlock = `    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await settlePage(page);
    const found = await page.locator('a[href^="/product/"]').evaluateAll((anchors) =>
      anchors
        .map((anchor) => anchor.getAttribute("href"))
        .filter((href) => typeof href === "string" && href.startsWith("/product/")),
    );
    const before = links.size;
    for (const href of found) links.add(href.split("?")[0]);
    if (found.length === 0 || links.size === before) emptyPages += 1;
    else emptyPages = 0;
    if (emptyPages >= 2) break;`;
const newBlock = `    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await settlePage(page);
    await page
      .waitForSelector('a[href*="/product/"], [data-product-card], text=/Nenhum produto encontrado/i', {
        timeout: 20_000,
      })
      .catch(() => {});
    await sleep(550);
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
      throw new Error("Product discovery returned zero links on the first catalog page");
    }
    const before = links.size;
    for (const href of found) links.add(href.split("?")[0]);
    if (found.length === 0 || links.size === before) emptyPages += 1;
    else emptyPages = 0;
    if (emptyPages >= 2) break;`;

if (!source.includes(oldBlock)) {
  throw new Error("browser audit discovery block changed; patch not applied");
}
await fs.writeFile(file, source.replace(oldBlock, newBlock));
console.log("BROWSER_AUDIT_DISCOVERY_PATCH_APPLIED");
