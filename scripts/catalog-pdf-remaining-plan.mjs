import fs from "node:fs";
import path from "node:path";

import { buildCatalogBusinessProfile, resolveCommercialPrice } from "./catalog-business-rules.mjs";

const ALLOWED_CLUB_TYPES = new Set(["torcedor", "jogador", "feminino", "infantil", "calcao"]);
const PRICE_BY_TYPE = Object.freeze({
  torcedor: 184.9,
  feminino: 184.9,
  jogador: 219.9,
  infantil: 169.9,
  calcao: 159.9,
});

function parseArgs(argv) {
  const out = {
    input: "",
    output: "",
    groupId: "",
    groupName: "",
    sourceGroup: "",
    mode: "club",
    competition: null,
    league: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") out.input = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else if (arg === "--group-id") out.groupId = argv[++index];
    else if (arg === "--group-name") out.groupName = argv[++index];
    else if (arg === "--source-group") out.sourceGroup = argv[++index];
    else if (arg === "--mode") out.mode = argv[++index];
    else if (arg === "--competition") out.competition = argv[++index];
    else if (arg === "--league") out.league = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.input || !out.output || !out.groupId || !out.groupName || !out.sourceGroup) {
    throw new Error("Use --input, --output, --group-id, --group-name e --source-group.");
  }
  if (!["club", "kids", "shorts"].includes(out.mode)) {
    throw new Error(`Modo inválido: ${out.mode}`);
  }
  return out;
}

function commercialLabel(type) {
  return (
    {
      torcedor: "Torcedor",
      jogador: "Jogador",
      feminino: "Feminino",
      infantil: "Infantil",
      calcao: "Calção",
    }[type] ?? "Versão"
  );
}

function preserveDistinctVariants(variants) {
  const totals = new Map();
  for (const variant of variants) {
    totals.set(variant.commercialType, (totals.get(variant.commercialType) ?? 0) + 1);
  }
  const seen = new Map();
  return variants.map((variant) => {
    const type = variant.commercialType;
    const occurrence = (seen.get(type) ?? 0) + 1;
    seen.set(type, occurrence);
    const total = totals.get(type) ?? 1;
    const suffix = String(occurrence).padStart(2, "0");
    return {
      ...variant,
      code: total > 1 ? `${type}-${suffix}` : type,
      name: total > 1 ? `${commercialLabel(type)} ${suffix}` : commercialLabel(type),
    };
  });
}

function descriptionFor(product, options, team, commercialType) {
  const parts = [`${product.name}.`];
  if (team) parts.push(`Time: ${team}.`);
  if (options.competition) parts.push(`Campeonato: ${options.competition}.`);
  if (options.league) parts.push(`Liga: ${options.league}.`);
  if (options.mode === "kids") parts.push("Categoria: Conjuntos Infantis / Kids.");
  if (options.mode === "shorts") parts.push("Categoria: Shorts.");
  parts.push(`Versão ${commercialLabel(commercialType)}.`);
  if (product.season) parts.push(`Temporada ${product.season}.`);
  if (product.brand) parts.push(`Marca ${product.brand}.`);
  parts.push("Disponível com as opções configuradas pela BIGofertas.");
  return parts.join(" ");
}

const options = parseArgs(process.argv.slice(2));
const input = JSON.parse(fs.readFileSync(path.resolve(options.input), "utf8"));
if (!Array.isArray(input.products) || input.products.length === 0) {
  throw new Error(`${options.sourceGroup}: plano bruto sem produtos.`);
}

const products = input.products.map((product, productIndex) => {
  if (!product?.sourceKey || !Array.isArray(product.variants) || product.variants.length === 0) {
    throw new Error(`${options.sourceGroup}: produto ${productIndex + 1} incompleto.`);
  }

  const forcedType = options.mode === "kids" ? "infantil" : options.mode === "shorts" ? "calcao" : null;
  const team = options.mode === "club" ? options.sourceGroup : product.team ?? null;
  const mappedVariants = product.variants.map((variant, variantIndex) => {
    if (!Array.isArray(variant.images) || variant.images.length === 0) {
      throw new Error(`${options.sourceGroup}: variante sem imagens em ${product.name}.`);
    }
    const profile = buildCatalogBusinessProfile({
      name: variant.sourceTitle || product.sourceTitle || product.name,
      team,
      season: product.season,
      audience: options.mode === "kids" ? "INFANTIL" : product.audience,
      competition: options.competition,
      league: options.league,
    });
    const commercialType =
      forcedType ?? (profile.commercialType === "other" ? variant.commercialType : profile.commercialType);
    if (!ALLOWED_CLUB_TYPES.has(commercialType)) {
      throw new Error(
        `${options.sourceGroup}: tipo comercial não permitido em ${variant.sourceTitle || product.name}: ${commercialType}`,
      );
    }
    const price = resolveCommercialPrice(commercialType, null, variant.price ?? product.price);
    if (!Number.isFinite(price) || Math.abs(price - PRICE_BY_TYPE[commercialType]) > 0.001) {
      throw new Error(`${options.sourceGroup}: preço inválido na variante ${variantIndex + 1}.`);
    }
    return { ...variant, commercialType, price };
  });

  const variants = preserveDistinctVariants(mappedVariants);
  if (new Set(variants.map((variant) => variant.code)).size !== variants.length) {
    throw new Error(`${options.sourceGroup}: códigos de variação duplicados em ${product.name}.`);
  }

  const primaryType = variants[0].commercialType;
  const primaryPrice = variants[0].price;
  const profile = buildCatalogBusinessProfile({
    name: product.sourceTitle || product.name,
    team,
    season: product.season,
    audience: options.mode === "kids" ? "INFANTIL" : product.audience,
    competition: options.competition,
    league: options.league,
  });
  const category =
    options.mode === "kids"
      ? { name: "Kids", slug: "infantil" }
      : options.mode === "shorts"
        ? { name: "Shorts", slug: "shorts" }
        : product.category;
  const competition = options.mode === "club" ? options.competition : product.competition ?? null;
  const league = options.mode === "club" ? options.league : product.league ?? null;
  const customizable = primaryType !== "calcao";
  const patches = primaryType === "calcao" ? [] : profile.patches ?? product.patches ?? [];
  const specifications = [
    product.brand ? `Marca: ${product.brand}` : null,
    product.season ? `Temporada: ${product.season}` : null,
    team ? `Time: ${team}` : null,
    competition ? `Campeonato: ${competition}` : null,
    league ? `Liga: ${league}` : null,
    `Versão: ${commercialLabel(primaryType)}`,
    profile.uniform?.label ? `Uniforme: ${profile.uniform.label}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    ...product,
    description: descriptionFor(product, options, team, primaryType),
    category,
    competition,
    league,
    team,
    audience: options.mode === "kids" ? "INFANTIL" : product.audience,
    commercialType: primaryType,
    price: primaryPrice,
    specifications,
    personalizationEnabled: customizable,
    phraseEnabled: customizable,
    patches,
    variants,
  };
});

const normalized = {
  ...input,
  batchKey: `pdf-remaining:${options.groupId}:${options.sourceGroup}:${input.batchKey || "album"}`,
  pdfGroupId: options.groupId,
  pdfGroupName: options.groupName,
  sourceGroup: options.sourceGroup,
  mode: options.mode,
  products,
  summary: {
    products: products.length,
    variants: products.reduce((sum, product) => sum + product.variants.length, 0),
    images: products.reduce(
      (sum, product) =>
        sum + product.variants.reduce((inner, variant) => inner + (variant.images?.length ?? 0), 0),
      0,
    ),
  },
};

if (normalized.summary.images < normalized.summary.products) {
  throw new Error(`${options.sourceGroup}: há produto sem imagem.`);
}

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
console.log(
  `PDF_REMAINING_PLAN_OK group=${options.groupId} source=${options.sourceGroup} products=${normalized.summary.products} variants=${normalized.summary.variants} images=${normalized.summary.images}`,
);
