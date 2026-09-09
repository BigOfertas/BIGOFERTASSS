import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { buildCatalogBusinessProfile, inferCommercialType, resolveCommercialPrice } from "./catalog-business-rules.mjs";

const PRODUCT_CODE_RE = /^P\d{6}$/;
const DEFAULT_IMAGE_CONCURRENCY = 4;
const MAX_IMAGE_CONCURRENCY = 8;
const MAIN_MAX_EDGE = 1800;
const CARD_MAX_EDGE = 760;
const THUMB_MAX_EDGE = 280;

function fail(message, code = 1) {
  console.error(`ERRO: ${message}`);
  process.exit(code);
}

function text(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function slugify(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseNumber(value) {
  const raw = text(value).replace(/\./g, "").replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  const parsed = Number.parseInt(text(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function isYes(value) {
  return ["SIM", "S", "YES", "TRUE", "1"].includes(normalize(value));
}

function parseArgs(argv) {
  const options = {
    input: null,
    apply: false,
    activate: false,
    competition: null,
    league: null,
    defaultPrice: null,
    defaultStock: null,
    imageConcurrency: DEFAULT_IMAGE_CONCURRENCY,
    report: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--") && !options.input) {
      options.input = arg;
      continue;
    }
    if (arg === "--apply") options.apply = true;
    else if (arg === "--activate") options.activate = true;
    else if (arg === "--competition") options.competition = argv[++i] ?? null;
    else if (arg === "--league") options.league = argv[++i] ?? null;
    else if (arg === "--default-price") options.defaultPrice = parseNumber(argv[++i]);
    else if (arg === "--default-stock") options.defaultStock = parseInteger(argv[++i]);
    else if (arg === "--image-concurrency") {
      options.imageConcurrency = Math.min(
        MAX_IMAGE_CONCURRENCY,
        Math.max(1, parseInteger(argv[++i]) ?? DEFAULT_IMAGE_CONCURRENCY),
      );
    } else if (arg === "--report") options.report = argv[++i] ?? null;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        `\nUso:\n  node scripts/catalog-import-zip.mjs <catalogo.zip|pasta> [opcoes]\n\nPor padrao o comando SOMENTE valida e mostra a previa.\n\nOpcoes:\n  --apply                 grava no Supabase/R2\n  --activate              ativa os produtos depois das imagens (exige preco > 0)\n  --competition "MUNDO FIFA"  substitui campeonato/competicao do CSV\n  --league "PREMIER LEAGUE"   define liga\n  --default-price 149.90  preco usado quando o CSV nao possui preco\n  --default-stock 999      estoque usado quando o CSV nao possui estoque\n  --image-concurrency 4    uploads simultaneos por produto (1-8)\n  --report arquivo.json    caminho do relatorio JSON\n\nCredenciais para --apply:\n  VITE_SUPABASE_URL ou SUPABASE_URL\n  VITE_SUPABASE_PUBLISHABLE_KEY ou SUPABASE_PUBLISHABLE_KEY\n  e uma das opcoes:\n    CATALOG_IMPORT_OWNER_ACCESS_TOKEN\n    ou CATALOG_IMPORT_OWNER_EMAIL + CATALOG_IMPORT_OWNER_PASSWORD\n`,
      );
      process.exit(0);
    } else {
      fail(`Opcao desconhecida: ${arg}`);
    }
  }

  if (!options.input) fail("Informe o ZIP final do catalogo ou a pasta extraida.");
  if (options.activate && !options.apply) fail("--activate so pode ser usado junto com --apply.");
  return options;
}

function parseCsv(content) {
  const source = content.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => text(header));
  return rows
    .slice(1)
    .filter((values) => values.some((value) => text(value)))
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
    );
}

function findFiles(root, predicate, results = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) findFiles(full, predicate, results);
    else if (entry.isFile() && predicate(full)) results.push(full);
  }
  return results;
}

function safeZipEntries(zipPath) {
  let output;
  try {
    output = execFileSync("unzip", ["-Z1", zipPath], {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    fail("Nao foi possivel ler o ZIP. O comando 'unzip' precisa estar disponivel neste ambiente.");
  }
  const entries = output.split(/\r?\n/).filter(Boolean);
  for (const entry of entries) {
    const normalized = entry.replaceAll("\\", "/");
    if (
      normalized.startsWith("/") ||
      /^[A-Za-z]:\//.test(normalized) ||
      normalized.split("/").some((part) => part === "..")
    ) {
      fail(`ZIP rejeitado por conter caminho inseguro: ${entry}`);
    }
  }
}

function prepareInput(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) fail(`Arquivo/pasta nao encontrado: ${resolved}`);
  if (fs.statSync(resolved).isDirectory()) return { root: resolved, cleanup: () => undefined };
  if (path.extname(resolved).toLowerCase() !== ".zip") {
    fail("O importador aceita ZIP ou uma pasta ja extraida.");
  }

  safeZipEntries(resolved);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "bigofertas-catalog-import-"));
  try {
    execFileSync("unzip", ["-q", resolved, "-d", temporary], { stdio: "inherit" });
  } catch {
    fs.rmSync(temporary, { recursive: true, force: true });
    fail("Falha ao extrair o ZIP.");
  }
  return {
    root: temporary,
    cleanup: () => fs.rmSync(temporary, { recursive: true, force: true }),
  };
}

function findControlFile(root, filename) {
  const matches = findFiles(
    root,
    (file) => path.basename(file).toLowerCase() === filename.toLowerCase(),
  );
  if (matches.length !== 1) {
    fail(`Esperado exatamente um ${filename}; encontrados: ${matches.length}.`);
  }
  return matches[0];
}

function commonCatalogRoot(controlFile) {
  const controlDir = path.dirname(controlFile);
  return path.basename(controlDir).toLowerCase() === "controle"
    ? path.dirname(controlDir)
    : path.dirname(controlFile);
}

function resolveCatalogImage(catalogRoot, relativePath) {
  const normalized = text(relativePath).replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "..")) return null;
  const direct = path.resolve(catalogRoot, ...segments);
  if (direct.startsWith(path.resolve(catalogRoot) + path.sep) && fs.existsSync(direct))
    return direct;

  const suffix = segments.join(path.sep).toLowerCase();
  const matches = findFiles(catalogRoot, (file) => file.toLowerCase().endsWith(suffix));
  return matches.length === 1 ? matches[0] : null;
}

function inferBrand(name, explicit = "") {
  if (text(explicit)) return text(explicit).toUpperCase();
  const normalized = normalize(name);
  const brands = [
    "NEW BALANCE",
    "UNDER ARMOUR",
    "ADIDAS",
    "NIKE",
    "JORDAN",
    "PUMA",
    "UMBRO",
    "KAPPA",
    "MACRON",
    "CASTORE",
    "JOMA",
    "MIZUNO",
    "LOTTO",
    "REEBOK",
  ];
  return brands.find((brand) => normalized.includes(brand)) ?? "";
}

function inferAudience(product) {
  const source = normalize(`${product.nome} ${product.tipo_produto} ${product.publico ?? ""}`);
  if (/\b(INFANTIL|KIDS?|CRIANCA)\b/.test(source)) return "KIDS";
  if (/\bFEMININ[AO]\b/.test(source)) return "FEMININO";
  return "MASCULINO";
}

function inferLegacyCommercialType(product) {
  const source = normalize(`${product.nome} ${product.tipo_produto}`);
  if (/\b(RETRO|RETRÔ)\b/.test(source)) return "retro";
  if (/\b(INFANTIL|KIDS?)\b/.test(source)) return "infantil";
  if (/\b(PLAYER|JOGADOR)\b/.test(source)) return "jogador";
  if (/\b(BASQUETE|NBA|BASKET)\b/.test(source)) return "basquete";
  if (/\b(SHORT|SHORTS|CALCAO|CALÇÃO)\b/.test(source)) return "calcao";
  if (/\bFEMININ[AO]\b/.test(source)) return "feminino";
  if (/\bCAMISA\b/.test(source)) return "torcedor";
  return "other";
}

function inferCategory(product) {
  const source = normalize(`${product.tipo_produto} ${product.nome}`);
  if (/\b(KIT INFANTIL|CONJUNTO INFANTIL|KIDS?)\b/.test(source)) {
    return { name: "Kids", slug: "infantil" };
  }
  if (/\b(KIT DE TREINO|KIT TREINO|CONJUNTO DE TREINO|TREINO|VIAGEM)\b/.test(source)) {
    return { name: "Kits de treino", slug: "kit-treino" };
  }
  if (/\b(SHORT|SHORTS|CALCAO|CALÇÃO)\b/.test(source)) {
    return { name: "Shorts", slug: "shorts" };
  }
  if (/\b(BASQUETE|NBA|BASKET|REGATA)\b/.test(source)) {
    return { name: "Basquete / NBA", slug: "basquete" };
  }
  if (/\b(CORTA VENTO|CORTA-VENTO|WINDBREAKER)\b/.test(source)) {
    return { name: "Corta-vento", slug: "corta-ventos" };
  }
  if (/\b(RETRO|RETRÔ)\b/.test(source)) {
    return { name: "Camisas retrô", slug: "retro" };
  }
  if (/\bCAMISA\b/.test(source)) return { name: "Camisas", slug: "camisas" };
  const fallback = text(product.tipo_produto) || "Outros";
  return { name: fallback, slug: slugify(fallback) || "outros" };
}

function variationLabel(code, description) {
  if (text(description)) return text(description);
  const match = text(code).match(/(\d+)$/);
  return match ? `Versão ${match[1].padStart(2, "0")}` : text(code) || "Versão";
}

function mimeFromPath(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  return null;
}

function loadPlan(inputRoot, options) {
  const productsFile = findControlFile(inputRoot, "produtos.csv");
  const variationsFile = findControlFile(inputRoot, "variacoes.csv");
  const imagesFile = findControlFile(inputRoot, "imagens.csv");
  const catalogRoot = commonCatalogRoot(productsFile);

  const productsRows = parseCsv(fs.readFileSync(productsFile, "utf8"));
  const variationRows = parseCsv(fs.readFileSync(variationsFile, "utf8"));
  const imageRows = parseCsv(fs.readFileSync(imagesFile, "utf8"));

  const errors = [];
  const warnings = [];
  const products = new Map();

  for (const row of productsRows) {
    const code = text(row.codigo ?? row.codigo_produto).toUpperCase();
    if (!PRODUCT_CODE_RE.test(code)) {
      errors.push(`Codigo de produto invalido: ${code || "(vazio)"}`);
      continue;
    }
    if (products.has(code)) {
      errors.push(`Produto repetido em produtos.csv: ${code}`);
      continue;
    }
    const name = text(row.nome ?? row.nome_produto);
    if (!name) errors.push(`${code}: nome vazio.`);

    const csvCompetition = text(row.campeonato);
    const competition =
      text(options.competition) ||
      (/^PENDENTE\s*-\s*CAMPEONATO$/i.test(csvCompetition) ? "" : csvCompetition);
    if (!competition) {
      warnings.push(`${code}: competicao nao definida; use --competition quando necessario.`);
    }

    const explicitPrice = parseNumber(row.preco ?? row.price);
    const explicitStock = parseInteger(row.estoque ?? row.stock);
    const stock = explicitStock ?? options.defaultStock ?? 0;
    const category = inferCategory(row);
    const resolvedLeague = text(options.league) || text(row.liga);
    const resolvedTeam = text(row.time ?? row.selecao);
    const audience = inferAudience(row);
    const businessProfile = buildCatalogBusinessProfile(
      { ...row, name, competition, league: resolvedLeague, team: resolvedTeam, audience },
      {
        explicitPrice,
        fallbackPrice: options.defaultPrice,
        specifications: row.especificacoes ?? row.specifications,
      },
    );
    const price = businessProfile.price;

    products.set(code, {
      code,
      name,
      competition,
      league: resolvedLeague,
      team: resolvedTeam,
      season: text(row.temporada ?? row.season),
      brand: inferBrand(name, row.marca ?? row.brand),
      audience,
      commercialType: businessProfile.commercialType,
      category,
      specifications: businessProfile.specifications,
      patches: businessProfile.patches,
      description: text(row.descricao),
      observations: text(row.observacoes),
      confidence: text(row.confianca),
      price,
      promotionalPrice: parseNumber(row.preco_promocional ?? row.promotional_price),
      stock,
      variations: new Map(),
      images: [],
    });
  }

  for (const row of variationRows) {
    const code = text(row.codigo_produto ?? row.codigo).toUpperCase();
    const product = products.get(code);
    if (!product) {
      errors.push(`variacoes.csv referencia produto inexistente: ${code}`);
      continue;
    }
    const variantCode = text(row.variacao) || "versao-01";
    if (product.variations.has(variantCode)) {
      errors.push(`${code}: variacao repetida ${variantCode}.`);
      continue;
    }
    const variantName = variationLabel(variantCode, row.nome_descricao);
    const explicitVariantType = inferCommercialType({ name: variantName, tipo_produto: row.tipo_produto });
    const variantCommercialType = explicitVariantType === "other"
      ? product.commercialType
      : explicitVariantType;
    const variantPrice = resolveCommercialPrice(
      variantCommercialType,
      parseNumber(row.preco ?? row.price),
      product.price,
    );
    product.variations.set(variantCode, {
      code: variantCode,
      name: variantName,
      commercialType: variantCommercialType,
      price: variantPrice,
      sortOrder: Math.max(
        0,
        (parseInteger(variantCode.match(/\d+$/)?.[0]) ?? product.variations.size + 1) - 1,
      ),
      stock: parseInteger(row.estoque) ?? product.stock,
    });
  }

  for (const product of products.values()) {
    if (product.variations.size === 0) {
      product.variations.set("versao-01", {
        code: "versao-01",
        name: "Versão 01",
        commercialType: product.commercialType,
        price: product.price,
        sortOrder: 0,
        stock: product.stock,
      });
    }
  }

  const seenImageKeys = new Set();
  for (const row of imageRows) {
    const code = text(row.codigo_produto ?? row.codigo).toUpperCase();
    const product = products.get(code);
    if (!product) {
      errors.push(`imagens.csv referencia produto inexistente: ${code}`);
      continue;
    }
    const variantCode = text(row.variacao) || "versao-01";
    if (!product.variations.has(variantCode)) {
      errors.push(`${code}: imagem referencia variacao inexistente ${variantCode}.`);
      continue;
    }
    const relative = text(row.arquivo_final);
    const sourceKey = relative.replaceAll("\\", "/");
    const uniqueKey = `${code}:${sourceKey.toLowerCase()}`;
    if (seenImageKeys.has(uniqueKey)) {
      errors.push(`${code}: arquivo_final repetido em imagens.csv: ${relative}`);
      continue;
    }
    seenImageKeys.add(uniqueKey);
    const absolute = resolveCatalogImage(catalogRoot, relative);
    if (!absolute) {
      errors.push(`${code}: imagem nao encontrada no ZIP: ${relative}`);
      continue;
    }
    const mime = mimeFromPath(absolute);
    if (!mime) {
      errors.push(`${code}: formato de imagem nao suportado: ${relative}`);
      continue;
    }
    product.images.push({
      variantCode,
      relative,
      sourceKey,
      absolute,
      mime,
      order: Math.max(0, (parseInteger(row.ordem) ?? product.images.length + 1) - 1),
      primary: isYes(row.principal),
    });
  }

  for (const product of products.values()) {
    if (product.images.length === 0) {
      errors.push(`${product.code}: nenhum arquivo de imagem associado.`);
    }
    for (const variant of product.variations.values()) {
      const scoped = product.images.filter((image) => image.variantCode === variant.code);
      if (scoped.length === 0) {
        errors.push(`${product.code}/${variant.code}: variacao sem imagens.`);
      }
      if (scoped.length > 0 && !scoped.some((image) => image.primary)) {
        warnings.push(
          `${product.code}/${variant.code}: sem principal explicita; primeira imagem sera usada.`,
        );
        scoped.sort((a, b) => a.order - b.order)[0].primary = true;
      }
    }
    if (options.activate && (product.price === null || product.price <= 0)) {
      errors.push(`${product.code}: --activate exige preco positivo (CSV ou --default-price).`);
    }
  }

  return { catalogRoot, products: [...products.values()], errors, warnings };
}

function planSummary(plan) {
  return {
    products: plan.products.length,
    variants: plan.products.reduce((sum, product) => sum + product.variations.size, 0),
    images: plan.products.reduce((sum, product) => sum + product.images.length, 0),
    unresolvedCompetition: plan.products.filter((product) => !product.competition).length,
    missingBrand: plan.products.filter((product) => !product.brand).length,
    errors: plan.errors.length,
    warnings: plan.warnings.length,
  };
}

function printPreview(plan, options) {
  const summary = planSummary(plan);
  console.log("\nBIGOFERTAS — IMPORTACAO DE CATALOGO");
  console.log(`Modo: ${options.apply ? "APLICAR" : "PREVIA (nenhuma alteracao sera feita)"}`);
  console.log(`Produtos: ${summary.products}`);
  console.log(`Variacoes: ${summary.variants}`);
  console.log(`Imagens: ${summary.images}`);
  console.log(`Sem competicao definida: ${summary.unresolvedCompetition}`);
  console.log(`Sem marca identificada: ${summary.missingBrand}`);
  console.log(`Avisos: ${summary.warnings}`);
  console.log(`Erros: ${summary.errors}`);
  if (plan.warnings.length) {
    console.log("\nAVISOS:");
    for (const warning of plan.warnings.slice(0, 30)) console.log(`- ${warning}`);
    if (plan.warnings.length > 30) {
      console.log(`- ... e mais ${plan.warnings.length - 30} aviso(s).`);
    }
  }
  if (plan.errors.length) {
    console.log("\nERROS:");
    for (const error of plan.errors.slice(0, 50)) console.log(`- ${error}`);
    if (plan.errors.length > 50) console.log(`- ... e mais ${plan.errors.length - 50} erro(s).`);
  }
}

class OwnerClient {
  constructor() {
    this.url = text(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/+$/, "");
    this.apikey = text(
      process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY,
    );
    this.accessToken = text(process.env.CATALOG_IMPORT_OWNER_ACCESS_TOKEN);
    this.refreshToken = text(process.env.CATALOG_IMPORT_OWNER_REFRESH_TOKEN);
    this.expiresAt = this.accessToken ? Date.now() + 45 * 60_000 : 0;
  }

  async init() {
    if (!this.url || !this.apikey) {
      throw new Error("SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY sao obrigatorios para --apply.");
    }
    if (this.accessToken) return;
    const email = text(process.env.CATALOG_IMPORT_OWNER_EMAIL);
    const password = text(process.env.CATALOG_IMPORT_OWNER_PASSWORD);
    if (!email || !password) {
      throw new Error(
        "Informe CATALOG_IMPORT_OWNER_ACCESS_TOKEN ou CATALOG_IMPORT_OWNER_EMAIL + CATALOG_IMPORT_OWNER_PASSWORD.",
      );
    }
    const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: this.apikey, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new Error(payload.error_description || payload.msg || "Falha ao autenticar owner.");
    }
    this.setSession(payload);
  }

  setSession(payload) {
    this.accessToken = payload.access_token;
    this.refreshToken = payload.refresh_token || this.refreshToken;
    this.expiresAt = Date.now() + Math.max(60, Number(payload.expires_in || 3600) - 90) * 1000;
  }

  async ensureSession() {
    if (Date.now() < this.expiresAt || !this.refreshToken) return;
    const response = await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: this.apikey, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new Error("A sessao do owner expirou e nao pode ser renovada.");
    }
    this.setSession(payload);
  }

  async request(url, init = {}) {
    await this.ensureSession();
    const headers = {
      apikey: this.apikey,
      authorization: `Bearer ${this.accessToken}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    };
    const response = await fetch(url, { ...init, headers });
    const raw = await response.text();
    let payload = raw;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      // resposta textual
    }
    if (!response.ok) {
      const message =
        typeof payload === "object" && payload
          ? payload.message || payload.msg || payload.error_description || payload.error
          : raw;
      throw new Error(`${response.status} ${message || "Falha na requisicao"}`);
    }
    return payload;
  }

  rpc(name, args = {}) {
    return this.request(`${this.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      body: JSON.stringify(args),
    });
  }

  invoke(name, body) {
    return this.request(`${this.url}/functions/v1/${name}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

function detectMagick() {
  for (const command of ["magick", "convert"]) {
    const result = spawnSync(command, ["-version"], { stdio: "ignore" });
    if (result.status === 0) return command;
  }
  return null;
}

function buildDerivative(command, source, output, maxEdge) {
  const args = [
    source,
    "-auto-orient",
    "-resize",
    `${maxEdge}x${maxEdge}>`,
    "-quality",
    "90",
    output,
  ];
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Falha ao gerar derivado ${path.basename(output)}`);
  }
}

async function prepareDerivatives(image, magick) {
  const sourceBytes = fs.readFileSync(image.absolute);
  if (!magick) {
    return {
      mime: image.mime,
      main: sourceBytes,
      card: sourceBytes,
      thumb: sourceBytes,
      cleanup: () => undefined,
    };
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bigofertas-image-"));
  const main = path.join(temp, "main.webp");
  const card = path.join(temp, "card.webp");
  const thumb = path.join(temp, "thumb.webp");
  try {
    if (image.mime === "image/webp") fs.copyFileSync(image.absolute, main);
    else buildDerivative(magick, image.absolute, main, MAIN_MAX_EDGE);
    buildDerivative(magick, image.absolute, card, CARD_MAX_EDGE);
    buildDerivative(magick, image.absolute, thumb, THUMB_MAX_EDGE);
    return {
      mime: "image/webp",
      main: fs.readFileSync(main),
      card: fs.readFileSync(card),
      thumb: fs.readFileSync(thumb),
      cleanup: () => fs.rmSync(temp, { recursive: true, force: true }),
    };
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

async function putSigned(upload, body) {
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.requiredHeaders,
    body,
  });
  if (!response.ok) throw new Error(`R2 recusou upload (${response.status}).`);
}

async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function importImage(client, product, variantIds, image, magick, stats) {
  const variantId = variantIds.get(image.variantCode);
  if (!variantId) throw new Error(`${product.code}: UUID ausente para ${image.variantCode}`);
  const sourceSha = sha256File(image.absolute);
  const state = await client.rpc("owner_catalog_import_image_state", {
    p_product_id: product.remoteId,
    p_source_key: image.sourceKey,
  });
  if (state?.status === "ready" && state?.sourceSha256 === sourceSha) {
    stats.imagesSkipped += 1;
    if (image.primary && !state.isPrimary) {
      await client.rpc("set_primary_product_image", { target_image_id: state.id });
    }
    return;
  }

  const derivatives = await prepareDerivatives(image, magick);
  try {
    const presign = await client.invoke("r2-image-presign", {
      productId: product.remoteId,
      variantId,
      contentType: derivatives.mime,
      originalFilename: path.basename(image.absolute),
      altText: product.name,
      byteSize: derivatives.main.length,
      cardByteSize: derivatives.card.length,
      thumbByteSize: derivatives.thumb.length,
      sortOrder: image.order,
    });
    if (!presign?.imageId) throw new Error("r2-image-presign nao retornou imageId.");
    const uploads = presign.derivativeUploads;
    if (!uploads?.main || !uploads?.card || !uploads?.thumb) {
      throw new Error("r2-image-presign nao retornou os tres derivados.");
    }
    await Promise.all([
      putSigned(uploads.main, derivatives.main),
      putSigned(uploads.card, derivatives.card),
      putSigned(uploads.thumb, derivatives.thumb),
    ]);
    await client.invoke("r2-image-complete", {
      imageId: presign.imageId,
      widthPx: null,
      heightPx: null,
    });
    await client.rpc("owner_catalog_import_finalize_image", {
      p_product_id: product.remoteId,
      p_image_id: presign.imageId,
      p_source_key: image.sourceKey,
      p_source_sha256: sourceSha,
      p_is_primary: image.primary,
      p_sort_order: image.order,
    });
    if (state?.id) stats.imagesReplaced += 1;
    else stats.imagesUploaded += 1;
  } finally {
    derivatives.cleanup();
  }
}

async function applyPlan(plan, options) {
  const client = new OwnerClient();
  await client.init();
  const magick = detectMagick();
  if (!magick) {
    console.warn(
      "AVISO: ImageMagick nao encontrado; card/thumb reutilizarao o arquivo otimizado do ZIP.",
    );
  }

  const stats = {
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    imagesUploaded: 0,
    imagesReplaced: 0,
    imagesSkipped: 0,
    activated: 0,
  };

  for (const [productIndex, product] of plan.products.entries()) {
    console.log(
      `\n[${productIndex + 1}/${plan.products.length}] ${product.code} — ${product.name}`,
    );
    const categoryId = await client.rpc("owner_catalog_import_upsert_category", {
      p_name: product.category.name,
      p_slug: product.category.slug,
    });
    const saved = await client.rpc("owner_catalog_import_upsert_product", {
      p_catalog_code: product.code,
      p_name: product.name,
      p_description: product.description,
      p_price: product.price,
      p_promotional_price: product.promotionalPrice,
      p_primary_category_id: categoryId,
      p_campeonato: product.competition || null,
      p_liga: product.league || null,
      p_time: product.team || null,
      p_season: product.season || null,
      p_brand: product.brand || null,
      p_audience: product.audience || null,
      p_commercial_type: product.commercialType,
    });
    product.remoteId = saved.id;
    if (saved.created) stats.productsCreated += 1;
    else stats.productsUpdated += 1;

    const personalizationEnabled = [
      "torcedor",
      "feminino",
      "jogador",
      "retro",
      "infantil",
      "basquete",
    ].includes(product.commercialType);
    await client.rpc("owner_save_product_purchase_settings_v2", {
      p_product_id: product.remoteId,
      p_commercial_type: product.commercialType,
      p_size_enabled: true,
      p_personalization_enabled: personalizationEnabled,
      p_phrase_enabled: personalizationEnabled,
      p_patches: product.patches,
    });
    if (product.specifications) {
      await client.rpc("owner_catalog_import_set_specifications", {
        p_product_id: product.remoteId,
        p_specifications: product.specifications,
      });
    }

    const variantIds = new Map();
    const variants = [...product.variations.values()].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const [variantIndex, variant] of variants.entries()) {
      const optionsPayload =
        variants.length > 1
          ? [{ name: "Versão", kind: "style", value: variant.name, sortOrder: 0 }]
          : [];
      const savedVariant = await client.rpc("owner_catalog_import_upsert_variant", {
        p_product_id: product.remoteId,
        p_variant_code: variant.code,
        p_name: variant.name,
        p_is_default: variantIndex === 0,
        p_sort_order: variant.sortOrder,
        p_stock_quantity: variant.stock,
        p_options: optionsPayload,
      });
      variantIds.set(variant.code, savedVariant.id);
      if (Number.isFinite(variant.price)) {
        await client.rpc("owner_catalog_import_set_variant_price", {
          p_product_id: product.remoteId,
          p_variant_id: savedVariant.id,
          p_price_override: variant.price,
        });
      }
      if (savedVariant.created) stats.variantsCreated += 1;
      else stats.variantsUpdated += 1;
    }

    await mapLimit(product.images, options.imageConcurrency, (image) =>
      importImage(client, product, variantIds, image, magick, stats),
    );

    if (options.activate) {
      await client.rpc("owner_catalog_import_set_product_status", {
        p_product_id: product.remoteId,
        p_status: "active",
      });
      stats.activated += 1;
    }
  }
  return stats;
}

function writeReport(reportPath, payload) {
  if (!reportPath) return;
  fs.writeFileSync(path.resolve(reportPath), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`\nRelatorio: ${path.resolve(reportPath)}`);
}

const options = parseArgs(process.argv.slice(2));
const input = prepareInput(options.input);
try {
  const plan = loadPlan(input.root, options);
  printPreview(plan, options);
  if (plan.errors.length) fail("Importacao bloqueada ate corrigir os erros acima.", 2);

  if (!options.apply) {
    writeReport(options.report, {
      mode: "preview",
      summary: planSummary(plan),
      warnings: plan.warnings,
    });
    console.log(
      "\nPREVIA CONCLUIDA. Nenhum dado foi alterado. Use --apply somente quando quiser gravar.",
    );
    process.exit(0);
  }

  const stats = await applyPlan(plan, options);
  const report = {
    mode: "applied",
    input: path.resolve(options.input),
    summary: planSummary(plan),
    stats,
    warnings: plan.warnings,
    finishedAt: new Date().toISOString(),
  };
  writeReport(options.report, report);
  console.log("\nIMPORTACAO CONCLUIDA");
  console.log(JSON.stringify(stats, null, 2));
} catch (error) {
  console.error(`\nFALHA NA IMPORTACAO: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 10;
} finally {
  input.cleanup();
}
