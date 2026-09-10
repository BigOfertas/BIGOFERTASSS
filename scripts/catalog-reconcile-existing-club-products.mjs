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

function signature(row) {
  return [
    normalize(row.time ?? row.team),
    normalize(row.name),
    normalize(row.season),
    normalize(row.commercial_type ?? row.commercialType),
  ].join("|");
}

function pushMap(map, key, row) {
  if (!key) return;
  const list = map.get(key) ?? [];
  list.push(row);
  map.set(key, list);
}

function uniqueCandidate(rows) {
  if (!rows || rows.length !== 1) return null;
  return rows[0];
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
          p.id::text as id,
          p.catalog_source_key,
          p.catalog_source_title,
          p.catalog_code,
          p.name,
          p.time,
          p.season,
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

const bySourceKey = new Map();
const byTitle = new Map();
const bySignature = new Map();
for (const row of existing) {
  const sourceKey = String(row.catalog_source_key ?? "").trim();
  if (sourceKey) bySourceKey.set(sourceKey, row);
  if (row.catalog_source_title) {
    pushMap(byTitle, `${normalize(row.time)}|${normalize(row.catalog_source_title)}`, row);
  }
  pushMap(bySignature, signature(row), row);
}

const kept = [];
const adopted = [];
const skipped = [];
for (const product of plan.products) {
  const incomingSourceKey = String(product.sourceKey ?? "").trim();
  if (incomingSourceKey && bySourceKey.has(incomingSourceKey)) {
    const row = bySourceKey.get(incomingSourceKey);
    kept.push({
      ...product,
      catalogCode: row.catalog_code ?? product.catalogCode,
    });
    adopted.push({
      mode: "same_source_key",
      team: product.team,
      name: product.name,
      catalogCode: row.catalog_code,
    });
    continue;
  }

  const titleKey = product.sourceTitle
    ? `${normalize(product.team)}|${normalize(product.sourceTitle)}`
    : null;
  const titleCandidate = titleKey ? uniqueCandidate(byTitle.get(titleKey)) : null;
  const signatureCandidate = uniqueCandidate(bySignature.get(signature(product)));
  const candidate = titleCandidate ?? signatureCandidate;

  if (!candidate) {
    const titleAmbiguous = titleKey && (byTitle.get(titleKey)?.length ?? 0) > 1;
    const signatureAmbiguous = (bySignature.get(signature(product))?.length ?? 0) > 1;
    if (titleAmbiguous || signatureAmbiguous) {
      skipped.push({
        reason: "ambiguous_existing_match",
        team: product.team,
        name: product.name,
        sourceTitle: product.sourceTitle ?? null,
      });
      continue;
    }
    kept.push(product);
    continue;
  }

  const existingSourceKey = String(candidate.catalog_source_key ?? "").trim();
  if (!existingSourceKey) {
    skipped.push({
      reason: "legacy_existing_without_source_key",
      team: product.team,
      name: product.name,
      sourceTitle: product.sourceTitle ?? null,
      catalogCode: candidate.catalog_code ?? null,
    });
    continue;
  }

  kept.push({
    ...product,
    sourceKey: existingSourceKey,
    catalogCode: candidate.catalog_code ?? product.catalogCode,
  });
  adopted.push({
    mode: titleCandidate ? "same_team_source_title" : "same_team_name_season_type",
    team: product.team,
    name: product.name,
    catalogCode: candidate.catalog_code ?? null,
  });
}

const reconciled = {
  ...plan,
  batchKey: `${plan.batchKey}:reconciled`,
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
    adoptedExisting: adopted.length,
    skippedExisting: skipped.length,
  },
};
const report = {
  before: plan.products.length,
  kept: kept.length,
  adoptedExisting: adopted.length,
  skippedExisting: skipped.length,
  adopted,
  skipped,
};

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(options.report)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(reconciled, null, 2)}\n`, "utf8");
fs.writeFileSync(path.resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  `BRASILEIRAO_EXISTING_RECONCILE_OK before=${report.before} kept=${report.kept} adopted=${report.adoptedExisting} skipped=${report.skippedExisting}`,
);
