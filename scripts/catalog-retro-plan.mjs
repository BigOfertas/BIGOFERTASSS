import fs from "node:fs";
import path from "node:path";

const RETRO_PRICE = 219.9;

function parseArgs(argv) {
  const out = { input: "", output: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") out.input = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.input || !out.output) throw new Error("Use --input e --output.");
  return out;
}

function forceRetroName(value) {
  const name = String(value ?? "").trim();
  if (!name) throw new Error("Produto sem nome.");
  if (/\bRetr[oô]\b/i.test(name)) return name;
  if (/\bCamisa\b/i.test(name)) return name.replace(/\bCamisa\b/i, (match) => `${match} Retrô`);
  if (/\bRegata\b/i.test(name)) return name.replace(/\bRegata\b/i, (match) => `${match} Retrô`);
  return `${name} — Retrô`;
}

function retroSpecifications(value) {
  const parts = String(value ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^Vers[aã]o\s*:/i.test(part) && !/^Uniforme\s*:/i.test(part));
  const uniform = String(value ?? "")
    .split("|")
    .map((part) => part.trim())
    .find((part) => /^Uniforme\s*:/i.test(part));
  return [...parts, "Versão: Retrô", uniform].filter(Boolean).join(" | ");
}

function retroVariantName(variant, count, index) {
  if (count === 1) return "Retrô";
  const source = String(variant?.sourceTitle ?? "").toUpperCase();
  if (/\b(PLAYER|JOGADOR)\b/.test(source)) return "Retrô — Jogador";
  if (/\bFEMININ[AO]\b/.test(source)) return "Retrô — Feminino";
  if (/\b(TORCEDOR|FAN)\b/.test(source)) return "Retrô — Torcedor";
  return `Retrô — Versão ${index + 1}`;
}

const options = parseArgs(process.argv.slice(2));
const input = JSON.parse(fs.readFileSync(path.resolve(options.input), "utf8"));
if (!Array.isArray(input.products) || input.products.length === 0) {
  throw new Error("Plano sem produtos.");
}

const normalized = {
  ...input,
  batchKey: `retro:${input.batchKey || path.basename(options.input)}`,
  products: input.products.map((product, productIndex) => {
    if (!product?.sourceKey || !Array.isArray(product.variants) || product.variants.length === 0) {
      throw new Error(`Produto ${productIndex + 1} incompleto.`);
    }
    const sourceTitles = [product.sourceTitle, ...product.variants.map((variant) => variant?.sourceTitle)]
      .filter(Boolean)
      .join(" ");
    if (!/\b(CAMISA|REGATA|RET[RÔO])\b/i.test(sourceTitles)) {
      throw new Error(`Produto fora do escopo de camisas retrô: ${product.sourceTitle ?? product.name}`);
    }

    const name = forceRetroName(product.name);
    const variants = product.variants.map((variant, variantIndex) => {
      const variantName = retroVariantName(variant, product.variants.length, variantIndex);
      const code =
        product.variants.length === 1
          ? "retro"
          : `retro-${String(variantIndex + 1).padStart(2, "0")}`;
      return {
        ...variant,
        code,
        name: variantName,
        commercialType: "retro",
        price: RETRO_PRICE,
      };
    });

    return {
      ...product,
      name,
      description: `${name}. Versão Retrô. Disponível com as opções de tamanho e personalização configuradas pela BIGofertas.`,
      category: { name: "Camisas Retrô", slug: "retro" },
      competition: null,
      league: null,
      commercialType: "retro",
      price: RETRO_PRICE,
      specifications: retroSpecifications(product.specifications),
      personalizationEnabled: true,
      phraseEnabled: true,
      patches: [],
      variants,
    };
  }),
};

const keys = normalized.products.map((product) => product.sourceKey);
if (new Set(keys).size !== keys.length) throw new Error("sourceKey duplicada no plano retrô.");
normalized.summary = {
  products: normalized.products.length,
  variants: normalized.products.reduce((sum, product) => sum + product.variants.length, 0),
  images: normalized.products.reduce(
    (sum, product) =>
      sum + product.variants.reduce((inner, variant) => inner + (variant.images?.length ?? 0), 0),
    0,
  ),
};
normalized.warnings = [...(Array.isArray(input.warnings) ? input.warnings : [])];

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
console.log(
  `RETRO_PLAN_OK products=${normalized.summary.products} variants=${normalized.summary.variants} images=${normalized.summary.images}`,
);
