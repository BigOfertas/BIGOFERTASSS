import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const migrationName = "stage5_public_product_descriptions_20260914";
const migrationFile = "supabase/migrations/20260914162500_stage5_public_product_descriptions.sql";

if (!projectRef || !accessToken) {
  console.error("Stage 5 product description deployment is missing required CI configuration.");
  process.exit(2);
}

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

function migrationSql(file) {
  return fs
    .readFileSync(file, "utf8")
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "")
    .trim();
}

async function readHistory() {
  const response = await fetch(`${apiBase}/database/migrations`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`MIGRATION_HISTORY_HTTP_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

async function readOnly(query) {
  const response = await fetch(`${apiBase}/database/query/read-only`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`READ_ONLY_QUERY_HTTP_${response.status}: ${text.slice(0, 1200)}`);
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

async function applyMigration() {
  const response = await fetch(`${apiBase}/database/migrations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: migrationName, query: migrationSql(migrationFile) }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Migration ${migrationName} failed with HTTP ${response.status}.`);
    if (text) console.error(text.slice(0, 3000));
    process.exit(10);
  }
  console.log(`Applied ${migrationName}.`);
}

const auditQuery = `
with variant_counts as (
  select
    product_id,
    count(*) filter (where status::text = 'active')::integer as active_variant_count
  from public.product_variants
  group by product_id
)
select
  count(*)::integer as total_products,
  count(*) filter (where p.description is not null)::integer as products_with_description,
  count(*) filter (
    where p.description ~* 'bigofertas(?![.]net)'
  )::integer as descriptions_with_legacy_brand,
  count(*) filter (
    where p.description ~* 'Vers(ões|oes)[[:space:]]+dispon[ií]veis[[:space:]]*:'
       or p.description ~* 'Vers(ã|a)o[[:space:]]*:'
       or p.description ~* '(^|[.!?][[:space:]]+)Vers(ã|a)o[[:space:]]+[^.!?]{1,80}[.!?]'
  )::integer as descriptions_with_version_metadata,
  count(*) filter (
    where coalesce(vc.active_variant_count, 0) > 1
      and (
        p.description ~* 'Vers(ã|a)o[[:space:]]*:'
        or p.description ~* '(^|[.!?][[:space:]]+)Vers(ã|a)o[[:space:]]+[^.!?]{1,80}[.!?]'
      )
  )::integer as multi_variant_products_with_singular_version,
  count(*) filter (where coalesce(vc.active_variant_count, 0) = 1)::integer as products_with_one_active_variant,
  count(*) filter (where coalesce(vc.active_variant_count, 0) = 2)::integer as products_with_two_active_variants,
  count(*) filter (where coalesce(vc.active_variant_count, 0) >= 3)::integer as products_with_three_or_more_active_variants,
  count(*) filter (
    where p.description ~* 'bigofertas(?![.]net)'
       or p.description ~* 'Vers(ões|oes)[[:space:]]+dispon[ií]veis[[:space:]]*:'
       or p.description ~* 'Vers(ã|a)o[[:space:]]*:'
       or p.description ~* '(^|[.!?][[:space:]]+)Vers(ã|a)o[[:space:]]+[^.!?]{1,80}[.!?]'
  )::integer as affected_descriptions
from public.products p
left join variant_counts vc on vc.product_id = p.id;
`;

const examplesQuery = `
with variant_counts as (
  select
    product_id,
    count(*) filter (where status::text = 'active')::integer as active_variant_count,
    jsonb_agg(name order by sort_order, id) filter (where status::text = 'active') as variant_names
  from public.product_variants
  group by product_id
)
select
  p.id,
  p.name,
  p.slug,
  p.description,
  coalesce(vc.active_variant_count, 0) as active_variant_count,
  coalesce(vc.variant_names, '[]'::jsonb) as variant_names
from public.products p
left join variant_counts vc on vc.product_id = p.id
where p.description ~* 'bigofertas(?![.]net)'
   or p.description ~* 'Vers(ões|oes)[[:space:]]+dispon[ií]veis[[:space:]]*:'
   or p.description ~* 'Vers(ã|a)o[[:space:]]*:'
   or p.description ~* '(^|[.!?][[:space:]]+)Vers(ã|a)o[[:space:]]+[^.!?]{1,80}[.!?]'
order by coalesce(vc.active_variant_count, 0) desc, p.updated_at desc
limit 20;
`;

const beforeAudit = (await readOnly(auditQuery))[0] ?? null;
const beforeExamples = await readOnly(examplesQuery);
console.log(`STAGE5_PRODUCT_DESCRIPTION_PRE_AUDIT=${JSON.stringify(beforeAudit)}`);
console.log(`STAGE5_PRODUCT_DESCRIPTION_PRE_EXAMPLES=${JSON.stringify(beforeExamples)}`);

const history = await readHistory();
const alreadyApplied = history.some((item) => item?.name === migrationName);
if (alreadyApplied) console.log(`Already applied: ${migrationName}.`);
else await applyMigration();

const afterAudit = (await readOnly(auditQuery))[0] ?? null;
console.log(`STAGE5_PRODUCT_DESCRIPTION_POST_AUDIT=${JSON.stringify(afterAudit)}`);

let afterExamples = [];
if (beforeExamples.length > 0) {
  const ids = beforeExamples
    .map((item) => String(item.id ?? "").replace(/[^0-9a-f-]/gi, ""))
    .filter(Boolean)
    .map((id) => `'${id}'::uuid`)
    .join(",");

  if (ids) {
    afterExamples = await readOnly(`
      select id, name, slug, description
      from public.products
      where id in (${ids})
      order by updated_at desc;
    `);
  }
}
console.log(`STAGE5_PRODUCT_DESCRIPTION_POST_EXAMPLES=${JSON.stringify(afterExamples)}`);

const triggerVerification = (
  await readOnly(`
    select exists (
      select 1
      from pg_catalog.pg_trigger t
      join pg_catalog.pg_class c on c.oid = t.tgrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'products'
        and t.tgname = 'clean_product_description_before_write'
        and not t.tgisinternal
    ) as cleanup_trigger_live;
  `)
)[0];

if (
  !afterAudit ||
  Number(afterAudit.descriptions_with_legacy_brand) !== 0 ||
  Number(afterAudit.descriptions_with_version_metadata) !== 0 ||
  triggerVerification?.cleanup_trigger_live !== true
) {
  console.error("Stage 5 product description verification failed.");
  process.exit(11);
}

console.log("STAGE5_PRODUCT_DESCRIPTION_DATABASE_OK");
