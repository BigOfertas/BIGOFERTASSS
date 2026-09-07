import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "supabase/migrations/20260831233500_phase_02_definitive_product_model.sql",
);
const typesPath = path.join(root, "src/integrations/supabase/types.ts");
const productsLibPath = path.join(root, "src/lib/products.ts");

const migration = fs.readFileSync(migrationPath, "utf8");
const types = fs.readFileSync(typesPath, "utf8");
const productsLib = fs.readFileSync(productsLibPath, "utf8");

const checks = [
  ["enum product_status", migration.includes("CREATE TYPE public.product_status")],
  ["SKU de produto", migration.includes("ADD COLUMN IF NOT EXISTS sku text")],
  ["slug de produto", migration.includes("ADD COLUMN IF NOT EXISTS slug text")],
  ["preço promocional", migration.includes("promotional_price numeric(10, 2)")],
  ["peso", migration.includes("weight_grams integer")],
  [
    "dimensões",
    migration.includes("length_cm numeric(10, 2)") &&
      migration.includes("width_cm numeric(10, 2)") &&
      migration.includes("height_cm numeric(10, 2)"),
  ],
  [
    "categorias normalizadas",
    migration.includes("CREATE TABLE IF NOT EXISTS public.categories") &&
      migration.includes("CREATE TABLE IF NOT EXISTS public.product_categories"),
  ],
  ["opções de produto", migration.includes("CREATE TABLE IF NOT EXISTS public.product_options")],
  [
    "valores de opção",
    migration.includes("CREATE TABLE IF NOT EXISTS public.product_option_values"),
  ],
  ["variantes", migration.includes("CREATE TABLE IF NOT EXISTS public.product_variants")],
  [
    "combinações de variante",
    migration.includes("CREATE TABLE IF NOT EXISTS public.product_variant_values"),
  ],
  ["estoque por variante", migration.includes("stock_quantity integer NOT NULL DEFAULT 0")],
  [
    "estoque agregado",
    migration.includes("CREATE OR REPLACE FUNCTION public.refresh_product_stock"),
  ],
  ["imagem opcional", migration.includes("ALTER COLUMN image_url DROP NOT NULL")],
  [
    "sem tabela de imagens antecipada",
    !migration.includes("CREATE TABLE IF NOT EXISTS public.product_images") &&
      !migration.includes("CREATE TABLE public.product_images"),
  ],
  ["tipos de categorias", types.includes("categories: {")],
  ["tipos de variantes", types.includes("product_variants: {")],
  [
    "tipos de status",
    types.includes('product_status: "draft" | "active" | "inactive" | "archived"'),
  ],
  ["preço efetivo no frontend", productsLib.includes("getEffectiveProductPrice")],
  ["catálogo exige status ativo", productsLib.includes('product.status === "active"')],
];

const failed = checks.filter(([, ok]) => !ok);

for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "ERRO"} - ${label}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} validação(ões) falharam.`);
  process.exit(1);
}

console.log(`\nFase 02: ${checks.length} validações estruturais passaram.`);
