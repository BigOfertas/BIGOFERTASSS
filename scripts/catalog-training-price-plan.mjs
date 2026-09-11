import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = {
    plan: "",
    collector: "",
    map: "catalog-jobs/apparel-batch/training-price-map.json",
    output: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") out.plan = argv[++index];
    else if (arg === "--collector") out.collector = argv[++index];
    else if (arg === "--map") out.map = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.plan || !out.collector || !out.output) {
    throw new Error("Use --plan, --collector e --output.");
  }
  return out;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function nearly(a, b) {
  return Math.abs(Number(a) - Number(b)) <= 0.001;
}

const options = parseArgs(process.argv.slice(2));
const plan = JSON.parse(fs.readFileSync(path.resolve(options.plan), "utf8"));
const collector = JSON.parse(fs.readFileSync(path.resolve(options.collector), "utf8"));
const priceMap = JSON.parse(fs.readFileSync(path.resolve(options.map), "utf8"));

if (!Array.isArray(plan.products) || plan.products.length === 0) throw new Error("Plano de treino vazio.");
if (!Array.isArray(collector.groups) || collector.groups.length === 0) throw new Error("Coletor de treino inválido.");
if (!Array.isArray(priceMap.entries) || priceMap.entries.length === 0) throw new Error("Mapa de preços vazio.");
if (!String(plan.batchKey || "").startsWith("pdf-apparel:treino:")) throw new Error(`Plano não é de treino: ${plan.batchKey}`);

const expected = priceMap.expectedCollector ?? {};
const collectorImages = collector.groups.reduce((sum, group) => sum + (group.images?.length ?? 0), 0);
if (collector.groups.length !== Number(expected.groups)) {
  throw new Error(`Fonte mudou: grupos=${collector.groups.length}, esperado=${expected.groups}.`);
}
if (collectorImages !== Number(expected.images)) {
  throw new Error(`Fonte mudou: imagens=${collectorImages}, esperado=${expected.images}.`);
}
if (priceMap.entries.length !== Number(expected.productGroups)) {
  throw new Error(`Mapa incompleto: entries=${priceMap.entries.length}, esperado=${expected.productGroups}.`);
}

const approved = {
  "camisa-calcao": 259.9,
  "regata-calcao": 259.9,
  "casaco-calca": 389.9,
  "top-treino-calca": 339.9,
};

const byFirstImage = new Map();
for (const entry of priceMap.entries) {
  const groupIndex = Number(entry.groupIndex);
  if (!Number.isInteger(groupIndex) || groupIndex < 1 || groupIndex > collector.groups.length) {
    throw new Error(`groupIndex inválido no mapa: ${entry.groupIndex}`);
  }
  const group = collector.groups[groupIndex - 1];
  if (clean(group.title) !== clean(entry.sourceTitle)) {
    throw new Error(`Fonte mudou no grupo ${groupIndex}: título ${JSON.stringify(group.title)} != ${JSON.stringify(entry.sourceTitle)}.`);
  }
  if ((group.images?.length ?? 0) !== Number(entry.images)) {
    throw new Error(`Fonte mudou no grupo ${groupIndex}: imagens=${group.images?.length ?? 0}, esperado=${entry.images}.`);
  }
  const expectedPrice = approved[entry.kitType];
  if (!Number.isFinite(expectedPrice) || !nearly(entry.price, expectedPrice)) {
    throw new Error(`Preço/tipo não aprovado no grupo ${groupIndex}: ${entry.kitType} / ${entry.price}.`);
  }
  const mediaKey = clean(group.images?.[0]?.mediaKey);
  if (!mediaKey) throw new Error(`Grupo ${groupIndex} sem mediaKey primária.`);
  const sourceKey = `google_photos:${mediaKey}`;
  if (byFirstImage.has(sourceKey)) throw new Error(`Imagem primária duplicada no mapa: ${sourceKey}`);
  byFirstImage.set(sourceKey, {
    groupIndex,
    sourceTitle: entry.sourceTitle,
    kitType: entry.kitType,
    label: entry.label,
    price: Number(entry.price),
  });
}

let classifiedVariants = 0;
const usedFirstImages = new Set();
const priceBreakdown = new Map();
for (const product of plan.products) {
  if (!Array.isArray(product.variants) || product.variants.length === 0) {
    throw new Error(`Produto sem variações: ${product.name}`);
  }
  const rules = [];
  for (const variant of product.variants) {
    const firstImageSourceKey = clean(variant.images?.[0]?.sourceKey);
    const rule = byFirstImage.get(firstImageSourceKey);
    if (!rule) {
      throw new Error(`Variação não classificada: ${product.name} / ${variant.name} / ${firstImageSourceKey}`);
    }
    if (clean(variant.sourceTitle) !== clean(rule.sourceTitle)) {
      throw new Error(`Título divergente na classificação: ${variant.sourceTitle} != ${rule.sourceTitle}`);
    }
    variant.price = rule.price;
    variant.name = rule.label;
    variant.kitType = rule.kitType;
    rules.push(rule);
    usedFirstImages.add(firstImageSourceKey);
    classifiedVariants += 1;
    priceBreakdown.set(rule.price, (priceBreakdown.get(rule.price) ?? 0) + 1);
  }

  const totals = new Map();
  for (const variant of product.variants) totals.set(variant.name, (totals.get(variant.name) ?? 0) + 1);
  const seen = new Map();
  for (const variant of product.variants) {
    if ((totals.get(variant.name) ?? 0) <= 1) continue;
    const ordinal = (seen.get(variant.name) ?? 0) + 1;
    seen.set(variant.name, ordinal);
    variant.name = `${variant.name} ${ordinal}`;
  }

  product.price = Math.min(...product.variants.map((variant) => Number(variant.price)));
  product.specifications = [
    clean(product.specifications),
    product.variants.length > 1 ? "Preço conforme a versão do kit" : null,
  ].filter(Boolean).join(" | ");
}

if (classifiedVariants !== Number(expected.productGroups)) {
  throw new Error(`Variações classificadas=${classifiedVariants}, esperado=${expected.productGroups}.`);
}
if (usedFirstImages.size !== byFirstImage.size) {
  throw new Error(`Cobertura do mapa incompleta: usadas=${usedFirstImages.size}, mapa=${byFirstImage.size}.`);
}

const planImages = plan.products.reduce(
  (sum, product) => sum + product.variants.reduce((inner, variant) => inner + variant.images.length, 0),
  0,
);
if (planImages !== Number(expected.productImages)) {
  throw new Error(`Imagens de produto=${planImages}, esperado=${expected.productImages}.`);
}

plan.batchKey = `${plan.batchKey}:approved-prices-20260911`;
plan.summary = {
  ...plan.summary,
  priceBreakdown: Object.fromEntries(
    [...priceBreakdown.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([price, count]) => [Number(price).toFixed(2), count]),
  ),
};
plan.warnings = [
  ...(Array.isArray(plan.warnings) ? plan.warnings : []),
  "Corta-Vento não faz parte deste lote e permanece congelado.",
];

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
console.log(
  `TRAINING_PRICE_PLAN_OK products=${plan.products.length} variants=${classifiedVariants} images=${planImages} price33990=${priceBreakdown.get(339.9) ?? 0} price38990=${priceBreakdown.get(389.9) ?? 0}`,
);
