import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = { plan: "", stock: 999 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") out.plan = argv[++index];
    else if (arg === "--stock") out.stock = Number.parseInt(argv[++index], 10);
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.plan) throw new Error("Use --plan.");
  if (!Number.isInteger(out.stock) || out.stock < 0 || out.stock > 1_000_000) {
    throw new Error("Estoque técnico inválido.");
  }
  return out;
}

function dollarQuote(value) {
  let tag = "catalog_payload";
  while (value.includes(`$${tag}$`)) tag += "_x";
  return `$${tag}$${value}$${tag}$`;
}

function slugify(value) {
  return String(value ?? "catalog")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

const options = parseArgs(process.argv.slice(2));
const projectRef = String(process.env.SUPABASE_PROJECT_ID ?? "").trim();
const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
if (!projectRef || !accessToken) {
  throw new Error("SUPABASE_PROJECT_ID e SUPABASE_ACCESS_TOKEN são obrigatórios.");
}

const plan = JSON.parse(fs.readFileSync(path.resolve(options.plan), "utf8"));
if (!Array.isArray(plan.products) || plan.products.length === 0) throw new Error("Plano vazio.");
const payload = JSON.stringify({
  schemaVersion: plan.schemaVersion ?? 1,
  batchKey: plan.batchKey,
  sourceAlbumUrl: plan.sourceAlbumUrl,
  products: plan.products,
});
const digest = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 12);
const migrationName = `catalog_batch_${slugify(plan.batchKey)}_${digest}`;
const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

async function request(endpoint, init = {}) {
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(180_000),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`${endpoint} HTTP ${response.status}: ${text.slice(0, 2500)}`);
  return text ? JSON.parse(text) : null;
}

const history = await request("/database/migrations");
const alreadyApplied = Array.isArray(history) && history.some((item) => item?.name === migrationName);
if (!alreadyApplied) {
  const query = `
    select public.catalog_apply_normalized_batch(
      ${dollarQuote(payload)}::jsonb,
      false,
      true,
      ${options.stock}
    );
  `;
  await request("/database/migrations", {
    method: "POST",
    body: JSON.stringify({ name: migrationName, query }),
  });
  console.log(`CATALOG_BATCH_APPLIED migration=${migrationName}`);
} else {
  console.log(`CATALOG_BATCH_ALREADY_APPLIED migration=${migrationName}`);
}
