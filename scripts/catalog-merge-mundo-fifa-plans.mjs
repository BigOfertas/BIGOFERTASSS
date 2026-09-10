import fs from "node:fs";
import path from "node:path";

const EXPECTED_ALBUMS = 47;
const SOURCE_EMPTY_ALBUMS = new Set(["SERVIA"]);
const PRICE_BY_TYPE = Object.freeze({
  torcedor: 184.9,
  feminino: 184.9,
  jogador: 219.9,
  retro: 219.9,
  infantil: 169.9,
});

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

function normalized(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

const options = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(fs.readFileSync(path.resolve(options.manifest), "utf8"));
const albums = Array.isArray(manifest.albums) ? manifest.albums : [];
if (albums.length !== EXPECTED_ALBUMS) {
  throw new Error(`Esperados ${EXPECTED_ALBUMS} álbuns do Mundo FIFA; recebidos ${albums.length}.`);
}
if (albums.some((album) => normalized(album.name) === "ARGELIA")) {
  throw new Error("Argélia não pode fazer parte do manifesto Mundo FIFA.");
}

const products = [];
const albumSummaries = [];
const sourceSkips = [];
for (const [index, album] of albums.entries()) {
  if (SOURCE_EMPTY_ALBUMS.has(normalized(album.name))) {
    albumSummaries.push({
      order: index + 1,
      name: album.name,
      sourceAlbumUrl: album.url,
      products: 0,
      variants: 0,
      images: 0,
      skippedSource: true,
      reason: "Álbum-fonte verificado sem imagens de produto em coletas independentes.",
    });
    sourceSkips.push({
      name: album.name,
      reason: "Álbum-fonte verificado sem imagens de produto em coletas independentes.",
    });
    continue;
  }

  const artifactName = `mundo-fifa-plan-${String(index + 1).padStart(2, "0")}`;
  const planPath = path.resolve(options.root, artifactName, "plan.json");
  if (!fs.existsSync(planPath)) throw new Error(`Plano ausente: ${artifactName}`);
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  if (!Array.isArray(plan.products) || plan.products.length === 0) {
    throw new Error(`${album.name}: plano vazio.`);
  }

  for (const product of plan.products) {
    if (normalized(product.team) !== normalized(album.name)) {
      throw new Error(`${album.name}: produto associado a seleção incorreta (${product.team}).`);
    }
    if (normalized(product.competition) !== "COPA DO MUNDO") {
      throw new Error(`${album.name}: campeonato incorreto em ${product.name}.`);
    }
    const expectedPrice = PRICE_BY_TYPE[product.commercialType];
    if (
      !Number.isFinite(expectedPrice) ||
      Math.abs(Number(product.price) - expectedPrice) > 0.001
    ) {
      throw new Error(`${album.name}: preço/tipo comercial inválido em ${product.name}.`);
    }
    if (!Array.isArray(product.variants) || product.variants.length === 0) {
      throw new Error(`${album.name}: produto sem variante.`);
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
if (sourceKeys.some((key) => !key)) throw new Error("Produto Mundo FIFA sem sourceKey.");
if (new Set(sourceKeys).size !== sourceKeys.length) {
  throw new Error("sourceKey duplicada entre álbuns do Mundo FIFA.");
}

const merged = {
  schemaVersion: 1,
  batchKey: manifest.request_id || "mundo-fifa-pdf-page-2",
  sourceAlbumUrl: "pdf:mundo-fifa:page-2",
  products,
  summary: {
    sourceAlbums: albums.length,
    albums: albums.length - sourceSkips.length,
    products: products.length,
    variants: products.reduce((sum, product) => sum + product.variants.length, 0),
    images: products.reduce(
      (sum, product) =>
        sum + product.variants.reduce((inner, variant) => inner + (variant.images?.length ?? 0), 0),
      0,
    ),
  },
  albumSummaries,
  skipped: [...(manifest.skipped ?? []), ...sourceSkips],
};

if (merged.summary.images < merged.summary.products) {
  throw new Error("Há produto Mundo FIFA sem imagem.");
}

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log(
  `MUNDO_FIFA_MERGE_OK sourceAlbums=${merged.summary.sourceAlbums} albums=${merged.summary.albums} products=${merged.summary.products} variants=${merged.summary.variants} images=${merged.summary.images} sourceSkips=${sourceSkips.length}`,
);
