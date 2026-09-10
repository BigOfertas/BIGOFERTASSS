import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = { input: "", output: "", report: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") out.input = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else if (arg === "--report") out.report = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.input || !out.output || !out.report) {
    throw new Error("Use --input, --output e --report.");
  }
  return out;
}

function shouldKeep(product) {
  if (product.type === "camisa" || product.type === "regata" || product.type === "shorts") {
    return true;
  }
  if (product.type === "kit" || product.type === "conjunto") {
    return product.audience === "infantil";
  }
  return false;
}

const options = parseArgs(process.argv.slice(2));
const assimilation = JSON.parse(fs.readFileSync(path.resolve(options.input), "utf8"));
if (!Array.isArray(assimilation.proposedProducts)) {
  throw new Error("Assimilação sem proposedProducts.");
}

const kept = assimilation.proposedProducts.filter(shouldKeep);
const skipped = assimilation.proposedProducts.filter((product) => !shouldKeep(product));
if (kept.length === 0) {
  throw new Error(
    "Nenhuma camisa, short ou kit infantil restou no álbum do Campeonato Brasileiro.",
  );
}

const filtered = {
  ...assimilation,
  proposedProducts: kept,
};
const report = {
  before: assimilation.proposedProducts.length,
  kept: kept.length,
  skipped: skipped.map((product) => ({
    type: product.type,
    audience: product.audience ?? null,
    entity: product.entity,
    season: product.season,
    groups: product.groups?.map((group) => group.title) ?? [],
  })),
};

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(options.report)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(filtered, null, 2)}\n`, "utf8");
fs.writeFileSync(path.resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  `BRASILEIRAO_SCOPE_FILTER_OK before=${report.before} kept=${report.kept} skipped=${report.skipped.length}`,
);
