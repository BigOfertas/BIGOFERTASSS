import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DEFAULT_PREFIX = "incoming/catalogo/";
const DEFAULT_ARTIFACT_DIR = ".artifacts/r2-catalog-bridge";

function fail(message, code = 1) {
  console.error(`ERRO: ${message}`);
  process.exit(code);
}

function text(value) {
  return String(value ?? "").trim();
}

function loadDotEnv(file = ".env") {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(argv) {
  const options = {
    action: "list",
    key: null,
    prefix: DEFAULT_PREFIX,
    competition: null,
    league: null,
    defaultPrice: null,
    defaultStock: null,
    imageConcurrency: null,
    activate: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--action") options.action = text(argv[++i]).toLowerCase();
    else if (arg === "--key") options.key = text(argv[++i]);
    else if (arg === "--prefix") options.prefix = text(argv[++i]);
    else if (arg === "--competition") options.competition = text(argv[++i]);
    else if (arg === "--league") options.league = text(argv[++i]);
    else if (arg === "--default-price") options.defaultPrice = text(argv[++i]);
    else if (arg === "--default-stock") options.defaultStock = text(argv[++i]);
    else if (arg === "--image-concurrency") options.imageConcurrency = text(argv[++i]);
    else if (arg === "--activate") options.activate = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`\nUso:\n  node scripts/r2-catalog-bridge.mjs --action list\n  node scripts/r2-catalog-bridge.mjs --action analyze --key incoming/catalogo/ARQUIVO.zip\n  node scripts/r2-catalog-bridge.mjs --action import --key incoming/catalogo/ARQUIVO.zip [opcoes]\n\nAcoes:\n  list      lista ZIPs no prefixo de entrada do R2\n  analyze   baixa um ZIP do R2 e executa o importador em dry-run\n  import    baixa um ZIP do R2 e executa o importador com --apply\n\nOpcoes repassadas ao importador:\n  --competition \"MUNDO FIFA\"\n  --league \"SELECOES\"\n  --default-price 149.90\n  --default-stock 999\n  --image-concurrency 4\n  --activate\n\nVariaveis obrigatorias para acessar o R2:\n  R2_ACCESS_KEY_ID\n  R2_SECRET_ACCESS_KEY\n  R2_ENDPOINT\n  R2_BUCKET\n\nPara import, o catalog-import-zip.mjs tambem exige autenticacao de owner do Supabase.\n`);
      process.exit(0);
    } else {
      fail(`Opcao desconhecida: ${arg}`);
    }
  }

  if (!["list", "analyze", "import"].includes(options.action)) {
    fail(`Acao invalida: ${options.action}. Use list, analyze ou import.`);
  }
  if (!options.prefix || options.prefix.startsWith("/") || options.prefix.includes("..")) {
    fail("Prefixo R2 invalido.");
  }
  if (!options.prefix.endsWith("/")) options.prefix += "/";
  if (options.action !== "list" && !options.key) fail("Informe --key para analyze/import.");
  return options;
}

function requireEnvironment(name) {
  const value = text(process.env[name]);
  if (!value) fail(`Variavel obrigatoria ausente: ${name}`);
  return value;
}

function validateEndpoint(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail("R2_ENDPOINT invalido.");
  }
  if (url.protocol !== "https:") fail("R2_ENDPOINT precisa usar HTTPS.");
  return url.toString().replace(/\/$/, "");
}

function validateObjectKey(key, prefix) {
  const normalized = text(key).replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.startsWith(prefix)) {
    fail(`Por seguranca, o ZIP precisa estar dentro de ${prefix}`);
  }
  if (normalized.split("/").some((part) => part === "..")) fail("Object key insegura.");
  if (!normalized.toLowerCase().endsWith(".zip")) fail("O objeto selecionado precisa ser um ZIP.");
  return normalized;
}

function aws(endpoint, args, options = {}) {
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: requireEnvironment("R2_ACCESS_KEY_ID"),
    AWS_SECRET_ACCESS_KEY: requireEnvironment("R2_SECRET_ACCESS_KEY"),
    AWS_DEFAULT_REGION: "auto",
    AWS_REGION: "auto",
  };
  return execFileSync("aws", ["--endpoint-url", endpoint, ...args], {
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
    env,
  });
}

function listIncoming(endpoint, bucket, prefix) {
  const output = aws(endpoint, [
    "s3api",
    "list-objects-v2",
    "--bucket",
    bucket,
    "--prefix",
    prefix,
    "--output",
    "json",
  ]);
  const payload = JSON.parse(output || "{}");
  const objects = (payload.Contents ?? [])
    .filter((item) => text(item.Key).toLowerCase().endsWith(".zip"))
    .map((item) => ({
      key: item.Key,
      bytes: item.Size,
      megabytes: Math.round((Number(item.Size ?? 0) / 1024 / 1024) * 100) / 100,
      lastModified: item.LastModified,
      etag: text(item.ETag).replaceAll('"', ""),
    }));

  console.log(`\nZIPs encontrados em r2://${bucket}/${prefix}: ${objects.length}\n`);
  for (const object of objects) {
    console.log(`- ${object.key} (${object.megabytes} MB) | ${object.lastModified ?? "sem data"}`);
  }
  return objects;
}

function sha256(file) {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(file, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureImportAuthentication() {
  const hasToken = Boolean(text(process.env.CATALOG_IMPORT_OWNER_ACCESS_TOKEN));
  const hasCredentials =
    Boolean(text(process.env.CATALOG_IMPORT_OWNER_EMAIL)) &&
    Boolean(text(process.env.CATALOG_IMPORT_OWNER_PASSWORD));
  if (!hasToken && !hasCredentials) {
    fail(
      "Importacao bloqueada: configure CATALOG_IMPORT_OWNER_ACCESS_TOKEN ou CATALOG_IMPORT_OWNER_EMAIL + CATALOG_IMPORT_OWNER_PASSWORD nos GitHub Secrets.",
    );
  }
}

function runImporter(zipFile, options, reportFile) {
  if (options.action === "import") ensureImportAuthentication();

  const args = ["scripts/catalog-import-zip.mjs", zipFile, "--report", reportFile];
  if (options.action === "import") args.push("--apply");
  if (options.activate) args.push("--activate");
  if (options.competition) args.push("--competition", options.competition);
  if (options.league) args.push("--league", options.league);
  if (options.defaultPrice) args.push("--default-price", options.defaultPrice);
  if (options.defaultStock) args.push("--default-stock", options.defaultStock);
  if (options.imageConcurrency) args.push("--image-concurrency", options.imageConcurrency);

  console.log(`\nExecutando catalog-import-zip em modo ${options.action === "import" ? "APPLY" : "DRY-RUN"}...\n`);
  execFileSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
}

loadDotEnv();
const options = parseArgs(process.argv.slice(2));
const endpoint = validateEndpoint(requireEnvironment("R2_ENDPOINT"));
const bucket = requireEnvironment("R2_BUCKET");
const artifactDir = path.resolve(text(process.env.R2_BRIDGE_ARTIFACT_DIR) || DEFAULT_ARTIFACT_DIR);
fs.mkdirSync(artifactDir, { recursive: true });

if (options.action === "list") {
  const objects = listIncoming(endpoint, bucket, options.prefix);
  writeJson(path.join(artifactDir, "r2-list.json"), {
    generatedAt: new Date().toISOString(),
    bucket,
    prefix: options.prefix,
    count: objects.length,
    objects,
  });
  process.exit(0);
}

const objectKey = validateObjectKey(options.key, options.prefix);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "bigofertas-r2-catalog-"));
const localZip = path.join(temporary, path.basename(objectKey));
const safeReportName = path.basename(objectKey, path.extname(objectKey)).replace(/[^A-Za-z0-9._-]+/g, "-");
const importerReport = path.join(artifactDir, `${safeReportName}-${options.action}-importer.json`);
const bridgeReport = path.join(artifactDir, `${safeReportName}-${options.action}-bridge.json`);

try {
  console.log(`Baixando r2://${bucket}/${objectKey}...`);
  aws(
    endpoint,
    ["s3", "cp", `s3://${bucket}/${objectKey}`, localZip, "--only-show-errors"],
    { stdio: "inherit" },
  );

  const stats = fs.statSync(localZip);
  const digest = sha256(localZip);
  console.log(`ZIP recebido: ${(stats.size / 1024 / 1024).toFixed(2)} MB | sha256 ${digest}`);

  execFileSync("unzip", ["-tq", localZip], { stdio: "inherit" });

  const startedAt = new Date().toISOString();
  runImporter(localZip, options, importerReport);
  const completedAt = new Date().toISOString();

  writeJson(bridgeReport, {
    status: "success",
    action: options.action,
    source: {
      bucket,
      key: objectKey,
      bytes: stats.size,
      sha256: digest,
    },
    startedAt,
    completedAt,
    importerReport: path.basename(importerReport),
    activate: options.activate,
    competition: options.competition,
    league: options.league,
  });

  console.log(`\nPonte R2 concluida com sucesso. Relatorio: ${bridgeReport}`);
} catch (error) {
  writeJson(bridgeReport, {
    status: "failed",
    action: options.action,
    source: { bucket, key: objectKey },
    failedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
