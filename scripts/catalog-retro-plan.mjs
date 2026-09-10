import fs from "node:fs";
import path from "node:path";

const RETRO_PRICE = 219.9;

function parseArgs(argv) {
  const out = { input: "", output: "", sourceGroup: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") out.input = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else if (arg === "--source-group") out.sourceGroup = argv[++index];
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
    ["PARIS", "PSG"],
    ["PARIS SAINT GERMAIN", "PSG"],
    ["PSG", "PSG"],
    ["INTERZIONALE", "Internazionale"],
    ["INTER", "Internazionale"],
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

function stripPattern(value, pattern) {
  return value.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

function normalizeSeasonToken(value) {
  const token = String(value).replace("-", "/");
  const parts = token.split("/");
  let first = parts[0];
  const second = parts[1] ?? null;

  // Supplier titles occasionally duplicate one digit in a four-digit year
  // (e.g. 20008/09, 19989/91). Preserve sourceTitle, but normalize the public season.
  if (/^\d{5}$/.test(first)) {
    first = `${first.slice(0, 2)}${first.slice(-2)}`;
  }

  if (/^\d{2}$/.test(first)) {
    const year = Number(first);
    const century = year <= 29 ? "20" : "19";
    return second ? `${century}${first}/${second}` : `${century}${first}`;
  }

  if (/^(?:19|20)\d{2}$/.test(first)) {
    return second ? `${first}/${second}` : first;
  }

  return token;
}

function parseRetroIdentity(product, sourceGroup) {
  const sourceTitle = String(
    product.sourceTitle ?? product.variants?.[0]?.sourceTitle ?? "",
  ).trim();
  const parseTitle = sourceTitle;
  const typeMatch = parseTitle.match(/^(CAMISA|REGATA)\b/i);
  if (!typeMatch) {
    throw new Error(`Título fora do escopo de camisas retrô: ${sourceTitle}`);
  }

  // Read the last year-like token. This intentionally accepts malformed supplier
  // years with 5 digits and standalone 2-digit seasons; normalizeSeasonToken fixes
  // the public value while sourceTitle remains byte-for-byte unchanged.
  const seasonMatches = [...parseTitle.matchAll(/(\d{2,5}(?:[/-]\d{2,4})?)/g)];
  const seasonMatch = seasonMatches.at(-1);
  if (!seasonMatch || seasonMatch.index === undefined) {
    throw new Error(`Temporada retrô não identificada com segurança: ${sourceTitle}`);
  }

  const season = normalizeSeasonToken(seasonMatch[1]);
  const beforeSeason = parseTitle
    .slice(typeMatch[0].length, seasonMatch.index)
    .replace(/\s+/g, " ")
    .trim();
  const sourceTail = parseTitle
    .slice(seasonMatch.index + seasonMatch[0].length)
    .replace(/\s+/g, " ")
    .trim();

  let remainder = beforeSeason;
  const modelMatch = remainder.match(/^(I|II|III|IV)\b/i);
  const model = modelMatch?.[1]?.toUpperCase() ?? null;
  if (modelMatch) remainder = stripPattern(remainder, /^(I|II|III|IV)\b/i);

  const descriptors = [];
  const descriptorPatterns = [
    ["Pré-jogo", /\bPR[ÉE]-?JOGO\b/gi],
    ["Treino", /\bDE\s+TREINO\b/gi],
    ["Treino", /\bTREINO\b/gi],
    ["Manga Longa", /\bMANGA\s+LONGA\b/gi],
    ["Final Champions", /\bFINAL\s+CHAMPIONS\b/gi],
    ["Goleiro", /\bGOLEIRO\b/gi],
    ["Feminina", /\bFEMININ[AO]\b/gi],
    ["Jogador", /\b(?:PLAYER|JOGADOR)\b/gi],
  ];
  for (const [label, pattern] of descriptorPatterns) {
    if (pattern.test(remainder) && !descriptors.includes(label)) descriptors.push(label);
    pattern.lastIndex = 0;
    remainder = stripPattern(remainder, pattern);
  }
  remainder = stripPattern(remainder, /\b(?:RETRO|RETRÔ)\b/gi);

  const normalizedGroup = String(sourceGroup ?? "").trim();
  const team =
    normalizedGroup && normalizedGroup.toUpperCase() !== "OUTROS"
      ? displayEntity(normalizedGroup)
      : displayEntity(remainder);
  const brand = displayEntity(sourceTail || product.brand);
  if (!team || !season) throw new Error(`Identidade retrô incompleta: ${sourceTitle}`);

  return {
    sourceTitle,
    type: typeMatch[1].toUpperCase() === "REGATA" ? "Regata" : "Camisa",
    model,
    team,
    season,
    brand: brand || null,
    descriptors,
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
    identity.descriptors.length > 0 ? `Detalhes: ${identity.descriptors.join(", ")}` : null,
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

    const identity = parseRetroIdentity(product, options.sourceGroup);
    const name = [
      `${identity.team} — ${identity.type} Retrô`,
      identity.model,
      ...identity.descriptors,
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
