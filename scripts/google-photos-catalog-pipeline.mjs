import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildCatalogBusinessProfile, normalizeCatalogText } from "./catalog-business-rules.mjs";

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const slugify = (value) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function parseArgs(argv) {
  const out = {
    collector: ".artifacts/google-photos-collector/collector.json",
    assimilation: ".artifacts/google-photos-collector/assimilation/assimilation.json",
    report: ".artifacts/google-photos-collector/catalog-pipeline-plan.json",
    apply: false,
    reset: false,
    activate: false,
    validateUrls: false,
    stock: 999,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--collector") out.collector = argv[++i];
    else if (arg === "--assimilation") out.assimilation = argv[++i];
    else if (arg === "--report") out.report = argv[++i];
    else if (arg === "--apply") out.apply = true;
    else if (arg === "--reset") out.reset = true;
    else if (arg === "--activate") out.activate = true;
    else if (arg === "--validate-urls") out.validateUrls = true;
    else if (arg === "--stock") out.stock = Number.parseInt(argv[++i], 10);
    else throw new Error(`Opção desconhecida: ${arg}`);
  }
  if (!Number.isInteger(out.stock) || out.stock < 0 || out.stock > 1_000_000) {
    throw new Error("Estoque padrão inválido.");
  }
  if (out.activate && !out.apply) throw new Error("--activate exige --apply.");
  return out;
}

function titleCaseEntity(value) {
  const upperWords = new Set(["PSG", "AC", "FC", "NBA", "EA7"]);
  return clean(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      return upperWords.has(upper) ? upper : upper.slice(0, 1) + upper.slice(1).toLowerCase();
    })
    .join(" ");
}

function categoryForType(type) {
  if (type === "camisa" || type === "regata") return { name: "Camisas", slug: "camisas" };
  if (type === "shorts") return { name: "Shorts", slug: "shorts" };
  if (type === "kit" || type === "conjunto") return { name: "Kids", slug: "infantil" };
  if (type === "treino" || type === "viagem") return { name: "Kits de treino", slug: "kit-treino" };
  if (type === "corta-vento") return { name: "Corta-vento", slug: "corta-ventos" };
  return { name: "Outros", slug: "outros" };
}

function leagueFromPatchCodes(codes) {
  const map = [
    ["premier-league", "Premier League"],
    ["laliga", "LaLiga"],
    ["serie-a", "Serie A"],
    ["bundesliga", "Bundesliga"],
    ["ligue-1", "Ligue 1"],
    ["mls", "MLS"],
    ["liga-portugal", "Liga Portugal"],
    ["eredivisie", "Eredivisie"],
    ["scottish-premiership", "Scottish Premiership"],
    ["super-lig", "Süper Lig"],
    ["saudi-pro-league", "Saudi Pro League"],
    ["brasileirao", "Brasileirão"],
    ["liga-profesional-argentina", "Liga Profissional Argentina"],
    ["liga-mx", "Liga MX"],
  ];
  return map.find(([code]) => codes.includes(code))?.[1] ?? null;
}

function commercialLabel(type) {
  return {
    torcedor: "Torcedor",
    jogador: "Jogador",
    feminino: "Feminino",
    infantil: "Infantil",
    retro: "Retrô",
    calcao: "Calção",
    basquete: "Basquete",
  }[type] ?? "Versão";
}

function productName(proposal) {
  const entity = titleCaseEntity(proposal.entity || "Produto");
  const type = proposal.type === "regata" ? "Regata" : proposal.type === "camisa" ? "Camisa" : titleCaseEntity(proposal.type);
  const model = proposal.model ? ` ${proposal.model}` : "";
  const season = proposal.season ? ` ${proposal.season}` : "";
  const brand = proposal.brand ? ` ${titleCaseEntity(proposal.brand)}` : "";
  return `${entity} — ${type}${model}${season}${brand}`.trim();
}

function descriptionFor(name, proposal, commercialType, uniformLabel) {
  const parts = [name + "."];
  if (commercialType && commercialType !== "other") parts.push(`Versão ${commercialLabel(commercialType)}.`);
  if (proposal.season) parts.push(`Temporada ${proposal.season}.`);
  if (proposal.brand) parts.push(`Marca ${titleCaseEntity(proposal.brand)}.`);
  parts.push("Disponível com as opções de tamanho e personalização configuradas pela BIGofertas.");
  if (uniformLabel) parts.push(`Uniforme: ${uniformLabel}.`);
  return parts.join(" ");
}

function sourceIdentity(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function buildPlan(collector, assimilation, options) {
  if (!Array.isArray(collector.groups) || !Array.isArray(assimilation.proposedProducts)) {
    throw new Error("Artefatos do coletor/assimilador inválidos.");
  }

  const groupsByIndex = new Map(collector.groups.map((group, index) => [index + 1, group]));
  const proposalByGroup = new Map(
    (assimilation.groups ?? []).map((group) => [group.groupIndex, group.proposal]),
  );
  const albumIdentity = clean(collector.resolvedUrl || collector.sourceUrl);
  const products = [];
  const warnings = [];

  for (const [productIndex, proposed] of assimilation.proposedProducts.entries()) {
    if (!proposed.baseKey || !proposed.entity || !proposed.type) {
      throw new Error(`Produto-base ${productIndex + 1} não foi assimilado com segurança.`);
    }

    const firstGroupRef = proposed.groups?.[0];
    const firstProposal = proposalByGroup.get(firstGroupRef?.groupIndex) ?? proposed;
    const business = buildCatalogBusinessProfile({
      name: firstGroupRef?.title ?? productName(proposed),
      team: proposed.entity,
      season: proposed.season,
      audience: proposed.audience,
    });
    const patchCodes = business.patches.map((patch) => patch.code);
    const name = productName(proposed);
    const sourceKey = `gphotos:${crypto
      .createHash("sha256")
      .update(`${albumIdentity}|${proposed.baseKey}`)
      .digest("hex")
      .slice(0, 40)}`;

    const variants = [];
    for (const [variantIndex, groupRef] of (proposed.groups ?? []).entries()) {
      const group = groupsByIndex.get(groupRef.groupIndex);
      const groupProposal = proposalByGroup.get(groupRef.groupIndex);
      if (!group || !groupProposal) {
        throw new Error(`${name}: grupo ${groupRef.groupIndex} ausente no artefato.`);
      }
      const variantBusiness = buildCatalogBusinessProfile({
        name: group.title,
        team: proposed.entity,
        season: proposed.season,
        audience: proposed.audience,
      });
      const commercialType =
        variantBusiness.commercialType === "other"
          ? firstProposal.commercialType ?? business.commercialType
          : variantBusiness.commercialType;
      const images = group.images.map((image, imageIndex) => {
        const url = clean(image.highQualityUrl || image.directUrl || image.url);
        if (!/^https:\/\/lh\d+\.googleusercontent\.com\//.test(url)) {
          throw new Error(`${name}: imagem ${imageIndex + 1} não é uma URL Google Photos válida.`);
        }
        const mediaKey = clean(image.mediaKey) || sourceIdentity(url);
        return {
          sourceKey: `google_photos:${mediaKey}`,
          url,
          sortOrder: imageIndex,
          primary: imageIndex === 0,
        };
      });
      if (images.length === 0) throw new Error(`${name}: variante sem imagens.`);

      variants.push({
        code: slugify(groupProposal.version || `versao-${variantIndex + 1}`) || `versao-${variantIndex + 1}`,
        name: commercialLabel(commercialType),
        commercialType,
        price: variantBusiness.price,
        stock: options.stock,
        sourceTitle: group.title,
        images,
      });
    }

    const productCommercialType = variants[0]?.commercialType ?? business.commercialType;
    const price = variants[0]?.price ?? business.price;
    if (!Number.isFinite(price) || price <= 0) throw new Error(`${name}: preço não resolvido.`);

    const specs = [
      proposed.brand ? `Marca: ${titleCaseEntity(proposed.brand)}` : null,
      proposed.season ? `Temporada: ${proposed.season}` : null,
      `Versão: ${commercialLabel(productCommercialType)}`,
      business.uniform?.label ? `Uniforme: ${business.uniform.label}` : null,
    ].filter(Boolean).join(" | ");

    const record = {
      sourceKey,
      sourceTitle: firstGroupRef?.title ?? null,
      name,
      description: descriptionFor(name, proposed, productCommercialType, business.uniform?.label),
      category: categoryForType(proposed.type),
      competition: null,
      league: leagueFromPatchCodes(patchCodes),
      team: titleCaseEntity(proposed.entity),
      season: proposed.season ?? null,
      brand: proposed.brand ?? null,
      audience: normalizeCatalogText(proposed.audience || "adulto"),
      commercialType: productCommercialType,
      price,
      specifications: specs,
      personalizationEnabled: ["torcedor", "feminino", "jogador", "retro", "infantil", "basquete"].includes(productCommercialType),
      phraseEnabled: ["torcedor", "feminino", "jogador", "retro", "infantil", "basquete"].includes(productCommercialType),
      patches: business.patches,
      variants,
    };

    if (options.reset) record.catalogCode = `P${String(productIndex + 1).padStart(6, "0")}`;
    if (proposed.season === "26/26") {
      warnings.push(`${record.catalogCode ?? sourceKey}: temporada 26/26 preservada exatamente como veio do fornecedor.`);
    }
    products.push(record);
  }

  const imageCount = products.reduce(
    (sum, product) => sum + product.variants.reduce((inner, variant) => inner + variant.images.length, 0),
    0,
  );
  const variantCount = products.reduce((sum, product) => sum + product.variants.length, 0);
  return {
    schemaVersion: 1,
    batchKey: clean(collector.label) || `google-photos-${Date.now()}`,
    sourceAlbumUrl: albumIdentity,
    products,
    summary: { products: products.length, variants: variantCount, images: imageCount },
    warnings,
  };
}

async function validateUrl(url) {
  const head = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (head?.ok) return;
  const response = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-0" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Imagem externa indisponível (${response.status}): ${url.slice(0, 100)}`);
  }
  await response.body?.cancel();
}

async function mapLimit(items, concurrency, worker) {
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

function dollarQuote(value) {
  let tag = "catalog_payload";
  while (value.includes(`$${tag}$`)) tag += "_x";
  return `$${tag}$${value}$${tag}$`;
}

async function applyPlan(plan, options) {
  const projectRef = clean(process.env.SUPABASE_PROJECT_ID);
  const accessToken = clean(process.env.SUPABASE_ACCESS_TOKEN);
  if (!projectRef || !accessToken) {
    throw new Error("SUPABASE_PROJECT_ID e SUPABASE_ACCESS_TOKEN são obrigatórios para --apply.");
  }

  const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
  const headers = {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "content-type": "application/json",
  };
  const payloadJson = JSON.stringify({
    schemaVersion: plan.schemaVersion,
    batchKey: plan.batchKey,
    sourceAlbumUrl: plan.sourceAlbumUrl,
    products: plan.products,
  });
  const query = `
    select public.catalog_apply_normalized_batch(
      ${dollarQuote(payloadJson)}::jsonb,
      ${options.reset ? "true" : "false"},
      ${options.activate ? "true" : "false"},
      ${options.stock}
    );
  `;
  const digest = crypto.createHash("sha256").update(payloadJson).digest("hex").slice(0, 12);
  const migrationName = `catalog_google_photos_${slugify(plan.batchKey).slice(0, 30)}_${digest}`;

  const response = await fetch(`${apiBase}/database/migrations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: migrationName, query }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`SUPABASE_MIGRATION_HTTP_${response.status}: ${body.slice(0, 2000)}`);
  }

  const verifyQuery = `
    select
      count(*) filter (where catalog_code ~ '^P[0-9]{6}$')::int as coded_products,
      count(*) filter (where status = 'active')::int as active_products,
      (
        select count(*)::int
        from public.product_images
        where status = 'ready'::public.product_image_status
          and image_source = 'google_photos'
          and external_url is not null
      ) as google_images
    from public.products;
  `;
  const verify = await fetch(`${apiBase}/database/query/read-only`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: verifyQuery }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!verify.ok) throw new Error(`SUPABASE_VERIFY_HTTP_${verify.status}`);
  const verification = await verify.json();
  return { migrationName, verification };
}

const options = parseArgs(process.argv.slice(2));
const collector = JSON.parse(fs.readFileSync(path.resolve(options.collector), "utf8"));
const assimilation = JSON.parse(fs.readFileSync(path.resolve(options.assimilation), "utf8"));
const plan = buildPlan(collector, assimilation, options);

fs.mkdirSync(path.dirname(path.resolve(options.report)), { recursive: true });
fs.writeFileSync(path.resolve(options.report), `${JSON.stringify(plan, null, 2)}\n`, "utf8");

console.log(
  `CATALOG_PLAN products=${plan.summary.products} variants=${plan.summary.variants} images=${plan.summary.images}`,
);
for (const warning of plan.warnings) console.warn(`AVISO: ${warning}`);

if (options.validateUrls) {
  const urls = plan.products.flatMap((product) =>
    product.variants.flatMap((variant) => variant.images.map((image) => image.url)),
  );
  await mapLimit(urls, 6, validateUrl);
  console.log(`CATALOG_URL_VALIDATION_OK images=${urls.length}`);
}

if (!options.apply) {
  console.log("CATALOG_PIPELINE_PREVIEW_OK");
  process.exit(0);
}

const applied = await applyPlan(plan, options);
console.log("CATALOG_PIPELINE_APPLIED");
console.log(JSON.stringify(applied, null, 2));
