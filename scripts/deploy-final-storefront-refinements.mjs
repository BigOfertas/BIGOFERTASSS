import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Final storefront refinement deployment is missing Supabase CI configuration.");
  process.exit(2);
}

const migrationName = "final_storefront_refinements_20260911";
const migrationFile = "supabase/migrations/20260911114500_final_storefront_refinements.sql";
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
const alreadyApplied = Array.isArray(history) && history.some((item) => item?.name === migrationName);

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

const targetCodes = [
  "P000801","P000810","P000847","P000898","P000906","P000925","P000940","P000973",
  "P001078","P001148","P001187","P001249","P001274","P001373","P001462","P002087",
  "P002129","P002218","P002280","P002374","P002392","P002417","P002443","P002493",
];
const sqlCodes = targetCodes.map((code) => `'${code}'`).join(",");

const verificationPayload = await jsonRequest(`${apiBase}/database/query/read-only`, {
  method: "POST",
  timeout: 30_000,
  body: JSON.stringify({
    query: `
      with target as (
        select p.id, p.catalog_code
        from public.products p
        where p.catalog_code in (${sqlCodes})
      ), checks as (
        select
          t.catalog_code,
          (select count(*) from public.product_options o where o.product_id=t.id and lower(o.name)='modelo' and o.is_required) as model_options,
          (select count(*) from public.product_option_values ov join public.product_options o on o.id=ov.option_id where o.product_id=t.id and lower(o.name)='modelo' and ov.is_active) as model_values,
          (select count(*) from public.product_variants v where v.product_id=t.id and v.status='active') as active_variants,
          (select count(*) from public.product_images i where i.product_id=t.id and i.status='ready') as ready_images,
          (select count(distinct i.variant_id) from public.product_images i where i.product_id=t.id and i.status='ready' and i.variant_id is not null) as image_variants
        from target t
      )
      select
        (select count(*) from target) = ${targetCodes.length} as all_targets_present,
        coalesce((select bool_and(model_options=1 and model_values=2 and active_variants=2 and ready_images=2 and image_variants=2) from checks), false) as model_selectors_ready,
        exists (
          select 1
          from public.products p
          join public.product_options o on o.product_id=p.id
          where p.catalog_code='P002218' and lower(o.name)='modelo'
        ) as manchester_city_model_selector,
        public.storefront_product_priority('Real Madrid','La Liga',null,'Camisas','feminino','Real Madrid — Camisa I 26/27 ADIDAS')
          < public.storefront_product_priority('Manchester United','Premier League',null,'Camisas','feminino','Manchester United — Camisa I 26/27 ADIDAS') as feminine_real_before_united,
        public.storefront_product_priority('Manchester United','Premier League',null,'Camisas','feminino','Manchester United — Camisa I 26/27 ADIDAS')
          < public.storefront_product_priority('Paris Saint-Germain','Ligue 1',null,'Camisas','feminino','Paris Saint-Germain — Camisa I 26/27 NIKE') as feminine_united_before_psg;
    `,
  }),
});

const verification = Array.isArray(verificationPayload) ? verificationPayload[0] : verificationPayload;
console.log("FINAL_STOREFRONT_REFINEMENTS_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));

const required = [
  "all_targets_present",
  "model_selectors_ready",
  "manchester_city_model_selector",
  "feminine_real_before_united",
  "feminine_united_before_psg",
];

if (!required.every((key) => verification?.[key] === true)) {
  console.error("Final storefront refinement verification failed.");
  process.exit(11);
}

console.log("Final storefront refinements are live.");
