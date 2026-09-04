import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOTS = ["src/components", "src/routes"];
const ALLOWED_FILES = new Set(["src/components/brand/BrandWordmark.tsx"]);
const FORBIDDEN = [
  { label: "nome legado", pattern: /BIGofertas/g },
  { label: "dominio legado", pattern: /bigofertas\.net/g },
  { label: "email legado", pattern: /contato@bigofertas\.net/g },
  { label: "wordmark legado fragmentado", pattern: />BIG<\/span>ofertas/g },
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if ([".ts", ".tsx"].includes(extname(entry.name))) files.push(path);
  }

  return files;
}

const failures = [];

for (const root of ROOTS) {
  for (const file of await collectFiles(root)) {
    const normalized = relative(".", file).replaceAll("\\", "/");
    if (ALLOWED_FILES.has(normalized)) continue;

    const source = await readFile(file, "utf8");
    const lines = source.split(/\r?\n/);

    for (const { label, pattern } of FORBIDDEN) {
      pattern.lastIndex = 0;
      if (!pattern.test(source)) continue;

      lines.forEach((line, index) => {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          failures.push(`${normalized}:${index + 1} - ${label}: ${line.trim()}`);
        }
      });
    }
  }
}

if (failures.length > 0) {
  console.error("A identidade antiga ainda esta escrita diretamente na UI:\n");
  for (const failure of failures) console.error(`FAIL - ${failure}`);
  console.error("\nUse src/config/brand.ts (BRAND) ou BrandWordmark em vez de texto fixo.");
  process.exit(1);
}

console.log("PASS - nenhuma identidade antiga esta hardcoded nas telas do storefront/admin.");
