import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Dynamic size guidance deployment is missing Supabase CI configuration.");
  process.exit(2);
}

const migrationName = "dynamic_size_guidance_variant_type_20260914";
const migrationFile = "supabase/migrations/20260914034500_dynamic_size_guidance_variant_type.sql";
const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

function migrationSql() {
  return fs
    .readFileSync(migrationFile, "utf8")
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "")
    .trim();
}

async function jsonRequest(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(init.timeout ?? 120_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP_${response.status}: ${text.slice(0, 3000)}`);
  }
  return text ? JSON.parse(text) : null;
}

const history = await jsonRequest(`${apiBase}/database/migrations`, { timeout: 20_000 });
const alreadyApplied =
  Array.isArray(history) && history.some((item) => item?.name === migrationName);

if (!alreadyApplied) {
  console.log(`Applying ${migrationName}...`);
  await jsonRequest(`${apiBase}/database/migrations`, {
    method: "POST",
    body: JSON.stringify({ name: migrationName, query: migrationSql() }),
  });
  console.log(`Applied ${migrationName}.`);
} else {
  console.log(`Already applied: ${migrationName}.`);
}

const verificationPayload = await jsonRequest(`${apiBase}/database/query/read-only`, {
  method: "POST",
  timeout: 30_000,
  body: JSON.stringify({
    query: `
      select
        exists (
          select 1
          from pg_catalog.pg_proc proc
          join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
          where ns.nspname='public'
            and proc.proname='storefront_product_detail_v2'
            and pg_catalog.pg_get_functiondef(proc.oid) like '%commercial_type%'
        ) as detail_exposes_variant_commercial_type,
        pg_catalog.has_function_privilege(
          'anon',
          'public.storefront_product_detail_v2(text)',
          'EXECUTE'
        ) as anon_can_read_detail,
        pg_catalog.has_function_privilege(
          'authenticated',
          'public.storefront_product_detail_v2(text)',
          'EXECUTE'
        ) as authenticated_can_read_detail,
        exists (
          select 1
          from information_schema.columns
          where table_schema='public'
            and table_name='product_variants'
            and column_name='commercial_type'
        ) as variant_commercial_type_column,
        not exists (
          select 1
          from public.product_variants v
          join public.products p on p.id=v.product_id
          where p.status='active'::public.product_status
            and v.status='active'::public.product_variant_status
            and v.commercial_type is not null
            and not exists (
              select 1
              from jsonb_array_elements(
                coalesce(public.storefront_product_detail_v2(p.slug)->'variants', '[]'::jsonb)
              ) item
              where item->>'id'=v.id::text
                and item->>'commercial_type'=v.commercial_type
            )
        ) as classified_variants_match_public_detail;
    `,
  }),
});

const verification = Array.isArray(verificationPayload)
  ? verificationPayload[0]
  : verificationPayload;
console.log("DYNAMIC_SIZE_GUIDANCE_BACKEND_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

const required = [
  "detail_exposes_variant_commercial_type",
  "anon_can_read_detail",
  "authenticated_can_read_detail",
  "variant_commercial_type_column",
  "classified_variants_match_public_detail",
];

if (!required.every((key) => verification?.[key] === true)) {
  console.error("Dynamic size guidance backend verification failed.");
  process.exit(11);
}

console.log("Dynamic size guidance backend is live.");
