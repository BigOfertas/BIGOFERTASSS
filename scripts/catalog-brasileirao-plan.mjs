import fs from "node:fs";
import path from "node:path";

import { buildCatalogBusinessProfile, resolveCommercialPrice } from "./catalog-business-rules.mjs";

const ALLOWED_TYPES = new Set(["torcedor", "jogador", "feminino", "infantil", "retro", "calcao"]);
const BRAZILIAN_PATCHES = new Set([
  "brasileirao",
  "copa-do-brasil",
  "libertadores",
  "sul-americana",
  "mundial-de-clubes",
]);

function parseArgs(argv) {
  const out = { input: "", output: "", sourceGroup: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") out.input = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else if (arg === "--source-group") out.sourceGroup = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.input || !out.output || !out.sourceGroup) {
    throw new Error("Use --input, --output e --source-group.");
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
      retro: "Retrô",
      calcao: "Calção",
    }[type] ?? "Versão"
  );
}

function descriptionFor(product, team, commercialType) {
  const parts = [`${product.name}.`, `Time: ${team}.`, "Campeonato: Brasileirão."];
  if (commercialType && commercialType !== "other") {
    parts.push(`Versão ${commercialLabel(commercialType)}.`);
  }
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

  const variants = product.variants.map((variant, variantIndex) => {
    const profile = buildCatalogBusinessProfile({
      name: variant.sourceTitle || product.sourceTitle || product.name,
      team: options.sourceGroup,
      season: product.season,
      audience: product.audience,
      competition: "Brasileirão",
      league: "Brasileirão",
    });
    const commercialType =
      profile.commercialType === "other" ? variant.commercialType : profile.commercialType;
    if (!ALLOWED_TYPES.has(commercialType)) {
      throw new Error(
        `${options.sourceGroup}: tipo comercial não identificado em ${variant.sourceTitle || product.name}.`,
      );
    }
    const price = resolveCommercialPrice(commercialType, null, variant.price ?? product.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`${options.sourceGroup}: preço inválido na variante ${variantIndex + 1}.`);
    }
    return {
      ...variant,
      name: commercialLabel(commercialType),
      commercialType,
      price,
    };
  });

  const primaryType = variants[0].commercialType;
  const primaryPrice = variants[0].price;
  const profile = buildCatalogBusinessProfile({
    name: product.sourceTitle || product.name,
    team: options.sourceGroup,
    season: product.season,
    audience: product.audience,
    competition: "Brasileirão",
    league: "Brasileirão",
  });
  const specifications = [
    product.brand ? `Marca: ${product.brand}` : null,
    product.season ? `Temporada: ${product.season}` : null,
    `Time: ${options.sourceGroup}`,
    `Campeonato: Brasileirão`,
    `Versão: ${commercialLabel(primaryType)}`,
    profile.uniform?.label ? `Uniforme: ${profile.uniform.label}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
  const customizable = primaryType !== "calcao";
  const patches = (profile.patches ?? []).filter((patch) => BRAZILIAN_PATCHES.has(patch));

  return {
    ...product,
    description: descriptionFor(product, options.sourceGroup, primaryType),
    competition: "Brasileirão",
    league: "Brasileirão",
    team: options.sourceGroup,
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
  batchKey: `brasileirao:${options.sourceGroup}:${input.batchKey || "album"}`,
  sourceGroup: options.sourceGroup,
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
  `BRASILEIRAO_PLAN_OK team=${options.sourceGroup} products=${normalized.summary.products} variants=${normalized.summary.variants} images=${normalized.summary.images}`,
);
