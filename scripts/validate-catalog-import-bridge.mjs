import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20260908170000_catalog_bulk_import_bridge.sql");
const importer = read("scripts/catalog-import-zip.mjs");
const packageJson = JSON.parse(read("package.json"));

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check(
  "codigo mestre P000XXX e persistido como chave privada",
  migration.includes("ADD COLUMN IF NOT EXISTS catalog_code text") &&
    migration.includes("products_catalog_code_uidx") &&
    migration.includes("^P[0-9]{6}$"),
);
check(
  "variacoes e imagens possuem chaves estaveis para reimportacao",
  migration.includes("catalog_variant_code") &&
    migration.includes("catalog_source_key") &&
    migration.includes("catalog_source_sha256"),
);
check(
  "RPCs de importacao exigem owner",
  [
    "owner_catalog_import_upsert_category",
    "owner_catalog_import_upsert_product",
    "owner_catalog_import_upsert_variant",
    "owner_catalog_import_image_state",
    "owner_catalog_import_finalize_image",
    "owner_catalog_import_set_product_status",
  ].every((name) => migration.includes(`public.${name}`)) &&
    migration.match(/auth\.uid\(\) IS NULL OR NOT public\.has_role\('owner'/g)?.length >= 6,
);
check(
  "ativacao pelo importador exige preco imagem e variacao",
  migration.includes("Produto sem preço válido não pode ser ativado") &&
    migration.includes("Produto sem imagem pronta não pode ser ativado") &&
    migration.includes("Produto sem variação ativa não pode ser ativado"),
);
check(
  "importador usa fluxo oficial de presign e complete do R2",
  importer.includes('client.invoke("r2-image-presign"') &&
    importer.includes('client.invoke("r2-image-complete"') &&
    importer.includes("derivativeUploads") &&
    importer.includes("owner_catalog_import_finalize_image"),
);
check(
  "importador e seguro por padrao com dry-run e apply explicito",
  importer.includes("Por padrao o comando SOMENTE valida") &&
    importer.includes("if (!options.apply)") &&
    importer.includes("Nenhum dado foi alterado") &&
    importer.includes('arg === "--apply"'),
);
check(
  "importador aceita os tres CSVs definitivos do acervo",
  importer.includes('findControlFile(inputRoot, "produtos.csv")') &&
    importer.includes('findControlFile(inputRoot, "variacoes.csv")') &&
    importer.includes('findControlFile(inputRoot, "imagens.csv")'),
);
check(
  "package expoe comandos de importacao e validacao",
  packageJson.scripts?.["catalog:import"] === "node scripts/catalog-import-zip.mjs" &&
    packageJson.scripts?.["validate:catalog-import"] === "node scripts/validate-catalog-import-bridge.mjs",
);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bigofertas-import-validation-"));
try {
  const catalog = path.join(temp, "CATALOGO_TESTE");
  const control = path.join(catalog, "controle");
  const productDir = path.join(
    catalog,
    "CAMISA",
    "PENDENTE - CAMPEONATO",
    "P999999 - CAMISA I TESTE 26-27 ADIDAS",
  );
  fs.mkdirSync(path.join(productDir, "versao-01"), { recursive: true });
  fs.mkdirSync(path.join(productDir, "versao-02"), { recursive: true });
  fs.mkdirSync(control, { recursive: true });

  fs.writeFileSync(
    path.join(control, "produtos.csv"),
    [
      "codigo,nome,campeonato,time,temporada,tipo_produto,quantidade_variacoes,quantidade_imagens,imagem_principal,observacoes,confianca",
      "P999999,CAMISA I TESTE 26/27 ADIDAS,PENDENTE - CAMPEONATO,TESTE,26/27,CAMISA,2,2,versao-01/principal.webp,,ALTA",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(control, "variacoes.csv"),
    [
      "codigo_produto,variacao,nome_descricao,quantidade_imagens,principal,observacoes,confianca",
      "P999999,versao-01,,1,principal.webp,,ALTA",
      "P999999,versao-02,,1,principal.webp,,ALTA",
    ].join("\n"),
  );
  const p1 =
    "CAMISA/PENDENTE - CAMPEONATO/P999999 - CAMISA I TESTE 26-27 ADIDAS/versao-01/principal.webp";
  const p2 =
    "CAMISA/PENDENTE - CAMPEONATO/P999999 - CAMISA I TESTE 26-27 ADIDAS/versao-02/principal.webp";
  fs.writeFileSync(
    path.join(control, "imagens.csv"),
    [
      "codigo_produto,variacao,arquivo_final,ordem,principal,arquivo_origem,parte_origem,pasta_origem",
      `P999999,versao-01,${p1},1,SIM,a.webp,teste.zip,origem`,
      `P999999,versao-02,${p2},1,SIM,b.webp,teste.zip,origem`,
    ].join("\n"),
  );
  fs.writeFileSync(path.join(productDir, "versao-01", "principal.webp"), "fake-webp-a");
  fs.writeFileSync(path.join(productDir, "versao-02", "principal.webp"), "fake-webp-b");

  const run = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/catalog-import-zip.mjs"),
      catalog,
      "--competition",
      "MUNDO FIFA",
      "--default-price",
      "149.90",
      "--default-stock",
      "50",
    ],
    { encoding: "utf8" },
  );

  check(
    "dry-run real reconhece produto variacoes e imagens sem rede",
    run.status === 0 &&
      run.stdout.includes("Produtos: 1") &&
      run.stdout.includes("Variacoes: 2") &&
      run.stdout.includes("Imagens: 2") &&
      run.stdout.includes("Nenhum dado foi alterado"),
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

if (failed) process.exit(1);
console.log(`\n${checks.length}/${checks.length} validacoes da ponte de importacao aprovadas.`);
