import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const mode = process.argv[2];
const snapshotPath = process.argv[3] || ".artifacts/top10-reset-before.json";

if (!projectRef || !accessToken) throw new Error("SUPABASE_PROJECT_ID/SUPABASE_ACCESS_TOKEN ausentes.");
if (!['snapshot', 'validate', 'activate', 'verify-active'].includes(mode)) throw new Error(`Modo inválido: ${mode}`);

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

async function readOnly(query) {
  const response = await fetch(`${apiBase}/database/query/read-only`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`READ_ONLY_${response.status}: ${text.slice(0, 1500)}`);
  const payload = JSON.parse(text);
  return Array.isArray(payload) ? payload[0] : payload;
}

async function applyMigration(name, query) {
  const response = await fetch(`${apiBase}/database/migrations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, query }),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`MIGRATION_${response.status}: ${text.slice(0, 2000)}`);
  return text;
}

const invariantSql = `
select
  (select count(*)::int from public.orders) as orders,
  (select count(*)::int from public.order_items) as order_items,
  (select count(*)::int from public.profiles) as profiles,
  (select count(*)::int from public.affiliates) as affiliates,
  (select count(*)::int from public.affiliate_referrals) as affiliate_referrals,
  (select count(*)::int from public.affiliate_commissions) as affiliate_commissions;
`;

const expectedCodes = Array.from({ length: 10 }, (_, i) => `P${String(i + 1).padStart(6, "0")}`);
const expectedNames = [
  "Chelsea — Camisa I 26/27 Nike",
  "Chelsea — Camisa II 26/27 Nike",
  "Manchester City — Camisa II 26/27 Puma",
  "Bayern — Camisa I 26/27 Adidas",
  "Bayern — Camisa II 26/27 Adidas",
  "Barcelona — Camisa II 26/27 Nike",
  "PSG — Camisa I 26/27 Nike",
  "Lyon — Camisa II 26/27 Adidas",
  "Milan — Camisa II 26/27 Puma",
  "Napoli — Camisa I 26/26 EA7",
];

async function catalogState() {
  return readOnly(`
    with target as (
      select id, catalog_code, name, catalog_source_title, status, price
      from public.products
      where catalog_code between 'P000001' and 'P000010'
    ), image_counts as (
      select t.id, count(pi.id)::int as image_count
      from target t
      left join public.product_images pi
        on pi.product_id = t.id
       and pi.status = 'ready'::public.product_image_status
       and pi.image_source = 'google_photos'
       and pi.external_url is not null
      group by t.id
    )
    select
      (select count(*)::int from public.products) as all_products,
      (select count(*)::int from target) as products,
      (select array_agg(catalog_code order by catalog_code) from target) as codes,
      (select array_agg(name order by catalog_code) from target) as names,
      (select count(*)::int from target where status = 'draft'::public.product_status) as drafts,
      (select count(*)::int from target where status = 'active'::public.product_status) as active,
      (select count(*)::int from target where price > 0) as positive_prices,
      (select count(*)::int from target t where exists (
        select 1 from public.product_variants v
        where v.product_id = t.id and v.status = 'active'::public.product_variant_status
      )) as products_with_active_variant,
      (select count(*)::int from public.product_images pi join target t on t.id = pi.product_id
        where pi.status = 'ready'::public.product_image_status
          and pi.image_source = 'google_photos'
          and pi.external_url is not null) as google_images,
      (select min(image_count)::int from image_counts) as min_images_per_product,
      (select max(image_count)::int from image_counts) as max_images_per_product,
      (select count(*)::int from target where catalog_code = 'P000010'
        and name like '%26/26%'
        and catalog_source_title like '%26/26%') as napoli_2626_preserved;
  `);
}

function sameArray(actual, expected, label) {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((v, i) => v !== expected[i])) {
    throw new Error(`${label} divergente: ${JSON.stringify(actual)}`);
  }
}

function validateInvariants(before, after) {
  for (const key of Object.keys(before)) {
    if (Number(after[key]) !== Number(before[key])) {
      throw new Error(`Reset alterou ${key}: antes=${before[key]} depois=${after[key]}`);
    }
  }
}

function validateDraftState(state) {
  if (state.all_products !== 10 || state.products !== 10) throw new Error(`Esperados 10 produtos após reset: ${JSON.stringify(state)}`);
  sameArray(state.codes, expectedCodes, "Códigos P");
  sameArray(state.names, expectedNames, "Nomes Top 10");
  if (state.drafts !== 10 || state.active !== 0) throw new Error(`Estado draft inválido: ${JSON.stringify(state)}`);
  if (state.positive_prices !== 10) throw new Error("Há produto sem preço positivo.");
  if (state.products_with_active_variant !== 10) throw new Error("Há produto sem variante ativa.");
  if (state.google_images !== 50 || state.min_images_per_product !== 5 || state.max_images_per_product !== 5) {
    throw new Error(`Imagens Top 10 inválidas: ${JSON.stringify(state)}`);
  }
  if (state.napoli_2626_preserved !== 1) throw new Error("Napoli 26/26 não foi preservado.");
}

function validateActiveState(state) {
  if (state.all_products !== 10 || state.products !== 10) throw new Error("Catálogo ativo não contém exatamente 10 produtos.");
  sameArray(state.codes, expectedCodes, "Códigos P ativos");
  sameArray(state.names, expectedNames, "Nomes Top 10 ativos");
  if (state.drafts !== 0 || state.active !== 10) throw new Error(`Ativação incompleta: ${JSON.stringify(state)}`);
  if (state.google_images !== 50 || state.min_images_per_product !== 5 || state.max_images_per_product !== 5) {
    throw new Error("Imagens mudaram durante ativação.");
  }
  if (state.napoli_2626_preserved !== 1) throw new Error("Napoli 26/26 mudou durante ativação.");
}

if (mode === "snapshot") {
  const snapshot = await readOnly(invariantSql);
  fs.mkdirSync(new URL(".", `file://${process.cwd()}/${snapshotPath}`).pathname, { recursive: true });
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log("TOP10_RESET_INVARIANTS_SNAPSHOTTED");
  console.log(JSON.stringify(snapshot));
} else {
  const before = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const afterInvariants = await readOnly(invariantSql);
  validateInvariants(before, afterInvariants);
  const state = await catalogState();

  if (mode === "validate") {
    validateDraftState(state);
    console.log("TOP10_DRAFT_VALIDATION_OK");
    console.log(JSON.stringify({ invariants: afterInvariants, catalog: state }, null, 2));
  } else if (mode === "activate") {
    if (state.active === 10 && state.drafts === 0) {
      validateActiveState(state);
      console.log("TOP10_ALREADY_ACTIVE_OK");
      process.exit(0);
    }
    validateDraftState(state);
    await applyMigration(
      "activate_google_photos_top10_20260909_v1",
      `
      do $$
      begin
        if (select count(*) from public.products) <> 10 then
          raise exception 'Activation guard: catalog product count differs from 10';
        end if;
        if (select count(*) from public.products where catalog_code between 'P000001' and 'P000010' and status = 'draft'::public.product_status) <> 10 then
          raise exception 'Activation guard: expected 10 draft P products';
        end if;
        if (select count(*) from public.product_images pi join public.products p on p.id = pi.product_id
            where p.catalog_code between 'P000001' and 'P000010'
              and pi.status = 'ready'::public.product_image_status
              and pi.image_source = 'google_photos'
              and pi.external_url is not null) <> 50 then
          raise exception 'Activation guard: expected 50 Google images';
        end if;
        update public.products
        set status = 'active'::public.product_status, updated_at = now()
        where catalog_code between 'P000001' and 'P000010';
      end $$;
      `,
    );
    const activeState = await catalogState();
    const finalInvariants = await readOnly(invariantSql);
    validateInvariants(before, finalInvariants);
    validateActiveState(activeState);
    console.log("TOP10_ACTIVATION_OK");
    console.log(JSON.stringify({ invariants: finalInvariants, catalog: activeState }, null, 2));
  } else if (mode === "verify-active") {
    validateActiveState(state);
    console.log("TOP10_ACTIVE_VERIFICATION_OK");
    console.log(JSON.stringify({ invariants: afterInvariants, catalog: state }, null, 2));
  }
}
