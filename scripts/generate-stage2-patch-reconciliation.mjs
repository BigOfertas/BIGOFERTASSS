import fs from "node:fs";

import { inferPurchasePatches, normalizeCatalogText } from "./catalog-business-rules.mjs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const outputFile =
  process.env.STAGE2_PATCH_MIGRATION_FILE?.trim() ||
  "supabase/migrations/20260911061000_stage2_patch_reconciliation.sql";

if (!projectRef || !accessToken) {
  console.error("Stage 2 patch reconciliation generation requires Supabase CI credentials.");
  process.exit(2);
}

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
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`READ_ONLY_QUERY_HTTP_${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

function patchCodes(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => (typeof item?.code === "string" ? [item.code] : [])))].sort();
}

function sameCodes(left, right) {
  return left.length === right.length && left.every((code, index) => code === right[index]);
}

function isFrozenWindbreaker(row) {
  const source = normalizeCatalogText(
    [row.name, row.category, row.campeonato, row.liga, row.time].filter(Boolean).join(" "),
  );
  return /\b(CORTA[- ]?VENTO|WINDBREAKER)\b/.test(source);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const rows = await readOnly(`
  select
    p.id,
    p.catalog_code,
    p.name,
    p.category,
    p.campeonato,
    p.liga,
    p.time,
    p.season,
    p.audience,
    (pps.product_id is not null) as settings_present,
    coalesce(pps.commercial_type, 'other') as commercial_type,
    coalesce(pps.patches, '[]'::jsonb) as patches
  from public.products p
  left join public.product_purchase_settings pps on pps.product_id = p.id
  where p.status <> 'archived'::public.product_status
  order by p.catalog_code nulls last, p.id;
`);

const desired = [];
let frozen = 0;

for (const row of rows) {
  if (isFrozenWindbreaker(row)) {
    frozen += 1;
    continue;
  }

  const expected =
    row.commercial_type === "calcao"
      ? []
      : inferPurchasePatches({
          name: row.name,
          category: row.category,
          campeonato: row.campeonato,
          liga: row.liga,
          time: row.time,
          season: row.season,
          audience: row.audience,
        });
  const currentCodes = patchCodes(row.patches);
  const expectedCodes = patchCodes(expected);

  if (sameCodes(currentCodes, expectedCodes)) continue;
  if (!row.settings_present) {
    throw new Error(
      `Missing product_purchase_settings for ${row.catalog_code ?? row.id}; refusing implicit settings creation.`,
    );
  }

  desired.push({
    productId: row.id,
    catalogCode: row.catalog_code,
    expected,
  });
}

if (desired.length === 0) {
  console.log(
    `STAGE2_PATCH_RECONCILIATION_GENERATION products=${rows.length} frozen=${frozen} updates=0`,
  );
  process.exit(0);
}

const values = desired
  .map(
    (item) =>
      `  (${sqlLiteral(item.productId)}::uuid, ${sqlLiteral(JSON.stringify(item.expected))}::jsonb)`,
  )
  .join(",\n");

const sql = `BEGIN;

-- Fase 2 — reconciliação determinística dos patches já cadastrados.
-- Gerado a partir das regras canônicas de scripts/catalog-business-rules.mjs
-- e do estado de produção no momento da geração. Não altera produtos, imagens,
-- códigos, preços, estoque, pedidos, perfis, afiliados ou Corta-Vento congelado.
CREATE TEMP TABLE stage2_patch_reconciliation (
  product_id uuid PRIMARY KEY,
  patches jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO stage2_patch_reconciliation (product_id, patches)
VALUES
${values};

CREATE TEMP TABLE stage2_protected_counts (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL
) ON COMMIT DROP;

INSERT INTO stage2_protected_counts (table_name, row_count)
VALUES
  ('orders', (SELECT count(*) FROM public.orders)),
  ('order_items', (SELECT count(*) FROM public.order_items)),
  ('profiles', (SELECT count(*) FROM public.profiles)),
  ('affiliates', (SELECT count(*) FROM public.affiliates));

DO $$
DECLARE
  planned_count integer := ${desired.length};
  matched_count integer;
  changed_count integer;
BEGIN
  SELECT count(*) INTO matched_count
  FROM stage2_patch_reconciliation desired
  JOIN public.product_purchase_settings settings ON settings.product_id = desired.product_id;

  IF matched_count <> planned_count THEN
    RAISE EXCEPTION 'Stage 2 patch reconciliation aborted: expected % settings rows, found %', planned_count, matched_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM stage2_patch_reconciliation desired
    JOIN public.product_purchase_settings settings ON settings.product_id = desired.product_id
    WHERE settings.commercial_type = 'calcao' AND desired.patches <> '[]'::jsonb
  ) THEN
    RAISE EXCEPTION 'Stage 2 patch reconciliation aborted: Shorts cannot receive patches';
  END IF;

  UPDATE public.product_purchase_settings settings
  SET patches = desired.patches,
      updated_at = now()
  FROM stage2_patch_reconciliation desired
  WHERE settings.product_id = desired.product_id
    AND settings.patches IS DISTINCT FROM desired.patches;

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> planned_count THEN
    RAISE EXCEPTION 'Stage 2 patch reconciliation aborted: expected % updates, changed %', planned_count, changed_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM stage2_patch_reconciliation desired
    JOIN public.product_purchase_settings settings ON settings.product_id = desired.product_id
    WHERE settings.patches IS DISTINCT FROM desired.patches
  ) THEN
    RAISE EXCEPTION 'Stage 2 patch reconciliation verification failed';
  END IF;

  IF (SELECT count(*) FROM public.orders) <> (SELECT row_count FROM stage2_protected_counts WHERE table_name = 'orders')
     OR (SELECT count(*) FROM public.order_items) <> (SELECT row_count FROM stage2_protected_counts WHERE table_name = 'order_items')
     OR (SELECT count(*) FROM public.profiles) <> (SELECT row_count FROM stage2_protected_counts WHERE table_name = 'profiles')
     OR (SELECT count(*) FROM public.affiliates) <> (SELECT row_count FROM stage2_protected_counts WHERE table_name = 'affiliates') THEN
    RAISE EXCEPTION 'Stage 2 patch reconciliation touched protected business tables';
  END IF;
END;
$$;

COMMIT;
`;

fs.writeFileSync(outputFile, sql, "utf8");
console.log(
  `STAGE2_PATCH_RECONCILIATION_GENERATION products=${rows.length} frozen=${frozen} updates=${desired.length} file=${outputFile}`,
);
console.log(
  `STAGE2_PATCH_RECONCILIATION_CODES first=${desired[0]?.catalogCode ?? "-"} last=${desired.at(-1)?.catalogCode ?? "-"}`,
);
