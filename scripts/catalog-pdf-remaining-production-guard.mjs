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
const projectRef = String(process.env.SUPABASE_PROJECT_ID ?? "").trim();
const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
if (!projectRef || !accessToken) throw new Error("SUPABASE_PROJECT_ID e SUPABASE_ACCESS_TOKEN são obrigatórios.");

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
          p.catalog_code,
          p.name,
          p.time,
          p.campeonato,
          p.liga,
          c.slug as category_slug,
          s.commercial_type,
          count(i.id) filter (
            where i.status::text = 'ready'
              and coalesce(i.external_url, '') <> ''
          )::int as ready_external_images
        from public.products p
        left join public.categories c on c.id = p.category_id
        left join public.product_purchase_settings s on s.product_id = p.id
        left join public.product_images i on i.product_id = p.id
        where p.status::text = 'active'
        group by p.id, p.catalog_code, p.name, p.time, p.campeonato, p.liga, c.slug, s.commercial_type;
      `,
    }),
    signal: AbortSignal.timeout(120_000),
  },
);
const text = await response.text();
if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${text.slice(0, 2000)}`);
const rows = text ? JSON.parse(text) : [];
const readyRows = rows.filter((row) => Number(row.ready_external_images) > 0);
const result = { groups: [], totalActiveProducts: 0 };

for (const group of manifest.groups ?? []) {
  if (group.mode === "club") {
    const allowed = new Set((group.albums ?? []).map((album) => normalize(album.name)));
    const matching = readyRows.filter(
      (row) => allowed.has(normalize(row.time)) && ["torcedor", "jogador", "feminino", "infantil", "calcao"].includes(row.commercial_type),
    );
    const covered = new Set(matching.map((row) => normalize(row.time)));
    const missing = (group.albums ?? []).filter((album) => !covered.has(normalize(album.name))).map((album) => album.name);
    if (missing.length > 0) throw new Error(`${group.name}: times sem produto ativo com imagem: ${missing.join(", ")}`);
    result.groups.push({ id: group.id, expectedAlbums: group.albums.length, coveredAlbums: covered.size, activeProducts: matching.length });
    result.totalActiveProducts += matching.length;
  } else if (group.mode === "kids") {
    const matching = readyRows.filter((row) => row.commercial_type === "infantil" && normalize(row.category_slug) === "INFANTIL");
    if (matching.length === 0) throw new Error("Kids: nenhum produto infantil ativo com imagem.");
    result.groups.push({ id: group.id, activeProducts: matching.length });
  } else if (group.mode === "shorts") {
    const matching = readyRows.filter((row) => row.commercial_type === "calcao" && normalize(row.category_slug) === "SHORTS");
    if (matching.length === 0) throw new Error("Shorts: nenhum produto de shorts ativo com imagem.");
    result.groups.push({ id: group.id, activeProducts: matching.length });
  }
}

fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
fs.writeFileSync(path.resolve(options.output), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`PDF_REMAINING_PRODUCTION_OK groups=${result.groups.length} clubProducts=${result.totalActiveProducts}`);
