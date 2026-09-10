import fs from "node:fs";
import path from "node:path";

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
if (teams.length !== 30) {
  throw new Error(`Manifesto do Campeonato Brasileiro inválido: ${teams.length} times.`);
}

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
          s.commercial_type,
          count(i.id) filter (where i.status::text = 'ready')::int as ready_images
        from public.products p
        left join public.product_purchase_settings s on s.product_id = p.id
        left join public.product_images i on i.product_id = p.id
        where p.status::text = 'active'
          and (
            public.catalog_filter_key(coalesce(p.campeonato, '')) = 'brasileirao'
            or public.catalog_filter_key(coalesce(p.liga, '')) = 'brasileirao'
          )
        group by
          p.id, p.catalog_code, p.name, p.time, p.campeonato, p.liga, p.price, s.commercial_type
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
const targetRows = rows.filter((row) => targetKeys.has(normalize(row.time)));
const coverage = new Map();
for (const row of targetRows) {
  const key = normalize(row.time);
  const entry = coverage.get(key) ?? { products: 0, readyImages: 0 };
  entry.products += 1;
  entry.readyImages += Number(row.ready_images ?? 0);
  coverage.set(key, entry);
}

const missing = teams.filter((team) => {
  const entry = coverage.get(normalize(team));
  return !entry || entry.products < 1 || entry.readyImages < 1;
});
if (missing.length > 0) {
  throw new Error(`Times sem produto ativo com imagem no Brasileirão: ${missing.join(", ")}`);
}

const result = {
  expectedTeams: teams.length,
  coveredTeams: teams.length - missing.length,
  activeProducts: targetRows.length,
  readyImages: targetRows.reduce((sum, row) => sum + Number(row.ready_images ?? 0), 0),
  missingTeams: missing,
  teams: teams.map((team) => ({
    name: team,
    products: coverage.get(normalize(team))?.products ?? 0,
    readyImages: coverage.get(normalize(team))?.readyImages ?? 0,
  })),
};

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(
  `BRASILEIRAO_PRODUCTION_OK teams=${result.coveredTeams} activeProducts=${result.activeProducts} readyImages=${result.readyImages}`,
);
