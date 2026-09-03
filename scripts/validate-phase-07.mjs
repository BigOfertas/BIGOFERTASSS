import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const adminRoute = read("src/routes/admin.tsx");
const adminUi = read("src/components/admin/ProductAdmin.tsx");
const adminLib = read("src/lib/admin-products.ts");
const taxonomy = read("src/lib/product-taxonomy.ts");
const auth = read("src/lib/auth.tsx");
const phase02 = read(
  "supabase/migrations/20260831233500_phase_02_definitive_product_model.sql",
);
const phase07Identity = read(
  "supabase/migrations/20260901183000_phase_07_product_identity_pool.sql",
);

const checks = [
  [
    "rota admin permanece protegida por owner",
    /isOwner/.test(adminRoute) && /to: "\/login"/.test(adminRoute),
  ],
  [
    "papel owner continua vindo de user_roles",
    /from\("user_roles"\)/.test(auth) && /role === "owner"/.test(auth),
  ],
  [
    "painel carrega administracao de produtos",
    /<ProductAdmin\s*\/>/.test(adminRoute),
  ],
  [
    "administracao lista produtos sem RPC publica de catalogo",
    /from\("products"\)/.test(adminLib) && /limit\(500\)/.test(adminLib),
  ],
  [
    "administracao lista categorias normalizadas",
    /from\("categories"\)/.test(adminLib) && /primary_category_id/.test(adminLib),
  ],
  [
    "produto novo nasce em rascunho",
    /status: "draft"/.test(adminLib),
  ],
  [
    "produto novo ganha variante padrao",
    /from\("product_variants"\)\.insert/.test(adminLib) &&
      /is_default: true/.test(adminLib),
  ],
  [
    "estoque e salvo na variante",
    /stock_quantity: input\.stockQuantity/.test(adminLib),
  ],
  [
    "administracao nao atualiza products.stock diretamente",
    !/\.update\(\{[^}]*stock:/s.test(adminLib),
  ],
  [
    "produto ativo depende de variante ativa no banco",
    /Produto so pode ser ativado quando possuir ao menos uma variante ativa/.test(
      phase02,
    ),
  ],
  [
    "produto pode ser arquivado sem exclusao fisica pela interface",
    /status: "archived"/.test(adminLib) && /Arquivar/.test(adminUi),
  ],
  [
    "pool de identificadores mantem reservas para produtos futuros",
    /CREATE TABLE IF NOT EXISTS public\.product_identity_slots/.test(
      phase07Identity,
    ) && /ensure_product_identity_pool\(20\)/.test(phase07Identity),
  ],
  [
    "somente owner pode alocar identificadores",
    /allocate_product_identity/.test(phase07Identity) &&
      /has_role\('owner'::public\.app_role\)/.test(phase07Identity),
  ],
  [
    "sku slug e sku da variante continuam automaticos",
    /allocateProductIdentity/.test(adminLib) &&
      /sku: identity\.product_sku/.test(adminLib) &&
      /slug: identity\.product_slug/.test(adminLib) &&
      /sku: identity\.default_variant_sku/.test(adminLib),
  ],
  [
    "formulario nao expoe identificadores tecnicos",
    !/SKU do produto|SKU da variante|Reserva atribuída ao criar|Fase 07/.test(adminUi),
  ],
  [
    "formulario inclui precificacao e situacao",
    /Preço promocional/.test(adminUi) && /Situação/.test(adminUi),
  ],
  [
    "classificacao esportiva usa selecoes controladas",
    /PRODUCT_CONTEXT_OPTIONS/.test(adminUi) &&
      /getCompetitionOptionsForContext/.test(adminUi) &&
      /Time \/ seleção/.test(adminUi) &&
      /Temporada/.test(adminUi) &&
      /<select/.test(adminUi),
  ],
  [
    "taxonomia contem ligas campeonatos e selecoes canonicas",
    /La Liga/.test(taxonomy) &&
      /Premier League/.test(taxonomy) &&
      /Champions League/.test(taxonomy) &&
      /Copa do Mundo/.test(taxonomy) &&
      /Real Madrid/.test(taxonomy) &&
      /Brasil/.test(taxonomy),
  ],
  [
    "competicao decide campo interno sem digitacao livre",
    /storageField: "liga"/.test(taxonomy) &&
      /storageField: "campeonato"/.test(taxonomy) &&
      /if \(storageField === "liga"\) liga = form\.competition/.test(adminUi),
  ],
  [
    "temporada e armazenada sem nova tabela",
    /mergeSeasonIntoSpecifications/.test(adminUi) &&
      /Temporada:/.test(taxonomy),
  ],
  [
    "formulario inclui peso e dimensoes",
    /Peso \(g\)/.test(adminUi) && /Comprimento \(cm\)/.test(adminUi),
  ],
  [
    "carga definitiva de imagens continua separada",
    /fotos do produto serão adicionadas na etapa de imagens do catálogo/i.test(adminUi),
  ],
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
