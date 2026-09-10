import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SHORTS_PRICE = 159.9;
const KNOWN_BRANDS = [
  "KOBE BRYANT",
  "NEW BALANCE",
  "PARIS SAINT GERMAIN",
  "ADIDAS",
  "NIKE",
  "PUMA",
  "UMBRO",
  "JORDAN",
  "KAPPA",
  "EA7",
];

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function slugify(value) {
  return normalized(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseArgs(argv) {
  const out = {
    collector: ".artifacts/google-photos-collector/collector.json",
    output: ".artifacts/google-photos-collector/catalog-pipeline-plan.json",
    sourceGroup: "",
    price: null,
    stock: 999,
    validateUrls: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--collector") out.collector = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else if (arg === "--source-group") out.sourceGroup = argv[++index];
    else if (arg === "--price") out.price = Number(argv[++index]);
    else if (arg === "--stock") out.stock = Number.parseInt(argv[++index], 10);
    else if (arg === "--validate-urls") out.validateUrls = true;
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.sourceGroup) throw new Error("Use --source-group.");
  if (!Number.isInteger(out.stock) || out.stock < 0 || out.stock > 1_000_000) {
    throw new Error("Estoque técnico inválido.");
  }
  return out;
}

function sourceFamily(value) {
  const group = normalized(value);
  if (group === "SHORTS") return "shorts";
  if (/CONJUNTOS? DE TREINO|TREINO \/ KIT/.test(group)) return "treino";
  if (/CORTA[- ]?VENTO|WINDBREAKER/.test(group)) return "corta-vento";
  throw new Error(`Grupo de vestuário não reconhecido: ${value}`);
}

function displayWords(value) {
  const keepUpper = new Set(["PSG", "EA7", "AC", "FC"]);
  return clean(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      return keepUpper.has(upper) ? upper : upper.slice(0, 1) + upper.slice(1).toLowerCase();
    })
    .join(" ");
}

function displayTeam(value) {
  const key = normalized(value);
  const aliases = new Map([
    ["MAN. CITY", "Manchester City"],
    ["MAN CITY", "Manchester City"],
    ["M. CITY", "Manchester City"],
    ["MAN. UNITED", "Manchester United"],
    ["MAN UNITED", "Manchester United"],
    ["M. UNITED", "Manchester United"],
    ["MANCHESTER UNITED", "Manchester United"],
    ["O. MARSEILLE", "Olympique Marseille"],
    ["OLYMPIC DE MARSEILLE", "Olympique Marseille"],
    ["OLYMPIQUE DE MARSEILLE", "Olympique Marseille"],
    ["PARIS SAINT GERMAIN", "PSG"],
    ["PSG", "PSG"],
    ["INTERNAZIONALE", "Internazionale"],
    ["INTERZIONALE", "Internazionale"],
    ["BAYERN M.", "Bayern"],
    ["BAYERN M", "Bayern"],
    ["ATLETICO DE MADRID", "Atlético de Madrid"],
    ["GREMIO", "Grêmio"],
  ]);
  return aliases.get(key) ?? displayWords(value);
}

function publicSeason(value) {
  const token = clean(value).replace("-", "/");
  if (token === "25/25") return "25/26";
  return token;
}

function extractSeason(title) {
  const matches = [...title.matchAll(/\b\d{2,4}[/-]\d{2,4}\b/g)];
  const match = matches.at(-1);
  if (!match || match.index === undefined) throw new Error(`Temporada ausente: ${title}`);
  return { token: match[0], index: match.index };
}

function extractBrand(title, season) {
  const after = clean(title.slice(season.index + season.token.length));
  const normalizedAfter = normalized(after);
  for (const brand of KNOWN_BRANDS) {
    if (normalizedAfter === brand || normalizedAfter.endsWith(` ${brand}`)) {
      return { brand: displayWords(brand), raw: after.slice(Math.max(0, after.length - brand.length)) };
    }
  }
  const before = clean(title.slice(0, season.index));
  const combined = `${before} ${after}`;
  for (const brand of KNOWN_BRANDS) {
    if (new RegExp(`\\b${brand.replaceAll(" ", "\\s+")}\\b`, "i").test(normalized(combined))) {
      return { brand: displayWords(brand), raw: brand };
    }
  }
  if (after) return { brand: displayWords(after), raw: after };
  throw new Error(`Marca ausente: ${title}`);
}

function stripKnownBrand(value, brandRaw) {
  if (!brandRaw) return clean(value);
  const pattern = new RegExp(`${brandRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  return clean(value.replace(pattern, " "));
}

function parseShort(title) {
  const sourceTitle = clean(title);
  if (!/^SHORTS?\b/i.test(sourceTitle)) throw new Error(`Título fora de Shorts: ${sourceTitle}`);
  const seasonMatch = extractSeason(sourceTitle);
  const brandInfo = extractBrand(sourceTitle, seasonMatch);
  let before = clean(sourceTitle.slice(0, seasonMatch.index).replace(/^SHORTS?\b/i, " "));
  let after = stripKnownBrand(clean(sourceTitle.slice(seasonMatch.index + seasonMatch.token.length)), brandInfo.raw);

  let model = null;
  const modelMatch = before.match(/^(I|II|III|IV)\b/i);
  if (modelMatch) {
    model = modelMatch[1].toUpperCase();
    before = clean(before.slice(modelMatch[0].length));
  }

  let version = null;
  if (/\bPLAYER\b/i.test(before)) version = "Jogador";
  else if (/\bFAN\b/i.test(before)) version = "Torcedor";
  before = clean(before.replace(/\b(?:PLAYER|FAN)\b/gi, " "));

  const descriptors = [];
  if (/\bTERRACE\s+ICONS\b/i.test(before)) descriptors.push("Terrace Icons");
  if (/\bDE\s+TREINO\b/i.test(before)) descriptors.push("Treino");
  before = clean(before.replace(/\bTERRACE\s+ICONS\b/gi, " ").replace(/\bDE\s+TREINO\b/gi, " "));

  const teamText = clean(`${before} ${after}`);
  if (!teamText) throw new Error(`Time ausente: ${sourceTitle}`);
  return {
    sourceTitle,
    team: displayTeam(teamText),
    season: publicSeason(seasonMatch.token),
    brand: brandInfo.brand,
    model,
    version,
    descriptors,
    retro: false,
  };
}

function parseTraining(title) {
  const sourceTitle = clean(title);
  if (/^\[?\d{2,4}\/\d{2,4}\]?\s+CONJUNTOS? DE TREINO\s*\/\s*VIAGEM$/i.test(sourceTitle)) {
    return null;
  }
  if (!/^CONJUNTO\b/i.test(sourceTitle)) throw new Error(`Título fora de Treino/Kit: ${sourceTitle}`);
  const seasonMatch = extractSeason(sourceTitle);
  const brandInfo = extractBrand(sourceTitle, seasonMatch);
  const before = clean(sourceTitle.slice(0, seasonMatch.index).replace(/^CONJUNTO\b/i, " "));
  const after = stripKnownBrand(clean(sourceTitle.slice(seasonMatch.index + seasonMatch.token.length)), brandInfo.raw);
  const teamText = clean(`${before} ${after}`);
  if (!teamText) throw new Error(`Time ausente: ${sourceTitle}`);
  return {
    sourceTitle,
    team: displayTeam(teamText),
    season: publicSeason(seasonMatch.token),
    brand: brandInfo.brand,
    model: null,
    version: null,
    descriptors: ["Treino/Viagem"],
    retro: false,
  };
}

function parseWindbreaker(title) {
  const sourceTitle = clean(title);
  if (!/^CORTA[- ]?VENTO\b/i.test(sourceTitle)) {
    throw new Error(`Título fora de Corta-Vento: ${sourceTitle}`);
  }
  const seasonMatch = extractSeason(sourceTitle);
  const brandInfo = extractBrand(sourceTitle, seasonMatch);
  let before = clean(sourceTitle.slice(0, seasonMatch.index).replace(/^CORTA[- ]?VENTO\b/i, " "));
  let after = stripKnownBrand(clean(sourceTitle.slice(seasonMatch.index + seasonMatch.token.length)), brandInfo.raw);
  const retro = /\bRETR[ÔO]\b/i.test(before) || /\bRETR[ÔO]\b/i.test(after);
  before = clean(before.replace(/\bRETR[ÔO]\b/gi, " "));
  after = clean(after.replace(/\bRETR[ÔO]\b/gi, " "));
  const teamText = clean(`${before} ${after}`);
  if (!teamText) throw new Error(`Time ausente: ${sourceTitle}`);
  return {
    sourceTitle,
    team: displayTeam(teamText),
    season: publicSeason(seasonMatch.token),
    brand: brandInfo.brand,
    model: null,
    version: null,
    descriptors: retro ? ["Retrô"] : [],
    retro,
  };
}

function familyConfig(family, priceOverride) {
  if (family === "shorts") {
    if (priceOverride !== null && Math.abs(priceOverride - SHORTS_PRICE) > 0.001) {
      throw new Error(`Shorts deve usar o preço definitivo de R$ ${SHORTS_PRICE.toFixed(2)}.`);
    }
    return {
      price: SHORTS_PRICE,
      category: { name: "Shorts", slug: "shorts" },
      commercialType: "calcao",
      productType: "Short",
    };
  }
  if (!Number.isFinite(priceOverride) || priceOverride <= 0) {
    throw new Error(`${family}: informe --price com o preço comercial aprovado; preço não será inventado.`);
  }
  if (family === "treino") {
    return {
      price: priceOverride,
      category: { name: "Kits de treino", slug: "kit-treino" },
      commercialType: "other",
      productType: "Conjunto de Treino",
    };
  }
  return {
    price: priceOverride,
    category: { name: "Corta-vento", slug: "corta-ventos" },
    commercialType: "other",
    productType: "Corta-Vento",
  };
}

function parseIdentity(family, title) {
  if (family === "shorts") return parseShort(title);
  if (family === "treino") return parseTraining(title);
  return parseWindbreaker(title);
}

function baseKey(family, identity) {
  return [
    family,
    normalized(identity.team),
    identity.model ?? "-",
    identity.descriptors.map(normalized).join("+") || "-",
    identity.season,
    normalized(identity.brand),
  ].join("|");
}

function productName(config, identity) {
  return [
    `${identity.team} — ${config.productType}`,
    identity.model,
    ...identity.descriptors,
    identity.season,
    identity.brand,
  ]
    .filter(Boolean)
    .join(" ");
}

function variantNames(config, entries) {
  const baseLabels = entries.map((entry) => {
    if (config.commercialType === "calcao" && entry.identity.version) {
      return `Calção — ${entry.identity.version}`;
    }
    if (config.commercialType === "calcao") return "Calção";
    return config.productType;
  });
  const totals = new Map();
  for (const label of baseLabels) totals.set(label, (totals.get(label) ?? 0) + 1);
  const seen = new Map();
  return baseLabels.map((label) => {
    if ((totals.get(label) ?? 0) === 1 && entries.length === 1) return label;
    const ordinal = (seen.get(label) ?? 0) + 1;
    seen.set(label, ordinal);
    if ((totals.get(label) ?? 0) === 1) return label;
    return `${label} ${ordinal}`;
  });
}

function imageRecord(image, sortOrder) {
  const url = clean(image.highQualityUrl || image.directUrl || image.url);
  if (!/^https:\/\/lh\d+\.googleusercontent\.com\//.test(url)) {
    throw new Error(`URL Google Photos inválida: ${url.slice(0, 120)}`);
  }
  const mediaKey = clean(image.mediaKey);
  if (!mediaKey) throw new Error("Imagem sem mediaKey estável.");
  return {
    sourceKey: `google_photos:${mediaKey}`,
    url,
    sortOrder,
    primary: sortOrder === 0,
  };
}

function buildPlan(collector, options) {
  const family = sourceFamily(options.sourceGroup);
  const config = familyConfig(family, options.price);
  const albumIdentity = clean(collector.resolvedUrl || collector.sourceUrl);
  if (!albumIdentity || !Array.isArray(collector.groups)) throw new Error("Coletor inválido.");

  const grouped = new Map();
  let excludedHeaders = 0;
  for (const group of collector.groups) {
    const identity = parseIdentity(family, group.title);
    if (!identity) {
      excludedHeaders += 1;
      continue;
    }
    if (!Array.isArray(group.images) || group.images.length === 0) {
      throw new Error(`Grupo sem imagens: ${group.title}`);
    }
    const key = baseKey(family, identity);
    const entries = grouped.get(key) ?? [];
    entries.push({ group, identity });
    grouped.set(key, entries);
  }

  const products = [];
  for (const [key, entries] of grouped) {
    const identity = entries[0].identity;
    const name = productName(config, identity);
    const names = variantNames(config, entries);
    const sourceKey = `gphotos:${crypto
      .createHash("sha256")
      .update(`${albumIdentity}|${key}`)
      .digest("hex")
      .slice(0, 40)}`;
    const variants = entries.map((entry, index) => ({
      code: `versao-${String(index + 1).padStart(2, "0")}`,
      name: names[index],
      commercialType: config.commercialType,
      price: config.price,
      stock: options.stock,
      sourceTitle: entry.group.title,
      images: entry.group.images.map(imageRecord),
    }));
    const specifications = [
      `Marca: ${identity.brand}`,
      `Temporada: ${identity.season}`,
      `Linha: ${config.productType}`,
      identity.model ? `Modelo: ${identity.model}` : null,
      identity.descriptors.length ? `Detalhes: ${identity.descriptors.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    products.push({
      sourceKey,
      sourceTitle: entries[0].group.title,
      name,
      description: `${name}. Produto sob demanda da BIGofertas, com as opções comerciais configuradas para esta linha.`,
      category: config.category,
      competition: null,
      league: null,
      team: identity.team,
      season: identity.season,
      brand: identity.brand,
      audience: "MASCULINO",
      commercialType: config.commercialType,
      price: config.price,
      specifications,
      personalizationEnabled: false,
      phraseEnabled: false,
      patches: [],
      variants,
    });
  }

  if (products.length === 0) throw new Error("Nenhum produto normalizado.");
  const summary = {
    products: products.length,
    variants: products.reduce((sum, product) => sum + product.variants.length, 0),
    images: products.reduce(
      (sum, product) =>
        sum + product.variants.reduce((inner, variant) => inner + variant.images.length, 0),
      0,
    ),
    excludedHeaders,
  };
  const sourceKeys = products.map((product) => product.sourceKey);
  if (new Set(sourceKeys).size !== sourceKeys.length) throw new Error("sourceKey duplicada.");
  return {
    schemaVersion: 1,
    batchKey: `pdf-apparel:${family}:${slugify(options.sourceGroup)}`,
    sourceAlbumUrl: albumIdentity,
    products,
    summary,
    warnings: [],
  };
}

async function validateUrl(url) {
  const head = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (head?.ok) return;
  const response = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-0" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Imagem indisponível (${response.status}): ${url.slice(0, 120)}`);
  await response.body?.cancel();
}

async function mapLimit(items, concurrency, worker) {
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, run));
}

const options = parseArgs(process.argv.slice(2));
const collector = JSON.parse(fs.readFileSync(path.resolve(options.collector), "utf8"));
const plan = buildPlan(collector, options);

if (options.validateUrls) {
  const urls = [
    ...new Set(
      plan.products.flatMap((product) => product.variants.flatMap((variant) => variant.images.map((image) => image.url))),
    ),
  ];
  await mapLimit(urls, 16, validateUrl);
  console.log(`PDF_APPAREL_URLS_OK urls=${urls.length}`);
}

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
console.log(
  `PDF_APPAREL_PLAN_OK group=${sourceFamily(options.sourceGroup)} products=${plan.summary.products} variants=${plan.summary.variants} images=${plan.summary.images} excludedHeaders=${plan.summary.excludedHeaders}`,
);
