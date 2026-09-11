import fs from "node:fs";
import path from "node:path";

const NBA_PRICE = 229.9;

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

function buildDescription(product, team) {
  const parts = [`${product.name}.`, `Time: ${team}.`, "Liga: NBA.", "Produto de basquete."];
  if (product.season) parts.push(`Temporada ${product.season}.`);
  if (product.brand) parts.push(`Marca ${product.brand}.`);
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
    if (!Array.isArray(variant.images) || variant.images.length === 0) {
      throw new Error(`${options.sourceGroup}: variante sem imagens em ${product.name}.`);
    }
    const suffix = String(variantIndex + 1).padStart(2, "0");
    const many = product.variants.length > 1;
    return {
      ...variant,
      code: many ? `basquete-${suffix}` : "basquete",
      name: many ? `Basquete ${suffix}` : "Basquete",
      commercialType: "basquete",
      price: NBA_PRICE,
    };
  });

  return {
    ...product,
    description: buildDescription(product, options.sourceGroup),
    category: { name: "Basquete / NBA", slug: "basquete" },
    competition: "NBA",
    league: "NBA",
    team: options.sourceGroup,
    commercialType: "basquete",
    price: NBA_PRICE,
    specifications: [
      product.brand ? `Marca: ${product.brand}` : null,
      product.season ? `Temporada: ${product.season}` : null,
      `Time: ${options.sourceGroup}`,
      "Liga: NBA",
      "Versão: Basquete",
    ]
      .filter(Boolean)
      .join(" | "),
    personalizationEnabled: true,
    phraseEnabled: true,
    patches: [],
    variants,
  };
});

const normalized = {
  ...input,
  batchKey: `nba:${options.sourceGroup}:${input.batchKey || "album"}`,
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
  throw new Error(`${options.sourceGroup}: há produto NBA sem imagem.`);
}

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
console.log(
  `NBA_PLAN_OK team=${options.sourceGroup} products=${normalized.summary.products} variants=${normalized.summary.variants} images=${normalized.summary.images}`,
);
