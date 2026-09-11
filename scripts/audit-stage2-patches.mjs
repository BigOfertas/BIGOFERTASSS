import { inferPurchasePatches, normalizeCatalogText } from "./catalog-business-rules.mjs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Stage 2 patch audit requires Supabase CI credentials.");
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
  return [
    ...new Set(value.flatMap((item) => (typeof item?.code === "string" ? [item.code] : []))),
  ].sort();
}

function sameCodes(left, right) {
  return left.length === right.length && left.every((code, index) => code === right[index]);
}

function frozenWindbreaker(row) {
  const source = normalizeCatalogText(
    [row.name, row.category, row.campeonato, row.liga, row.time].filter(Boolean).join(" "),
  );
  return /\b(CORTA VENTO|WINDBREAKER)\b/.test(source);
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
    coalesce(pps.commercial_type, 'other') as commercial_type,
    coalesce(pps.patches, '[]'::jsonb) as patches
  from public.products p
  left join public.product_purchase_settings pps on pps.product_id = p.id
  where p.status <> 'archived'::public.product_status
  order by p.catalog_code nulls last, p.id;
`);

let audited = 0;
let frozen = 0;
let shorts = 0;
const mismatches = [];

for (const row of rows) {
  if (frozenWindbreaker(row)) {
    frozen += 1;
    continue;
  }

  const current = patchCodes(row.patches);
  const expected =
    row.commercial_type === "calcao"
      ? []
      : patchCodes(
          inferPurchasePatches({
            name: row.name,
            category: row.category,
            campeonato: row.campeonato,
            liga: row.liga,
            time: row.time,
            season: row.season,
            audience: row.audience,
          }),
        );

  if (row.commercial_type === "calcao") shorts += 1;
  audited += 1;

  if (!sameCodes(current, expected)) {
    mismatches.push({
      catalogCode: row.catalog_code,
      name: row.name,
      commercialType: row.commercial_type,
      current,
      expected,
    });
  }
}

console.log(
  `STAGE2_PATCH_AUDIT total=${rows.length} audited=${audited} frozen_windbreakers=${frozen} shorts=${shorts} mismatches=${mismatches.length}`,
);

for (const item of mismatches.slice(0, 30)) {
  console.log(
    `PATCH_MISMATCH ${item.catalogCode ?? "NO_CODE"} | ${item.commercialType} | ${item.name} | current=${item.current.join(",") || "-"} | expected=${item.expected.join(",") || "-"}`,
  );
}

if (mismatches.length > 0) process.exit(3);
