import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260901001500_phase_03_r2_image_infrastructure.sql");
const types = read("src/integrations/supabase/types.ts");
const imageLib = read("src/lib/product-images.ts");
const hook = read("src/hooks/useCatalogProducts.ts");
const phase4Migration = fs.existsSync(
  path.join(root, "supabase/migrations/20260901012000_phase_04_scalable_catalog.sql"),
)
  ? read("supabase/migrations/20260901012000_phase_04_scalable_catalog.sql")
  : "";
const envExample = read(".env.example");
const functionEnv = read("supabase/functions/.env.example");
const config = read("supabase/config.toml");
const cors = JSON.parse(read("cloudflare/r2-cors.example.json"));

const checks = [
  [
    "migration cria product_images",
    /CREATE TABLE IF NOT EXISTS public\.product_images/.test(migration),
  ],
  ["migration nao insere produtos", !/INSERT\s+INTO\s+public\.products/i.test(migration)],
  [
    "status de imagem preparado",
    /product_image_status/.test(migration) &&
      /'pending'.*'ready'.*'failed'.*'archived'/s.test(migration),
  ],
  ["storage_key e unico", /product_images_storage_key_unique/.test(migration)],
  ["principal por produto e unica", /product_images_one_primary_per_product/.test(migration)],
  ["principal por variante e unica", /product_images_one_primary_per_variant/.test(migration)],
  [
    "RLS publica somente ready",
    /product_images_public_read_ready/.test(migration) && /status = 'ready'/.test(migration),
  ],
  [
    "owner controla escrita",
    /product_images_owner_all/.test(migration) && /has_role\('owner'/.test(migration),
  ],
  ["RPC atomica de imagem principal", /set_primary_product_image/.test(migration)],
  [
    "tipos incluem product_images",
    /product_images: \{/.test(types) && /product_image_status/.test(types),
  ],
  [
    "frontend deriva URL por base R2",
    /VITE_R2_PUBLIC_BASE_URL/.test(imageLib) && /storage_key/.test(imageLib),
  ],
  ["frontend mantem fallback legado", /product\.image_url/.test(imageLib)],
  [
    "catalogo resolve product_images",
    (/from\("product_images"\)/.test(hook) && /attachProductImages/.test(hook)) ||
      (/catalog_products_page/.test(hook) &&
        /FROM public\.product_images/.test(phase4Migration) &&
        /LIMIT 1/.test(phase4Migration)),
  ],
  ["segredos R2 nao usam VITE", !/VITE_R2_(ACCOUNT|ACCESS|SECRET|BUCKET)/.test(functionEnv)],
  ["base publica R2 esta no env publico", /VITE_R2_PUBLIC_BASE_URL=/.test(envExample)],
  [
    "Edge Functions exigem JWT",
    /\[functions\.r2-image-presign\][\s\S]*verify_jwt = true/.test(config) &&
      /\[functions\.r2-image-complete\][\s\S]*verify_jwt = true/.test(config),
  ],
  [
    "CORS inclui PUT e ETag",
    Array.isArray(cors) &&
      cors[0]?.AllowedMethods?.includes("PUT") &&
      cors[0]?.ExposeHeaders?.includes("ETag"),
  ],
  [
    "presign cria registro pending",
    /status: "pending"/.test(read("supabase/functions/r2-image-presign/index.ts")),
  ],
  [
    "complete verifica R2 com HEAD",
    /headProductImage/.test(read("supabase/functions/r2-image-complete/index.ts")),
  ],
  [
    "nenhuma credencial R2 no src",
    !fs
      .readdirSync(path.join(root, "src"), { recursive: true })
      .filter(String)
      .some(
        (name) =>
          typeof name === "string" &&
          /\.(ts|tsx)$/.test(name) &&
          /R2_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|ACCOUNT_ID)/.test(
            fs.readFileSync(path.join(root, "src", name), "utf8"),
          ),
      ),
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
    (d) => d.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length) {
    syntaxErrors += errors.length;
    console.error(`SYNTAX FAIL - ${path.relative(root, file)}`);
  }
}
console.log(
  `${syntaxErrors === 0 ? "PASS" : "FAIL"} - ${sourceFiles.length} TS/TSX sem erro sintatico`,
);
if (syntaxErrors) failed += 1;

if (failed) process.exit(1);
console.log(`\n${checks.length + 1}/${checks.length + 1} validacoes aprovadas.`);
