import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const out = { manifest: "", groupId: "", start: 1, end: 1, out: ".artifacts/remaining" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") out.manifest = argv[++index];
    else if (arg === "--group-id") out.groupId = argv[++index];
    else if (arg === "--start") out.start = Number(argv[++index]);
    else if (arg === "--end") out.end = Number(argv[++index]);
    else if (arg === "--out") out.out = argv[++index];
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!out.manifest || !out.groupId || !Number.isInteger(out.start) || !Number.isInteger(out.end)) {
    throw new Error("Use --manifest, --group-id, --start e --end.");
  }
  return out;
}

function run(args, attempts = 1) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(`$ node ${args.join(" ")} (tentativa ${attempt}/${attempts})`);
    const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
    if (result.status === 0) return;
    if (attempt === attempts) {
      throw new Error(`Comando falhou (${result.status}): node ${args.join(" ")}`);
    }
  }
}

const options = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(fs.readFileSync(path.resolve(options.manifest), "utf8"));
const group = (manifest.groups ?? []).find((item) => item.id === options.groupId);
if (!group) throw new Error(`Grupo não encontrado: ${options.groupId}`);
const albums = Array.isArray(group.albums) ? group.albums : [];
if (options.start < 1 || options.end > albums.length || options.start > options.end) {
  throw new Error(`Faixa inválida ${options.start}-${options.end} para ${albums.length} álbuns.`);
}

for (let index = options.start - 1; index < options.end; index += 1) {
  const album = albums[index];
  const albumIndex = String(index + 1).padStart(2, "0");
  const outDir = path.resolve(options.out, group.id, albumIndex);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== ${group.name} :: ${albumIndex}/${albums.length} :: ${album.name} ===`);

  run(
    [
      "scripts/google-photos-collector.mjs",
      "--url",
      album.url,
      "--label",
      `${group.name} - ${album.name}`,
      "--out",
      outDir,
      "--expected-min-images",
      "1",
      "--max-scrolls",
      "350",
    ],
    2,
  );
  run([
    "scripts/google-photos-assimilator-runner.mjs",
    "--input",
    path.join(outDir, "collector.json"),
    "--out",
    path.join(outDir, "assimilation"),
  ]);
  run([
    "scripts/catalog-pdf-remaining-scope-filter.mjs",
    "--input",
    path.join(outDir, "assimilation", "assimilation.json"),
    "--output",
    path.join(outDir, "assimilation", "filtered.json"),
    "--report",
    path.join(outDir, "scope-filter.json"),
    "--mode",
    group.mode,
  ]);
  run([
    "scripts/google-photos-catalog-pipeline.mjs",
    "--collector",
    path.join(outDir, "collector.json"),
    "--assimilation",
    path.join(outDir, "assimilation", "filtered.json"),
    "--report",
    path.join(outDir, "raw-plan.json"),
    "--validate-urls",
  ]);

  const planArgs = [
    "scripts/catalog-pdf-remaining-plan.mjs",
    "--input",
    path.join(outDir, "raw-plan.json"),
    "--output",
    path.join(outDir, "plan.json"),
    "--group-id",
    group.id,
    "--group-name",
    group.name,
    "--source-group",
    album.name,
    "--mode",
    group.mode,
  ];
  if (group.competition) planArgs.push("--competition", group.competition);
  if (group.league) planArgs.push("--league", group.league);
  run(planArgs);
}

console.log(
  `PDF_REMAINING_CHUNK_OK group=${group.id} range=${options.start}-${options.end} total=${albums.length}`,
);
