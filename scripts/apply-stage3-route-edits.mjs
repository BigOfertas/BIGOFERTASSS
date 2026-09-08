import fs from "node:fs";

const routePath = "src/routes/product/$id.tsx";
let route = fs.readFileSync(routePath, "utf8");
route = route.replace(
  `                          detail.variants,\n                          option.id,\n                          value.id,\n                          {},\n                        );`,
  `                          detail.variants,\n                          option.id,\n                          value.id,\n                          selection,\n                        );`,
);
fs.writeFileSync(routePath, route);

const seoPath = "src/components/product/ProductSeo.tsx";
let seo = fs.readFileSync(seoPath, "utf8");
seo = seo.replace(
  'const canonicalUrl = `${window.location.origin}/product/${encodeURIComponent(product.slug)}`;',
  'const canonicalUrl = `${BRAND.siteUrl}/product/${encodeURIComponent(product.slug)}`;',
);
fs.writeFileSync(seoPath, seo);

const typesPath = "src/integrations/supabase/types.ts";
let types = fs.readFileSync(typesPath, "utf8");
const start = types.indexOf("      product_images: {");
const end = types.indexOf("      product_option_values: {", start);
if (start < 0 || end < 0) throw new Error("product_images type block not found");
let block = types.slice(start, end);

if (!block.includes("          card_storage_key: string | null;")) {
  block = block.replace(
    "          byte_size: number | null;\n",
    "          byte_size: number | null;\n          card_storage_key: string | null;\n",
  );
}
if (!block.includes("          thumb_storage_key: string | null;")) {
  block = block.replace(
    "          storage_key: string;\n",
    "          storage_key: string;\n          thumb_storage_key: string | null;\n",
  );
}

const insertStart = block.indexOf("        Insert: {");
const updateStart = block.indexOf("        Update: {");
const relationshipsStart = block.indexOf("        Relationships:", updateStart);
if (insertStart < 0 || updateStart < 0 || relationshipsStart < 0) {
  throw new Error("product_images insert/update type blocks not found");
}

let rowAndInsert = block.slice(0, updateStart);
let updateAndRest = block.slice(updateStart);
if (!rowAndInsert.includes("          card_storage_key?: string | null;")) {
  rowAndInsert = rowAndInsert.replace(
    "          byte_size?: number | null;\n",
    "          byte_size?: number | null;\n          card_storage_key?: string | null;\n",
  );
}
if (!rowAndInsert.includes("          thumb_storage_key?: string | null;")) {
  rowAndInsert = rowAndInsert.replace(
    "          storage_key: string;\n",
    "          storage_key: string;\n          thumb_storage_key?: string | null;\n",
  );
}
if (!updateAndRest.includes("          card_storage_key?: string | null;")) {
  updateAndRest = updateAndRest.replace(
    "          byte_size?: number | null;\n",
    "          byte_size?: number | null;\n          card_storage_key?: string | null;\n",
  );
}
if (!updateAndRest.includes("          thumb_storage_key?: string | null;")) {
  updateAndRest = updateAndRest.replace(
    "          storage_key?: string;\n",
    "          storage_key?: string;\n          thumb_storage_key?: string | null;\n",
  );
}
block = rowAndInsert + updateAndRest;
types = types.slice(0, start) + block + types.slice(end);
fs.writeFileSync(typesPath, types);

// One-time helper used only on the stage 3 branch.
