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

function displayEntity(value) {
  const clean = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const upper = clean.toUpperCase();
  const aliases = new Map([
    ["M. CITY", "Manchester City"],
    ["MAN. CITY", "Manchester City"],
    ["MAN CITY", "Manchester City"],
    ["M. UNITED", "Manchester United"],
    ["MAN. UNITED", "Manchester United"],
    ["MAN UNITED", "Manchester United"],
    ["PARIS SAINT GERMAIN", "PSG"],
    ["PSG", "PSG"],
    ["INTERZIONALE", "Internazionale"],
    ["AC MILAN", "Milan"],
  ]);
  if (aliases.has(upper)) return aliases.get(upper);
  const keepUpper = new Set(["AC", "FC", "PSG", "EA7"]);
  return clean
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const token = word.toUpperCase();
      return keepUpper.has(token) ? token : token.slice(0, 1) + token.slice(1).toLowerCase();
    })
    .join(" ");
}

function parseRetroIdentity(product) {
  const sourceTitle = String(
    product.sourceTitle ?? product.variants?.[0]?.sourceTitle ?? "",
  ).trim();
  const match = sourceTitle.match(
    /^(CAMISA|REGATA)\s+(?:(I|II|III)\s+)?(.+?)\s+((?:19|20)\d{2}|\d{2}\/\d{2})(?:\s+(.+))?$/i,
  );
  if (!match) {
    throw new Error(`Título retrô não pôde ser estruturado com segurança: ${sourceTitle}`);
  }
  const [, sourceType, model, rawTeam, season, sourceTail] = match;
  const team = displayEntity(rawTeam);
  const brand = product.brand ? displayEntity(product.brand) : displayEntity(sourceTail);
  if (!team || !season) throw new Error(`Identidade retrô incompleta: ${sourceTitle}`);
  return {
    sourceTitle,
    type: sourceType.toUpperCase() === "REGATA" ? "Regata" : "Camisa",
    model: model?.toUpperCase() ?? null,
    team,
    season,
    brand: brand || null,
  };
}

function retroSpecifications(identity, value) {
  const uniform = String(value ?? "")
    .split("|")
    .map((part) => part.trim())
    .find((part) => /^Uniforme\s*:/i.test(part));
  return [
    identity.brand ? `Marca: ${identity.brand}` : null,
    `Temporada: ${identity.season}`,
    "Versão: Retrô",
    uniform,
  ]
    .filter(Boolean)
    .join(" | ");
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

    const identity = parseRetroIdentity(product);
    const name = [
      `${identity.team} — ${identity.type} Retrô`,
      identity.model,
      identity.season,
      identity.brand,
    ]
      .filter(Boolean)
      .join(" ");
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
      sourceTitle: identity.sourceTitle,
      name,
      description: `${name}. Versão Retrô. Disponível com as opções de tamanho e personalização configuradas pela BIGofertas.`,
      category: { name: "Camisas Retrô", slug: "retro" },
      competition: null,
      league: null,
      team: identity.team,
      season: identity.season,
      brand: identity.brand,
      audience: "MASCULINO",
      commercialType: "retro",
      price: RETRO_PRICE,
      specifications: retroSpecifications(identity, product.specifications),
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
