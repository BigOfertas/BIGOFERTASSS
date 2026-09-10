import fs from "node:fs";
import path from "node:path";

const PRICE_BY_TYPE = Object.freeze({
  torcedor: 184.9,
  feminino: 184.9,
  jogador: 219.9,
  infantil: 169.9,
  calcao: 159.9,
});

function parseArgs(argv) {
  const out = { manifest: "", root: "", output: "", groupDir: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") out.manifest = argv[++index];
    else if (arg === "--root") out.root = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else if (arg === "--group-dir") out.groupDir = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.manifest || !out.root || !out.output || !out.groupDir) {
    throw new Error("Use --manifest, --root, --output e --group-dir.");
  }
  return out;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function walk(root) {
  if (!fs.existsSync(root)) return [];
  const output = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...walk(full));
    else if (entry.isFile() && entry.name === "plan.json") output.push(full);
  }
  return output;
}

const options = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(fs.readFileSync(path.resolve(options.manifest), "utf8"));
const groups = Array.isArray(manifest.groups) ? manifest.groups : [];
if (groups.length === 0) throw new Error("Manifesto sem grupos.");

const planFiles = walk(path.resolve(options.root));
if (planFiles.length === 0) throw new Error("Nenhum plan.json encontrado nos artefatos.");
const plans = planFiles.map((file) => ({ file, data: JSON.parse(fs.readFileSync(file, "utf8")) }));
const consumed = new Set();
const allProducts = [];
const groupSummaries = [];
fs.mkdirSync(path.resolve(options.groupDir), { recursive: true });

for (const group of groups) {
  const expected = Array.isArray(group.albums) ? group.albums : [];
  const groupPlans = plans.filter(({ data }) => data.pdfGroupId === group.id);
  if (groupPlans.length !== expected.length) {
    throw new Error(
      `${group.name}: esperados ${expected.length} planos, encontrados ${groupPlans.length}.`,
    );
  }
  const bySource = new Map();
  for (const item of groupPlans) {
    const key = normalize(item.data.sourceGroup);
    if (bySource.has(key))
      throw new Error(`${group.name}: plano duplicado para ${item.data.sourceGroup}.`);
    bySource.set(key, item);
  }

  const products = [];
  const albumSummaries = [];
  for (const [index, album] of expected.entries()) {
    const item = bySource.get(normalize(album.name));
    if (!item) throw new Error(`${group.name}: plano ausente para ${album.name}.`);
    consumed.add(item.file);
    const plan = item.data;
    if (!Array.isArray(plan.products) || plan.products.length === 0) {
      throw new Error(`${group.name}/${album.name}: plano vazio.`);
    }
    for (const product of plan.products) {
      const expectedTypePrice = PRICE_BY_TYPE[product.commercialType];
      if (
        !Number.isFinite(expectedTypePrice) ||
        Math.abs(Number(product.price) - expectedTypePrice) > 0.001
      ) {
        throw new Error(`${group.name}/${album.name}: preço/tipo inválido em ${product.name}.`);
      }
      if (group.mode === "club") {
        if (normalize(product.team) !== normalize(album.name)) {
          throw new Error(
            `${group.name}: ${product.name} associado ao time incorreto (${product.team}).`,
          );
        }
        if (group.league && normalize(product.league) !== normalize(group.league)) {
          throw new Error(`${group.name}/${album.name}: liga incorreta em ${product.name}.`);
        }
        if (group.competition && normalize(product.competition) !== normalize(group.competition)) {
          throw new Error(`${group.name}/${album.name}: campeonato incorreto em ${product.name}.`);
        }
        if (product.commercialType === "retro") {
          throw new Error(
            `${group.name}/${album.name}: produto retrô entrou em lote que não deve refazer Retrô.`,
          );
        }
      } else if (group.mode === "kids" && product.commercialType !== "infantil") {
        throw new Error(`Kids: produto não infantil em ${product.name}.`);
      } else if (group.mode === "shorts" && product.commercialType !== "calcao") {
        throw new Error(`Shorts: produto não classificado como calção em ${product.name}.`);
      }
      if (!Array.isArray(product.variants) || product.variants.length === 0) {
        throw new Error(`${group.name}/${album.name}: produto sem variantes.`);
      }
      for (const variant of product.variants) {
        if (!Array.isArray(variant.images) || variant.images.length === 0) {
          throw new Error(`${group.name}/${album.name}: variante sem imagem em ${product.name}.`);
        }
      }
      products.push(product);
    }
    albumSummaries.push({
      order: index + 1,
      name: album.name,
      sourceAlbumUrl: album.url,
      products: plan.products.length,
      variants: plan.products.reduce((sum, product) => sum + product.variants.length, 0),
      images: plan.products.reduce(
        (sum, product) =>
          sum +
          product.variants.reduce((inner, variant) => inner + (variant.images?.length ?? 0), 0),
        0,
      ),
    });
  }

  const groupPlan = {
    schemaVersion: 1,
    batchKey: `${manifest.request_id}:${group.id}`,
    sourceAlbumUrl: `pdf:${group.id}:page-${group.page}`,
    pdfGroupId: group.id,
    pdfGroupName: group.name,
    products,
    summary: {
      albums: expected.length,
      products: products.length,
      variants: products.reduce((sum, product) => sum + product.variants.length, 0),
      images: products.reduce(
        (sum, product) =>
          sum +
          product.variants.reduce((inner, variant) => inner + (variant.images?.length ?? 0), 0),
        0,
      ),
    },
    albumSummaries,
  };
  fs.writeFileSync(
    path.resolve(options.groupDir, `${group.id}.json`),
    `${JSON.stringify(groupPlan, null, 2)}\n`,
    "utf8",
  );
  allProducts.push(...products);
  groupSummaries.push({ id: group.id, name: group.name, ...groupPlan.summary });
}

if (consumed.size !== plans.length) {
  const extras = plans.filter((item) => !consumed.has(item.file)).map((item) => item.file);
  throw new Error(`Há planos não reconhecidos: ${extras.join(", ")}`);
}
const sourceKeys = allProducts.map((product) => product.sourceKey);
if (sourceKeys.some((key) => !key)) throw new Error("Há produto sem sourceKey.");
if (new Set(sourceKeys).size !== sourceKeys.length)
  throw new Error("Há sourceKey duplicada entre os lotes restantes.");

const merged = {
  schemaVersion: 1,
  batchKey: manifest.request_id,
  sourceAlbumUrl: "pdf:remaining-groups",
  products: allProducts,
  summary: {
    groups: groups.length,
    albums: groups.reduce((sum, group) => sum + group.albums.length, 0),
    products: allProducts.length,
    variants: allProducts.reduce((sum, product) => sum + product.variants.length, 0),
    images: allProducts.reduce(
      (sum, product) =>
        sum + product.variants.reduce((inner, variant) => inner + (variant.images?.length ?? 0), 0),
      0,
    ),
  },
  groupSummaries,
};
fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log(
  `PDF_REMAINING_MERGE_OK groups=${merged.summary.groups} albums=${merged.summary.albums} products=${merged.summary.products} variants=${merged.summary.variants} images=${merged.summary.images}`,
);
