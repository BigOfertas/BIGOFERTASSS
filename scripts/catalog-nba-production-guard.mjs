import fs from "node:fs";
import path from "node:path";

const NBA_PRICE = 229.9;

function parseArgs(argv) {
  const out = { manifest: "", output: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") out.manifest = argv[++index];
    else if (arg === "--output") out.output = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.manifest || !out.output) throw new Error("Use --manifest e --output.");
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

const options = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(fs.readFileSync(path.resolve(options.manifest), "utf8"));
const teams = (manifest.albums ?? []).map((album) => album.name);
if (teams.length !== 30) throw new Error(`Manifesto NBA inválido: ${teams.length} times.`);

const projectRef = String(process.env.SUPABASE_PROJECT_ID ?? "").trim();
const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
if (!projectRef || !accessToken) {
  throw new Error("SUPABASE_PROJECT_ID e SUPABASE_ACCESS_TOKEN são obrigatórios.");
}

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
          p.catalog_code,
          p.name,
          p.time,
          p.campeonato,
          p.liga,
          p.price,
          c.slug as category_slug,
          s.commercial_type,
          count(i.id) filter (
            where i.status::text = 'ready'
              and coalesce(i.external_url, '') <> ''
          )::int as ready_external_images
        from public.products p
        left join public.categories c on c.id = p.primary_category_id
        left join public.product_purchase_settings s on s.product_id = p.id
        left join public.product_images i on i.product_id = p.id
        where p.status::text = 'active'
          and (upper(coalesce(p.campeonato, '')) = 'NBA' or upper(coalesce(p.liga, '')) = 'NBA')
        group by p.id, p.catalog_code, p.name, p.time, p.campeonato, p.liga, p.price, c.slug, s.commercial_type
        order by p.catalog_code;
      `,
    }),
    signal: AbortSignal.timeout(120_000),
  },
);
const text = await response.text();
if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${text.slice(0, 2000)}`);
const rows = text ? JSON.parse(text) : [];
const targetKeys = new Set(teams.map(normalize));
const counts = new Map();
for (const row of rows) {
  if (!targetKeys.has(normalize(row.time))) continue;
  counts.set(normalize(row.time), (counts.get(normalize(row.time)) ?? 0) + 1);
  if (row.commercial_type !== "basquete") {
    throw new Error(`${row.catalog_code}: tipo comercial NBA incorreto (${row.commercial_type}).`);
  }
  if (Math.abs(Number(row.price) - NBA_PRICE) > 0.001) {
    throw new Error(`${row.catalog_code}: preço NBA incorreto (${row.price}).`);
  }
  if (row.category_slug !== "basquete") {
    throw new Error(`${row.catalog_code}: categoria NBA incorreta (${row.category_slug}).`);
  }
  if (Number(row.ready_external_images) < 1) {
    throw new Error(`${row.catalog_code}: produto NBA sem imagem pronta.`);
  }
}
const missing = teams.filter((team) => !counts.get(normalize(team)));
if (missing.length > 0) {
  throw new Error(`Times NBA sem produto ativo: ${missing.join(", ")}`);
}

const targetRows = rows.filter((row) => targetKeys.has(normalize(row.time)));
const result = {
  expectedTeams: teams.length,
  coveredTeams: teams.length - missing.length,
  activeProducts: targetRows.length,
  readyImages: targetRows.reduce((sum, row) => sum + Number(row.ready_external_images || 0), 0),
  firstCatalogCode: targetRows[0]?.catalog_code ?? null,
  lastCatalogCode: targetRows.at(-1)?.catalog_code ?? null,
  missingTeams: missing,
};
fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(
  `NBA_PRODUCTION_OK teams=${result.coveredTeams} activeProducts=${result.activeProducts} readyImages=${result.readyImages}`,
);
