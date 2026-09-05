import fs from "node:fs";

function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, value) { fs.writeFileSync(file, value); }
function replaceExact(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`Expected block not found: ${file}`);
  write(file, source.replace(before, after));
}

// Admin: add the dedicated Personalização section.
replaceExact(
  "src/routes/admin.tsx",
  `  LogOut,\n  ShoppingBag,`,
  `  LogOut,\n  Palette,\n  ShoppingBag,`,
);
replaceExact(
  "src/routes/admin.tsx",
  `import { ProductPurchaseAdmin } from "@/components/admin/ProductPurchaseAdmin";`,
  `import { ProductPurchaseAdmin } from "@/components/admin/ProductPurchaseAdmin";\nimport { PersonalizationAdmin } from "@/components/admin/PersonalizationAdmin";`,
);
replaceExact(
  "src/routes/admin.tsx",
  `type AdminSection = "dashboard" | "orders" | "products" | "affiliates";`,
  `type AdminSection = "dashboard" | "orders" | "products" | "personalization" | "affiliates";`,
);
replaceExact(
  "src/routes/admin.tsx",
  `  {\n    id: "affiliates",\n    label: "Afiliados",`,
  `  {\n    id: "personalization",\n    label: "Personalização",\n    description: "Banners e artes da loja",\n    icon: Palette,\n  },\n  {\n    id: "affiliates",\n    label: "Afiliados",`,
);
replaceExact(
  "src/routes/admin.tsx",
  `            ) : section === "products" ? (\n              <>\n                <ProductAdmin />\n                <ProductPurchaseAdmin />\n                <ProductImageAdmin />\n              </>\n            ) : (\n              <AffiliateAdmin />\n            )}`,
  `            ) : section === "products" ? (\n              <>\n                <ProductAdmin />\n                <ProductPurchaseAdmin />\n                <ProductImageAdmin />\n              </>\n            ) : section === "personalization" ? (\n              <PersonalizationAdmin />\n            ) : (\n              <AffiliateAdmin />\n            )}`,
);

// Catalog grid cards inherit the same metadata used by home cards.
replaceExact(
  "src/routes/products.tsx",
  `                      imageUrl={product.displayImageUrl}\n                    />`,
  `                      imageUrl={product.displayImageUrl}\n                      time={product.time}\n                      commercialType={product.commercial_type}\n                    />`,
);

// Product page: remove operational data, add delivery quote and sticky mobile action.
replaceExact(
  "src/routes/product/$id.tsx",
  `import ProductGallery from "@/components/product/ProductGallery";`,
  `import ProductGallery from "@/components/product/ProductGallery";\nimport { ProductShippingCalculator } from "@/components/product/ProductShippingCalculator";`,
);
replaceExact(
  "src/routes/product/$id.tsx",
  `  const builtInSpecs = [\n    { label: "SKU", value: selectedVariant?.sku ?? product.sku },`,
  `  const builtInSpecs = [`,
);
replaceExact(
  "src/routes/product/$id.tsx",
  `    product.weight_grams !== null\n      ? { label: "Peso", value: \`${product.weight_grams} g\` }\n      : null,\n    product.length_cm !== null && product.width_cm !== null && product.height_cm !== null\n      ? {\n          label: "Dimensões",\n          value: \`${product.length_cm} × ${product.width_cm} × ${product.height_cm} cm\`,\n        }\n      : null,\n`,
  ``,
);
replaceExact(
  "src/routes/product/$id.tsx",
  `              <p className="mb-5 text-xs font-medium uppercase tracking-wider text-gray-400">\n                SKU: {selectedVariant?.sku ?? product.sku}\n              </p>\n\n`,
  ``,
);
replaceExact(
  "src/routes/product/$id.tsx",
  `            {purchaseConfig ? (\n              <ProductPurchaseOptions\n                config={purchaseConfig}\n                value={purchaseCustomization}\n                onChange={setPurchaseCustomization}\n              />\n            ) : null}\n\n            <div className="mt-auto space-y-5 border-t border-gray-100 pt-6">`,
  `            {purchaseConfig ? (\n              <ProductPurchaseOptions\n                config={purchaseConfig}\n                value={purchaseCustomization}\n                onChange={setPurchaseCustomization}\n              />\n            ) : null}\n\n            <div className="my-5">\n              <ProductShippingCalculator productId={product.id} quantity={quantity} />\n            </div>\n\n            <div className="mt-auto space-y-5 border-t border-gray-100 pt-6">`,
);
replaceExact(
  "src/routes/product/$id.tsx",
  `<div className="min-h-screen bg-white pb-20">`,
  `<div className="min-h-screen bg-white pb-32 md:pb-20">`,
);
replaceExact(
  "src/routes/product/$id.tsx",
  `      </main>\n    </div>\n  );`,
  `      </main>\n\n      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">\n        <div className="mx-auto flex max-w-xl items-center gap-3">\n          <div className="min-w-0 flex-1">\n            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Valor por peça</p>\n            <p className="truncate text-lg font-black text-gray-950">{currency.format(finalUnitPrice)}</p>\n          </div>\n          <Button\n            onClick={handleAddToCart}\n            disabled={!selectedVariant || !selectionComplete || !purchaseConfig}\n            className="h-12 flex-[1.35] rounded-xl bg-red-600 px-4 text-sm font-black text-white hover:bg-black disabled:bg-gray-200 disabled:text-gray-400"\n          >\n            <ShoppingCart className="mr-2 h-4 w-4" />\n            {!selectionComplete ? "Escolha as opções" : "Adicionar"}\n          </Button>\n        </div>\n      </div>\n    </div>\n  );`,
);

console.log("Storefront UI finishing pass applied.");
