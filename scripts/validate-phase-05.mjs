import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const route = read("src/routes/product/$id.tsx");
const detail = read("src/lib/product-detail.ts");
const images = read("src/lib/product-images.ts");
const gallery = read("src/components/product/ProductGallery.tsx");
const seo = read("src/components/product/ProductSeo.tsx");
const card = read("src/components/product/ProductCard.tsx");
const cart = read("src/context/CartContext.tsx");
const migrationNames = fs.readdirSync(path.join(root, "supabase", "migrations"));
const allMigrations = migrationNames
  .map((file) => read(path.join("supabase", "migrations", file)))
  .join("\n");

const checks = [
  ["produto aceita slug ou UUID legado", /UUID_PATTERN/.test(detail) && /\.eq\("slug", normalizedIdentifier\)/.test(detail)],
  ["somente produto ativo pode abrir", /\.eq\("status", "active"\)/.test(detail)],
  ["detalhe carrega galeria R2", /from\("product_images"\)/.test(detail) && /status", "ready"/.test(detail)],
  ["detalhe carrega opcoes", /from\("product_options"\)/.test(detail)],
  ["detalhe carrega valores de opcoes", /from\("product_option_values"\)/.test(detail)],
  ["detalhe carrega variantes ativas", /from\("product_variants"\)/.test(detail) && /status", "active"/.test(detail)],
  ["detalhe carrega combinacoes de variante", /from\("product_variant_values"\)/.test(detail)],
  ["preco efetivo respeita override", /getVariantBasePrice/.test(detail) && /getVariantPromotionalPrice/.test(detail)],
  ["selecao resolve variante real", /findVariantForSelection/.test(detail)],
  ["combinacoes impossiveis sao detectadas", /isValueCompatibleWithSelection/.test(detail)],
  ["galeria prioriza variante selecionada", /selectedVariantImages/.test(images) && /selectedVariantImages\.length > 0/.test(images)],
  ["galeria mantem fallback legado", /product\.image_url/.test(images) && /legacy-image/.test(images)],
  ["componente de galeria tem thumbnails", /images\.length > 1/.test(gallery) && /aria-pressed/.test(gallery)],
  ["falha de imagem tem fallback", /markFailed/.test(gallery) && /Imagem indisponível/.test(gallery)],
  ["pagina exibe breadcrumbs", /aria-label="Breadcrumb"/.test(route) && /detail\.category\.slug/.test(route)],
  ["pagina exibe opcoes dinamicas", /detail\.options\.map/.test(route) && /option\.values\.map/.test(route)],
  ["pagina usa estoque da variante", /selectedVariant\?\.stock_quantity/.test(route)],
  ["pagina troca preco pela variante", /getVariantEffectivePrice/.test(route)],
  ["pagina limita quantidade pelo estoque", /Math\.min\(stock/.test(route)],
  ["pagina exibe especificacoes estruturadas", /Especificações/.test(route) && /weight_grams/.test(route) && /Dimensões/.test(route)],
  ["produtos relacionados usam catalogo paginado", /catalog_products_page/.test(detail) && /fetchRelatedProducts/.test(route)],
  ["produto relacionado exclui o atual", /item\.id !== product\.id/.test(detail)],
  ["cards usam slug quando disponivel", /params=\{\{ id: slug \|\| id \}\}/.test(card)],
  ["SEO atualiza title e description", /document\.title/.test(seo) && /meta\[name="description"\]/.test(seo)],
  ["SEO inclui canonical", /rel=\\?"canonical/.test(seo) || /link\[rel="canonical"\]/.test(seo)],
  ["SEO inclui Open Graph de produto", /og:title/.test(seo) && /og:image/.test(seo) && /content: "product"/.test(seo)],
  ["SEO inclui JSON-LD Product Offer", /schema\.org/.test(seo) && /"@type": "Product"/.test(seo) && /"@type": "Offer"/.test(seo)],
  ["metadata e restaurada ao sair", /cleanups\.reverse\(\)/.test(seo)],
  [
    "carrinho com variantes so aparece quando a Fase 06 existe",
    migrationNames.includes("20260901031000_phase_06_definitive_cart_validation.sql")
      ? /variantId|variant_id|selectedOptions/.test(cart)
      : !/variantId|variant_id|selectedOptions/.test(cart),
  ],
  ["Fase 05 nao carrega produtos em massa", !/Fase 05[\s\S]*INSERT\s+INTO\s+public\.products/i.test(allMigrations)],
  ["Fase 05 nao carrega imagens reais", !/Fase 05[\s\S]*INSERT\s+INTO\s+public\.product_images/i.test(allMigrations)],
  ["Fase 05 nao altera a conexao Supabase existente", read(".env").includes("VITE_SUPABASE_URL=") && read(".env").includes("VITE_SUPABASE_PUBLISHABLE_KEY=")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk(path.join(root, "src"));
walk(path.join(root, "supabase", "functions"));

let syntaxErrors = 0;
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
    reportDiagnostics: true,
    fileName: file,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length) {
    syntaxErrors += errors.length;
    console.error(`SYNTAX FAIL - ${path.relative(root, file)}`);
    for (const error of errors) {
      console.error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
    }
  }
}
console.log(`${syntaxErrors === 0 ? "PASS" : "FAIL"} - ${sourceFiles.length} TS/TSX sem erro sintatico`);
if (syntaxErrors) failed += 1;

if (failed) process.exit(1);
console.log(`\n${checks.length + 1}/${checks.length + 1} validacoes aprovadas.`);
