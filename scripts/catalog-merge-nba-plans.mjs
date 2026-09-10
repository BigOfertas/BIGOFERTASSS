import fs from "node:fs";
import path from "node:path";

const EXPECTED_ALBUMS = 30;
const NBA_PRICE = 229.9;

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

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

const options = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(fs.readFileSync(path.resolve(options.manifest), "utf8"));
const albums = Array.isArray(manifest.albums) ? manifest.albums : [];
if (albums.length !== EXPECTED_ALBUMS) {
  throw new Error(`Esperados ${EXPECTED_ALBUMS} álbuns NBA; recebidos ${albums.length}.`);
}

const products = [];
const albumSummaries = [];
for (const [index, album] of albums.entries()) {
  const artifactName = `nba-plan-${String(index + 1).padStart(2, "0")}`;
  const planPath = path.resolve(options.root, artifactName, "plan.json");
  if (!fs.existsSync(planPath)) throw new Error(`Plano ausente: ${artifactName}`);
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  if (!Array.isArray(plan.products) || plan.products.length === 0) {
    throw new Error(`${album.name}: plano NBA vazio.`);
  }

  for (const product of plan.products) {
    if (normalize(product.team) !== normalize(album.name)) {
      throw new Error(`${album.name}: produto associado a time incorreto (${product.team}).`);
    }
    if (normalize(product.competition) !== "NBA" || normalize(product.league) !== "NBA") {
      throw new Error(`${album.name}: liga/campeonato incorreto em ${product.name}.`);
    }
    if (
      product.commercialType !== "basquete" ||
      Math.abs(Number(product.price) - NBA_PRICE) > 0.001
    ) {
      throw new Error(`${album.name}: preço/tipo comercial inválido em ${product.name}.`);
    }
    if (!Array.isArray(product.variants) || product.variants.length === 0) {
      throw new Error(`${album.name}: produto sem variante.`);
    }
    const codes = product.variants.map((variant) => variant.code);
    if (new Set(codes).size !== codes.length) {
      throw new Error(`${album.name}: códigos de variação duplicados em ${product.name}.`);
    }
    for (const variant of product.variants) {
      if (
        variant.commercialType !== "basquete" ||
        Math.abs(Number(variant.price) - NBA_PRICE) > 0.001
      ) {
        throw new Error(`${album.name}: variante NBA com preço/tipo incorreto em ${product.name}.`);
      }
      if (!Array.isArray(variant.images) || variant.images.length === 0) {
        throw new Error(`${album.name}: variante sem imagem em ${product.name}.`);
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
        sum + product.variants.reduce((inner, variant) => inner + (variant.images?.length ?? 0), 0),
      0,
    ),
  });
}

const sourceKeys = products.map((product) => product.sourceKey);
if (sourceKeys.some((key) => !key)) throw new Error("Produto NBA sem sourceKey.");
if (new Set(sourceKeys).size !== sourceKeys.length) {
  throw new Error("sourceKey duplicada entre álbuns NBA.");
}

const merged = {
  schemaVersion: 1,
  batchKey: manifest.request_id || "nba-pdf-page-7",
  sourceAlbumUrl: "pdf:nba:page-7",
  products,
  summary: {
    albums: albums.length,
    products: products.length,
    variants: products.reduce((sum, product) => sum + product.variants.length, 0),
    images: products.reduce(
      (sum, product) =>
        sum + product.variants.reduce((inner, variant) => inner + (variant.images?.length ?? 0), 0),
      0,
    ),
  },
  albumSummaries,
};

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log(
  `NBA_MERGE_OK albums=${merged.summary.albums} products=${merged.summary.products} variants=${merged.summary.variants} images=${merged.summary.images}`,
);
