import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = { input: "", output: "", report: "", mode: "club" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") out.input = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else if (arg === "--report") out.report = argv[++index];
    else if (arg === "--mode") out.mode = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.input || !out.output || !out.report) {
    throw new Error("Use --input, --output e --report.");
  }
  if (!["club", "kids", "shorts"].includes(out.mode)) {
    throw new Error(`Modo inválido: ${out.mode}`);
  }
  return out;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function sourceText(product) {
  return normalize(
    [
      product?.entity,
      product?.type,
      product?.audience,
      product?.season,
      ...(product?.groups ?? []).map((group) => group?.title),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function shouldKeep(product, mode) {
  const type = String(product?.type ?? "").toLowerCase();
  const audience = normalize(product?.audience);
  const source = sourceText(product);
  const isInfantil = audience === "INFANTIL" || /\b(INFANTIL|INFATIL|KIDS?|CRIANCA)\b/.test(source);
  const isRetro = /\bRETRO\b/.test(source);
  const isTraining = /\b(TREINO|TRAINING|VIAGEM)\b/.test(source);
  const isWindbreaker = /\b(CORTA[ -]?VENTO|WINDBREAKER|JAQUETA|CASACO|AGASALHO)\b/.test(source);
  const isShorts = type === "shorts" || /\b(SHORTS?|CALCAO)\b/.test(source);
  const apparelType = ["camisa", "regata", "shorts", "kit", "conjunto"].includes(type);

  if (mode === "kids") {
    return apparelType && !isWindbreaker;
  }
  if (mode === "shorts") {
    return isShorts && !isWindbreaker;
  }

  if (isRetro || isWindbreaker || (isTraining && !isInfantil)) return false;
  if (type === "camisa" || type === "regata" || isShorts) return true;
  if (type === "kit" || type === "conjunto") return isInfantil;
  return false;
}

const options = parseArgs(process.argv.slice(2));
const assimilation = JSON.parse(fs.readFileSync(path.resolve(options.input), "utf8"));
if (!Array.isArray(assimilation.proposedProducts)) {
  throw new Error("Assimilação sem proposedProducts.");
}

const kept = assimilation.proposedProducts.filter((product) => shouldKeep(product, options.mode));
const skipped = assimilation.proposedProducts.filter(
  (product) => !shouldKeep(product, options.mode),
);
if (kept.length === 0) {
  throw new Error(`Nenhum produto elegível restou após o filtro ${options.mode}.`);
}

const filtered = { ...assimilation, proposedProducts: kept };
const report = {
  mode: options.mode,
  before: assimilation.proposedProducts.length,
  kept: kept.length,
  skipped: skipped.map((product) => ({
    type: product.type ?? null,
    audience: product.audience ?? null,
    entity: product.entity ?? null,
    season: product.season ?? null,
    groups: product.groups?.map((group) => group.title) ?? [],
  })),
};

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(options.report)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(filtered, null, 2)}\n`, "utf8");
fs.writeFileSync(path.resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  `PDF_REMAINING_SCOPE_OK mode=${options.mode} before=${report.before} kept=${report.kept} skipped=${report.skipped.length}`,
);
