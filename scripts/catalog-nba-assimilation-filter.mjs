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

const options = parseArgs(process.argv.slice(2));
const assimilation = JSON.parse(fs.readFileSync(path.resolve(options.input), "utf8"));
if (!Array.isArray(assimilation.proposedProducts)) {
  throw new Error("Assimilação NBA sem proposedProducts.");
}

const allowed = new Set(["camisa", "regata", "basquete"]);
const kept = assimilation.proposedProducts.filter((product) => allowed.has(product.type));
const skipped = assimilation.proposedProducts.filter((product) => !allowed.has(product.type));
if (kept.length === 0) {
  throw new Error("Nenhuma camisa/regata NBA foi identificada no álbum.");
}

const filtered = { ...assimilation, proposedProducts: kept };
const report = {
  before: assimilation.proposedProducts.length,
  kept: kept.length,
  skipped: skipped.map((product) => ({
    type: product.type,
    entity: product.entity,
    season: product.season,
    groups: product.groups?.map((group) => group.title) ?? [],
  })),
};

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(options.report)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(filtered, null, 2)}\n`, "utf8");
fs.writeFileSync(path.resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`NBA_SCOPE_FILTER_OK before=${report.before} kept=${report.kept} skipped=${report.skipped.length}`);
