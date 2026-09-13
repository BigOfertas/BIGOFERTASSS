import { readFileSync, writeFileSync } from "node:fs";

function replaceExact(path, before, after) {
  const source = readFileSync(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected integration anchor was not found in ${path}`);
  }
  writeFileSync(path, source.replace(before, after));
}

replaceExact(
  "src/routes/admin.tsx",
  'import { FinancialAdmin } from "@/components/admin/FinancialAdmin";\n',
  'import { FinanceCategoryPricing } from "@/components/admin/FinanceCategoryPricing";\nimport { FinancialAdmin } from "@/components/admin/FinancialAdmin";\n',
);

replaceExact(
  "src/routes/admin.tsx",
  '            ) : section === "finance" ? (\n              <FinancialAdmin onOpenProducts={() => setSection("products")} />\n            ) : section === "products" ? (',
  '            ) : section === "finance" ? (\n              <>\n                <FinanceCategoryPricing />\n                <FinancialAdmin onOpenProducts={() => setSection("products")} />\n              </>\n            ) : section === "products" ? (',
);

replaceExact(
  ".github/workflows/validate-main.yml",
  "      - name: Validate financial dashboard\n        run: node scripts/validate-financial-dashboard.mjs\n",
  "      - name: Validate financial dashboard\n        run: node scripts/validate-financial-dashboard.mjs && node scripts/validate-finance-category-bulk.mjs\n",
);
