import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = { mode: "", plan: "", snapshot: "", out: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "snapshot" || arg === "verify") out.mode = arg;
    else if (arg === "--plan") out.plan = argv[++index];
    else if (arg === "--snapshot") out.snapshot = argv[++index];
    else if (arg === "--out") out.out = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.mode || !out.plan) throw new Error("Use snapshot|verify e --plan.");
  if (out.mode === "verify" && !out.snapshot) throw new Error("verify exige --snapshot.");
  return out;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const options = parseArgs(process.argv.slice(2));
const projectRef = String(process.env.SUPABASE_PROJECT_ID ?? "").trim();
const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
if (!projectRef || !accessToken) throw new Error("Configuração Supabase ausente.");
const plan = JSON.parse(fs.readFileSync(path.resolve(options.plan), "utf8"));
const sourceKeys = (plan.products ?? []).map((product) => product.sourceKey);
if (sourceKeys.length === 0) throw new Error("Plano vazio.");
const sourceArray = `ARRAY[${sourceKeys.map(sqlLiteral).join(",")}]::text[]`;
const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;

async function query(sql) {
  const response = await fetch(`${apiBase}/database/query/read-only`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${text.slice(0, 2500)}`);
  return text ? JSON.parse(text) : [];
}

async function state() {
  const totals = await query(`
    select
      count(*)::int as total_products,
      count(*) filter (where status::text = 'active')::int as active_products,
      coalesce(max(substring(catalog_code from 2)::integer) filter (where catalog_code ~ '^P[0-9]{6}$'), 0)::int as max_catalog_number,
      count(*) filter (where launch_position between 1 and 10)::int as launch_count,
      count(*) filter (where launch_position between 1 and 10 and status::text = 'active')::int as active_launch_count
    from public.products;
  `);
  const selected = await query(`
    select p.id::text, p.catalog_code, p.name, p.status::text, c.slug as category_slug
    from public.products p
    left join public.categories c on c.id = p.primary_category_id
    where p.catalog_source_key = any(${sourceArray})
    order by p.catalog_code nulls last, p.name;
  `);
  return { ...totals[0], selected };
}

if (options.mode === "snapshot") {
  const before = await state();
  writeJson(options.out || ".artifacts/retro/before.json", before);
  console.log("RETRO_PRODUCTION_SNAPSHOT");
  console.log(JSON.stringify(before));
  process.exit(0);
}

const before = JSON.parse(fs.readFileSync(path.resolve(options.snapshot), "utf8"));
const after = await state();
const plannedProducts = plan.products.length;
const plannedVariants = plan.products.reduce(
  (sum, product) => sum + (product.variants?.length ?? 0),
  0,
);
const plannedImages = plan.products.reduce(
  (sum, product) =>
    sum +
    (product.variants ?? []).reduce(
      (inner, variant) => inner + (variant.images?.length ?? 0),
      0,
    ),
  0,
);
const detail = (
  await query(`
  with selected_products as (
    select p.* from public.products p where p.catalog_source_key = any(${sourceArray})
  )
  select
    (select count(*)::int from selected_products) as products,
    (select count(*)::int from selected_products where status::text = 'active') as active_products,
    (select count(*)::int from selected_products p join public.categories c on c.id = p.primary_category_id where c.slug = 'retro') as retro_category_products,
    (select count(*)::int from selected_products where abs(price - 219.90) < 0.001) as correct_product_prices,
    (select count(*)::int from selected_products where nullif(btrim(time), '') is not null and season ~ '^((19|20)[0-9]{2}|[0-9]{2}/[0-9]{2})$' and time !~ '(^| )((19|20)[0-9]{2}|[0-9]{2}/[0-9]{2})$') as valid_identity_products,
    (select count(*)::int from public.product_purchase_settings s join selected_products p on p.id = s.product_id where s.commercial_type = 'retro') as retro_purchase_settings,
    (select count(*)::int from public.product_purchase_settings s join selected_products p on p.id = s.product_id where jsonb_array_length(coalesce(s.patches, '[]'::jsonb)) = 0) as zero_patch_products,
    (select count(*)::int from public.product_variants v join selected_products p on p.id = v.product_id where v.status::text = 'active') as active_variants,
    (select count(*)::int from public.product_variants v join selected_products p on p.id = v.product_id where abs(coalesce(v.price_override, p.price) - 219.90) < 0.001) as correct_variant_prices,
    (select count(*)::int from public.product_images i join selected_products p on p.id = i.product_id where i.status::text = 'ready' and i.image_source = 'google_photos' and i.external_url is not null) as ready_google_images
  ;
`)
)[0];

const expectedTotal =
  Number(before.total_products) + plannedProducts - (before.selected?.length ?? 0);
if (Number(after.total_products) !== expectedTotal) {
  throw new Error(`Total de produtos inesperado: ${after.total_products} != ${expectedTotal}`);
}
if (
  Number(after.launch_count) !== Number(before.launch_count) ||
  Number(after.active_launch_count) !== 10
) {
  throw new Error("Os 10 lançamentos existentes foram alterados.");
}
const expectations = {
  products: plannedProducts,
  active_products: plannedProducts,
  retro_category_products: plannedProducts,
  correct_product_prices: plannedProducts,
  valid_identity_products: plannedProducts,
  retro_purchase_settings: plannedProducts,
  zero_patch_products: plannedProducts,
  active_variants: plannedVariants,
  correct_variant_prices: plannedVariants,
  ready_google_images: plannedImages,
};
for (const [key, value] of Object.entries(expectations)) {
  if (Number(detail[key]) !== Number(value)) {
    throw new Error(`Verificação retrô falhou em ${key}: ${detail[key]} != ${value}`);
  }
}

const codes = after.selected
  .map((row) => row.catalog_code)
  .filter((code) => /^P\d{6}$/.test(String(code)))
  .map((code) => Number(code.slice(1)))
  .sort((a, b) => a - b);
if (new Set(codes).size !== plannedProducts)
  throw new Error("Códigos P do lote não são únicos/completos.");
for (let index = 1; index < codes.length; index += 1) {
  if (codes[index] !== codes[index - 1] + 1)
    throw new Error("Códigos P do lote retrô não são consecutivos.");
}
if (
  (before.selected?.length ?? 0) === 0 &&
  codes[0] !== Number(before.max_catalog_number) + 1
) {
  throw new Error(`Lote retrô não começou no próximo P esperado: ${codes[0]}.`);
}

const result = {
  planned: {
    products: plannedProducts,
    variants: plannedVariants,
    images: plannedImages,
  },
  firstCatalogCode: `P${String(codes[0]).padStart(6, "0")}`,
  lastCatalogCode: `P${String(codes.at(-1)).padStart(6, "0")}`,
  before,
  after,
  detail,
};
writeJson(options.out || ".artifacts/retro/production-verification.json", result);
console.log("RETRO_PRODUCTION_VERIFICATION");
console.log(JSON.stringify(result, null, 2));
console.log(
  `RETRO_PRODUCTION_OK products=${plannedProducts} variants=${plannedVariants} images=${plannedImages} codes=${result.firstCatalogCode}-${result.lastCatalogCode}`,
);
