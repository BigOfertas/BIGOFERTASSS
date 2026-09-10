import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = { manifest: "", root: "", output: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") out.manifest = argv[++index];
    else if (arg === "--root") out.root = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.manifest || !out.root || !out.output) {
    throw new Error("Use --manifest, --root e --output.");
  }
  return out;
}

const options = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(fs.readFileSync(path.resolve(options.manifest), "utf8"));
if (!Array.isArray(manifest.albums) || manifest.albums.length === 0) {
  throw new Error("Manifesto sem álbuns.");
}

const products = [];
const albumSummaries = [];
for (const [index, album] of manifest.albums.entries()) {
  const artifactName = `catalog-group-plan-${String(index + 1).padStart(2, "0")}`;
  const planPath = path.resolve(options.root, artifactName, "plan.json");
  if (!fs.existsSync(planPath)) throw new Error(`Plano ausente: ${artifactName}`);
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  if (!Array.isArray(plan.products) || plan.products.length === 0) {
    throw new Error(`${album.name}: plano vazio.`);
  }
  for (const product of plan.products) {
    products.push({ ...product, sourceGroup: album.name, sourceGroupOrder: index + 1 });
  }
  albumSummaries.push({
    order: index + 1,
    name: album.name,
    sourceAlbumUrl: album.url,
    products: plan.products.length,
    variants: plan.products.reduce((sum, product) => sum + (product.variants?.length ?? 0), 0),
    images: plan.products.reduce(
      (sum, product) =>
        sum +
        (product.variants ?? []).reduce(
          (inner, variant) => inner + (variant.images?.length ?? 0),
          0,
        ),
      0,
    ),
  });
}

const sourceKeys = products.map((product) => product.sourceKey);
if (sourceKeys.some((key) => !key)) throw new Error("Produto sem sourceKey.");
if (new Set(sourceKeys).size !== sourceKeys.length) throw new Error("sourceKey duplicada entre álbuns.");

const names = products.map((product) => String(product.name ?? "").trim().toLocaleLowerCase("pt-BR"));
const duplicateNames = names.filter((name, index) => name && names.indexOf(name) !== index);
if (duplicateNames.length > 0) {
  throw new Error(`Nomes públicos duplicados entre álbuns: ${[...new Set(duplicateNames)].join(", ")}`);
}

const merged = {
  schemaVersion: 1,
  batchKey: manifest.request_id || "pdf-camisas-retro",
  sourceAlbumUrl: "pdf:camisas-retro:page-6",
  products: products.map(({ sourceGroup, sourceGroupOrder, ...product }) => product),
  summary: {
    albums: manifest.albums.length,
    products: products.length,
    variants: products.reduce((sum, product) => sum + (product.variants?.length ?? 0), 0),
    images: products.reduce(
      (sum, product) =>
        sum +
        (product.variants ?? []).reduce(
          (inner, variant) => inner + (variant.images?.length ?? 0),
          0,
        ),
      0,
    ),
  },
  albumSummaries,
  warnings: [],
};

if (merged.summary.albums !== 30) throw new Error(`Esperados 30 álbuns retrô; recebidos ${merged.summary.albums}.`);
if (merged.summary.products < 29) throw new Error(`Poucos produtos retrô: ${merged.summary.products}.`);
if (merged.summary.images < merged.summary.products) throw new Error("Há produto retrô sem imagem.");
for (const product of merged.products) {
  if (product.category?.slug !== "retro") throw new Error(`${product.name}: categoria não é retro.`);
  if (product.commercialType !== "retro") throw new Error(`${product.name}: tipo comercial não é retro.`);
  if (Number(product.price) !== 219.9) throw new Error(`${product.name}: preço retrô incorreto.`);
  if ((product.patches ?? []).length !== 0) throw new Error(`${product.name}: patch automático indevido em retrô.`);
}

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log(
  `RETRO_MERGE_OK albums=${merged.summary.albums} products=${merged.summary.products} variants=${merged.summary.variants} images=${merged.summary.images}`,
);
