import fs from "node:fs";
import path from "node:path";

const SOURCE_EMPTY_INDEXES = new Set([42]);
const SOURCE_TEAM_OVERRIDES = new Map([
  [13, "Coreia"],
  [14, "Croácia"],
  [15, "Dinamarca"],
  [16, "Equador"],
  [17, "Costa do Marfim"],
  [40, "Suécia"],
  [41, "Portugal"],
]);
const ALLOWED_CATEGORY_SLUGS = new Set(["camisas", "infantil"]);

function parseArgs(argv) {
  const out = { root: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") out.root = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.root) throw new Error("Use --root.");
  return out;
}

function imageKey(image) {
  return String(image?.sourceKey || image?.url || "").trim();
}

function mergeDuplicateVariants(product) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const merged = [];
  const byCode = new Map();

  for (const [index, variant] of variants.entries()) {
    const code = String(variant.code || `versao-${String(index + 1).padStart(2, "0")}`)
      .trim()
      .toLowerCase();
    if (!code) throw new Error(`${product.name}: variante sem código.`);

    const existing = byCode.get(code);
    if (!existing) {
      const copy = {
        ...variant,
        code,
        images: [],
      };
      const seenImages = new Set();
      for (const image of variant.images ?? []) {
        const key = imageKey(image);
        if (!key || seenImages.has(key)) continue;
        seenImages.add(key);
        copy.images.push(image);
      }
      if (copy.images.length === 0) throw new Error(`${product.name}/${code}: sem imagens.`);
      byCode.set(code, { variant: copy, seenImages });
      merged.push(copy);
      continue;
    }

    if (existing.variant.commercialType !== variant.commercialType) {
      throw new Error(`${product.name}/${code}: tipos comerciais conflitantes.`);
    }
    if (Math.abs(Number(existing.variant.price) - Number(variant.price)) > 0.001) {
      throw new Error(`${product.name}/${code}: preços conflitantes.`);
    }
    for (const image of variant.images ?? []) {
      const key = imageKey(image);
      if (!key || existing.seenImages.has(key)) continue;
      existing.seenImages.add(key);
      existing.variant.images.push(image);
    }
  }

  return merged;
}

function rewriteTeamText(value, team) {
  return String(value ?? "").replace(/Seleção:\s*[^.|]+(?=[.|]|$)/u, `Seleção: ${team}`);
}

const options = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root);
const dirs = fs
  .readdirSync(root)
  .filter((name) => /^mundo-fifa-plan-\d{2}$/.test(name))
  .sort();
const expected = Array.from({ length: 47 }, (_, index) => index + 1)
  .filter((index) => !SOURCE_EMPTY_INDEXES.has(index))
  .map((index) => `mundo-fifa-plan-${String(index).padStart(2, "0")}`);
const missing = expected.filter((name) => !dirs.includes(name));
const unexpected = dirs.filter((name) => !expected.includes(name));
if (missing.length || unexpected.length || dirs.length !== expected.length) {
  throw new Error(
    `Planos inválidos. total=${dirs.length} missing=${missing.join(",")} unexpected=${unexpected.join(",")}`,
  );
}

let removedProducts = 0;
let mergedVariants = 0;
let products = 0;
let variants = 0;
let images = 0;

for (const dir of dirs) {
  const sourceIndex = Number.parseInt(dir.slice(-2), 10);
  const file = path.join(root, dir, "plan.json");
  const plan = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = plan.products?.length ?? 0;
  const sourceTeam = plan.sourceGroup || plan.products?.[0]?.team;
  const actualTeam = SOURCE_TEAM_OVERRIDES.get(sourceIndex) ?? sourceTeam;
  if (!actualTeam) throw new Error(`${dir}: seleção não identificada.`);

  plan.products = (plan.products ?? [])
    .filter((product) => ALLOWED_CATEGORY_SLUGS.has(product.category?.slug))
    .map((product) => {
      const beforeVariants = product.variants?.length ?? 0;
      const cleanVariants = mergeDuplicateVariants(product);
      mergedVariants += beforeVariants - cleanVariants.length;
      return {
        ...product,
        team: actualTeam,
        description: rewriteTeamText(product.description, actualTeam),
        specifications: rewriteTeamText(product.specifications, actualTeam),
        variants: cleanVariants,
      };
    });

  if (plan.products.length === 0) {
    throw new Error(`${dir}/${actualTeam}: nenhum produto permitido no escopo final.`);
  }
  removedProducts += before - plan.products.length;
  plan.sourceGroup = actualTeam;

  const planVariants = plan.products.reduce(
    (sum, product) => sum + (product.variants?.length ?? 0),
    0,
  );
  const planImages = plan.products.reduce(
    (sum, product) =>
      sum +
      (product.variants ?? []).reduce((inner, variant) => inner + (variant.images?.length ?? 0), 0),
    0,
  );
  products += plan.products.length;
  variants += planVariants;
  images += planImages;
  plan.summary = {
    products: plan.products.length,
    variants: planVariants,
    images: planImages,
  };
  fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
}

console.log(
  `MUNDO_FIFA_SANITIZE_OK plans=${dirs.length} products=${products} variants=${variants} images=${images} frozenRemoved=${removedProducts} duplicateVariantsMerged=${mergedVariants} sourceSkipped=Serbia`,
);
