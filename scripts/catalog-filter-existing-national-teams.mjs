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

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function signature(product) {
  return [
    normalize(product.team),
    normalize(product.name),
    normalize(product.season),
    normalize(product.commercialType),
  ].join("|");
}

const options = parseArgs(process.argv.slice(2));
const projectRef = String(process.env.SUPABASE_PROJECT_ID ?? "").trim();
const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
if (!projectRef || !accessToken) {
  throw new Error("SUPABASE_PROJECT_ID e SUPABASE_ACCESS_TOKEN são obrigatórios.");
}

const plan = JSON.parse(fs.readFileSync(path.resolve(options.input), "utf8"));
if (!Array.isArray(plan.products) || plan.products.length === 0) throw new Error("Plano vazio.");

const response = await fetch(
  `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query/read-only`,
  {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: `
        select
          p.catalog_source_key,
          p.catalog_source_title,
          p.name,
          p.time,
          p.season,
          p.catalog_code,
          s.commercial_type
        from public.products p
        left join public.product_purchase_settings s on s.product_id = p.id
        where p.status::text = 'active'
          and p.time is not null;
      `,
    }),
    signal: AbortSignal.timeout(120_000),
  },
);
const text = await response.text();
if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${text.slice(0, 2000)}`);
const existing = text ? JSON.parse(text) : [];

const sourceKeys = new Set(existing.map((row) => String(row.catalog_source_key ?? "")).filter(Boolean));
const titleKeys = new Set(
  existing
    .filter((row) => row.catalog_source_title && row.time)
    .map((row) => `${normalize(row.time)}|${normalize(row.catalog_source_title)}`),
);
const signatures = new Set(
  existing.map((row) =>
    [normalize(row.time), normalize(row.name), normalize(row.season), normalize(row.commercial_type)].join(
      "|",
    ),
  ),
);

const kept = [];
const skipped = [];
for (const product of plan.products) {
  const sourceKey = String(product.sourceKey ?? "");
  const titleKey = `${normalize(product.team)}|${normalize(product.sourceTitle)}`;
  const sig = signature(product);
  let reason = null;
  if (sourceKey && sourceKeys.has(sourceKey)) reason = "same_source_key";
  else if (product.sourceTitle && titleKeys.has(titleKey)) reason = "same_team_source_title";
  else if (signatures.has(sig)) reason = "same_team_name_season_type";

  if (reason) {
    skipped.push({
      reason,
      team: product.team,
      name: product.name,
      sourceTitle: product.sourceTitle ?? null,
    });
  } else {
    kept.push(product);
  }
}

const filtered = {
  ...plan,
  batchKey: `${plan.batchKey}:incremental`,
  products: kept,
  summary: {
    ...plan.summary,
    products: kept.length,
    variants: kept.reduce((sum, product) => sum + (product.variants?.length ?? 0), 0),
    images: kept.reduce(
      (sum, product) =>
        sum +
        (product.variants ?? []).reduce(
          (inner, variant) => inner + (variant.images?.length ?? 0),
          0,
        ),
      0,
    ),
    skippedExisting: skipped.length,
  },
};
const report = {
  before: plan.products.length,
  kept: kept.length,
  skippedExisting: skipped.length,
  skipped,
};

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(options.report)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(filtered, null, 2)}\n`, "utf8");
fs.writeFileSync(path.resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  `MUNDO_FIFA_EXISTING_FILTER_OK before=${report.before} kept=${report.kept} skipped=${report.skippedExisting}`,
);
