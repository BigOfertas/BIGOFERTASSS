import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOTS = ["src"];
const INTERNAL_FIXTURES = ["Camisa Profissional BIGofertas 2024"];
const TECHNICAL_SOURCE_FILES = new Set([
  "src/components/product/CatalogProductGrid.tsx",
  "src/lib/public-product-description.ts",
  "src/lib/shipping-server.ts",
]);
const PUBLIC_LEGACY_BRAND = /\bbigofertas\b(?!\.net)/gi;
const TECHNICAL_DOMAIN = /\b(?:img\.)?bigofertas\.net\b/gi;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if ([".ts", ".tsx", ".js", ".jsx"].includes(extname(entry.name))) files.push(path);
  }

  return files;
}

const failures = [];
let technicalDomainReferences = 0;
let internalFixtureReferences = 0;
let technicalLegacyReferences = 0;

for (const root of ROOTS) {
  for (const file of await collectFiles(root)) {
    const normalized = relative(".", file).replaceAll("\\", "/");
    const source = await readFile(file, "utf8");
    technicalDomainReferences += source.match(TECHNICAL_DOMAIN)?.length ?? 0;

    if (TECHNICAL_SOURCE_FILES.has(normalized)) {
      technicalLegacyReferences += source.match(PUBLIC_LEGACY_BRAND)?.length ?? 0;
      continue;
    }

    let publicSource = source;
    for (const fixture of INTERNAL_FIXTURES) {
      const occurrences = publicSource.split(fixture).length - 1;
      if (occurrences > 0) {
        internalFixtureReferences += occurrences;
        publicSource = publicSource.replaceAll(fixture, "");
      }
    }

    const lines = publicSource.split(/\r?\n/);
    lines.forEach((line, index) => {
      PUBLIC_LEGACY_BRAND.lastIndex = 0;
      if (PUBLIC_LEGACY_BRAND.test(line)) {
        failures.push(`${normalized}:${index + 1} - marca pública legada: ${line.trim()}`);
      }
    });
  }
}

if (failures.length > 0) {
  console.error("A identidade antiga ainda esta escrita em uma superficie publica do codigo:\n");
  for (const failure of failures) console.error(`FAIL - ${failure}`);
  console.error(
    "\nPreserve bigofertas.net e identificadores internos quando tecnicamente necessarios, mas use DropBox para a marca visivel.",
  );
  process.exit(1);
}

console.log("PASS - nenhuma identidade antiga esta hardcoded nas superficies publicas do src.");
console.log("BRAND_AUDIT_PUBLIC_LEGACY_OCCURRENCES=0");
console.log(`BRAND_AUDIT_TECHNICAL_DOMAIN_REFERENCES_PRESERVED=${technicalDomainReferences}`);
console.log(`BRAND_AUDIT_INTERNAL_FIXTURES_PRESERVED=${internalFixtureReferences}`);
console.log(`BRAND_AUDIT_TECHNICAL_LEGACY_REFERENCES_PRESERVED=${technicalLegacyReferences}`);
