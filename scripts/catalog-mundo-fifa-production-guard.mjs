import fs from "node:fs";
import path from "node:path";

const SOURCE_EMPTY_TEAMS = new Set(["SERVIA"]);

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
const sourceTeams = (manifest.albums ?? []).map((album) => album.name);
if (sourceTeams.length !== 47)
  throw new Error(`Manifesto Mundo FIFA inválido: ${sourceTeams.length} seleções-fonte.`);
if (sourceTeams.some((team) => normalize(team) === "ARGELIA"))
  throw new Error("Argélia não pode estar no lote.");

const sourceSkipped = sourceTeams.filter((team) => SOURCE_EMPTY_TEAMS.has(normalize(team)));
const teams = sourceTeams.filter((team) => !SOURCE_EMPTY_TEAMS.has(normalize(team)));

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
          p.price,
          s.commercial_type,
          count(i.id) filter (
            where i.status::text = 'ready'
              and coalesce(i.external_url, '') <> ''
          )::int as ready_external_images
        from public.products p
        left join public.product_purchase_settings s on s.product_id = p.id
        left join public.product_images i on i.product_id = p.id
        where p.status::text = 'active'
          and p.campeonato = 'Copa do Mundo'
        group by p.id, p.catalog_code, p.name, p.time, p.campeonato, p.price, s.commercial_type
        order by p.catalog_code;
      `,
    }),
    signal: AbortSignal.timeout(120_000),
  },
);
const text = await response.text();
if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${text.slice(0, 2000)}`);
const rows = text ? JSON.parse(text) : [];

const counts = new Map();
for (const row of rows) {
  const key = normalize(row.time);
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
const missing = teams.filter((team) => !counts.get(normalize(team)));
if (missing.length > 0) {
  throw new Error(`Seleções sem produto ativo no Mundo FIFA: ${missing.join(", ")}`);
}

const expectedPrices = {
  torcedor: 184.9,
  feminino: 184.9,
  jogador: 219.9,
  retro: 219.9,
  infantil: 169.9,
};
const targetKeys = new Set(teams.map(normalize));
for (const row of rows) {
  if (!targetKeys.has(normalize(row.time))) continue;
  const expected = expectedPrices[row.commercial_type];
  if (expected !== undefined && Math.abs(Number(row.price) - expected) > 0.001) {
    throw new Error(`${row.catalog_code}: preço incorreto para ${row.commercial_type}.`);
  }
  if (Number(row.ready_external_images) < 1) {
    throw new Error(`${row.catalog_code}: produto sem imagem externa pronta.`);
  }
}

const result = {
  sourceTeams: sourceTeams.length,
  expectedTeams: teams.length,
  coveredTeams: teams.length - missing.length,
  activeProducts: rows.filter((row) => targetKeys.has(normalize(row.time))).length,
  missingTeams: missing,
  sourceSkipped,
};
fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(
  `MUNDO_FIFA_PRODUCTION_OK sourceTeams=${result.sourceTeams} teams=${result.coveredTeams} activeProducts=${result.activeProducts} sourceSkipped=${result.sourceSkipped.length}`,
);
