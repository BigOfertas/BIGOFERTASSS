import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260901012000_phase_04_scalable_catalog.sql");
const hook = read("src/hooks/useCatalogProducts.ts");
const route = read("src/routes/products.tsx");
const filters = read("src/components/ProductFilters.tsx");
const catalog = read("src/lib/catalog.ts");
const types = read("src/integrations/supabase/types.ts");
const homeRecent = read("src/components/home/BestSellers.tsx");
const homeBrazil = read("src/components/home/BrazilianProducts.tsx");
const homeLeague = read("src/components/home/ShopByLeague.tsx");

const checks = [
  ["migration Fase 04 existe", /Fase 04/.test(migration)],
  ["pg_trgm preparado", /CREATE EXTENSION IF NOT EXISTS pg_trgm/.test(migration)],
  [
    "vetor de busca indexado",
    /catalog_search_vector/.test(migration) &&
      /USING gin \(catalog_search_vector\)/.test(migration),
  ],
  [
    "fallback trigram indexado",
    /products_catalog_search_trgm_idx/.test(migration) && /gin_trgm_ops/.test(migration),
  ],
  [
    "indices de catalogo ativo",
    /products_active_newest_idx/.test(migration) &&
      /products_active_effective_price_idx/.test(migration),
  ],
  [
    "indices de campeonato liga time",
    /products_active_campeonato_idx/.test(migration) &&
      /products_active_liga_idx/.test(migration) &&
      /products_active_time_idx/.test(migration),
  ],
  ["RPC paginada", /CREATE OR REPLACE FUNCTION public\.catalog_products_page/.test(migration)],
  [
    "limite maximo por pagina 48",
    /LEAST\(GREATEST\(COALESCE\(p_page_size, 24\), 1\), 48\)/.test(migration),
  ],
  [
    "RPC retorna somente imagem preferida",
    /LEFT JOIN LATERAL/.test(migration) && /LIMIT 1/.test(migration),
  ],
  [
    "facetas fora da pagina atual",
    /CREATE OR REPLACE FUNCTION public\.catalog_filter_facets/.test(migration),
  ],
  ["facetas possuem contagens", /'count', count/.test(migration)],
  [
    "busca usa RPC e nao select completo",
    /rpc\("catalog_products_page"/.test(hook) && !/\.from\("products"\)/.test(hook),
  ],
  ["facetas usam RPC propria", /rpc\("catalog_filter_facets"/.test(hook)],
  ["react-query preserva pagina durante troca", /keepPreviousData/.test(hook)],
  ["cache curto da pagina", /staleTime: 30_000/.test(hook)],
  ["cache maior das facetas", /5 \* 60_000/.test(hook)],
  ["URL suporta pagina", /page: z\.coerce\.number/.test(route)],
  ["URL suporta ordenacao", /sort: catalogSortSchema/.test(route)],
  ["URL suporta faixa de preco", /minPrice:/.test(route) && /maxPrice:/.test(route)],
  ["UI tem paginação", /Paginação do catálogo/.test(route) && /goToPage/.test(route)],
  ["UI tem tamanho de pagina limitado", /CATALOG_PAGE_SIZES/.test(route)],
  [
    "filtros usam facetas e nao produtos da pagina",
    /facets: CatalogFacets/.test(filters) && !/products: Product\[\]/.test(filters),
  ],
  ["filtros mostram contagem", /item\.count/.test(filters)],
  ["filtro de preco funcional", /applyPrice/.test(filters)],
  ["tipos incluem RPC paginada", /catalog_products_page: \{/.test(types)],
  [
    "tipos incluem campos de indice",
    /catalog_search_text: string/.test(types) && /campeonato_key: string/.test(types),
  ],
  [
    "parser valida resposta da RPC",
    /catalogPageSchema/.test(catalog) && /parseCatalogPage/.test(catalog),
  ],
  ["Home recentes limita consulta", /pageSize: 12/.test(homeRecent)],
  ["Home brasileira filtra no backend", /campeonato: "brasileirao"/.test(homeBrazil)],
  [
    "Home por liga usa facetas",
    /useCatalogFacets/.test(homeLeague) && /liga: activeLeague/.test(homeLeague),
  ],
  ["Fase 04 nao carrega produtos em massa", !/INSERT\s+INTO\s+public\.products/i.test(migration)],
  ["Fase 04 nao cria imagens reais", !/INSERT\s+INTO\s+public\.product_images/i.test(migration)],
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
console.log(
  `${syntaxErrors === 0 ? "PASS" : "FAIL"} - ${sourceFiles.length} TS/TSX sem erro sintatico`,
);
if (syntaxErrors) failed += 1;

if (failed) process.exit(1);
console.log(`\n${checks.length + 1}/${checks.length + 1} validacoes aprovadas.`);
