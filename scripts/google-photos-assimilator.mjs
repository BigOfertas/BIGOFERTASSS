import fs from "node:fs";
import path from "node:path";
import { buildCatalogBusinessProfile } from "./catalog-business-rules.mjs";

const clean = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
const escapeHtml = (value) =>
  clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const BRAND_RE =
  /\b(ADIDAS|NIKE|PUMA|EA7|UMBRO|KAPPA|JORDAN|CASTORE|NEW BALANCE|LE COQ(?: SPORTIF)?|MACRON|MIZUNO|JOMA|UNDER ARMOUR|REEBOK)\b/i;
const SEASON_RE = /\b(\d{2}\s*\/\s*\d{2})\b/;
const MODEL_RE = /\b(?:CAMISA|REGATA)\s+(I{1,3}|IV|V)\b/i;

function parseArgs() {
  const out = {
    input: ".artifacts/google-photos-collector/collector.json",
    out: ".artifacts/google-photos-collector/assimilation",
  };
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--input") out.input = args[++index];
    else if (args[index] === "--out") out.out = args[++index];
  }
  return out;
}

function slugify(value) {
  return (
    clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "grupo"
  );
}

function classifyType(title) {
  const upper = title.toUpperCase();
  if (/CORTA[ -]?VENTO|WINDBREAKER/.test(upper)) return "corta-vento";
  if (/\bSHORTS?\b/.test(upper)) return "shorts";
  if (/\bCONJUNTO\b/.test(upper)) return "conjunto";
  if (/\bKIT\b/.test(upper)) return "kit";
  if (/\bREGATA\b/.test(upper)) return "regata";
  if (/\bTREINO\b/.test(upper)) return "treino";
  if (/\bVIAGEM\b/.test(upper)) return "viagem";
  if (/\bCAMISA\b/.test(upper)) return "camisa";
  return "outro";
}

function classifyAudience(title) {
  const upper = title.toUpperCase();
  if (/FEMININ[AO]/.test(upper)) return { value: "feminino", inferred: false };
  if (/KIDS?|INFANTIL/.test(upper)) return { value: "infantil", inferred: false };
  return { value: "adulto", inferred: true };
}

function classifyVersion(title, type) {
  const upper = title.toUpperCase();
  if (/\b(PLAYER|JOGADOR)\b/.test(upper)) return { value: "jogador", inferred: false };
  if (/\b(TORCEDOR|FAN)\b/.test(upper)) return { value: "torcedor", inferred: false };
  if (type === "camisa" || type === "regata") return { value: "torcedor", inferred: true };
  return { value: null, inferred: false };
}

function extractEntity(title, { brand, season, model, type }) {
  let value = ` ${title} `;
  const replacements = [
    /\bCAMISA\b/gi,
    /\bREGATA\b/gi,
    /\bCONJUNTO\b/gi,
    /\bKIT\b/gi,
    /\bSHORTS?\b/gi,
    /\bCORTA[ -]?VENTO\b/gi,
    /\bWINDBREAKER\b/gi,
    /\bTREINO\b/gi,
    /\bVIAGEM\b/gi,
    /\bPLAYER\b/gi,
    /\bJOGADOR\b/gi,
    /\bTORCEDOR\b/gi,
    /\bFAN\b/gi,
    /\bFEMININ[AO]\b/gi,
    /\bKIDS?\b/gi,
    /\bINFANTIL\b/gi,
    /\bRET[RÔO]\b/gi,
    /\bGOLEIRO\b/gi,
    /\bBASQUETE\b/gi,
    /\bNBA\b/gi,
  ];
  for (const re of replacements) value = value.replace(re, " ");
  if (season) value = value.replace(new RegExp(season.replace("/", "\\/"), "gi"), " ");
  if (brand)
    value = value.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  if (model) value = value.replace(new RegExp(`\\b${model}\\b`, "gi"), " ");
  if (type === "kit") value = value.replace(/\bI\s+E\s+II\b/gi, " ");
  return clean(value.replace(/[-–—]+/g, " "));
}

function normalizeKey(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function parseTitle(title) {
  const normalizedTitle = clean(title);
  const type = classifyType(normalizedTitle);
  const brand = normalizedTitle.match(BRAND_RE)?.[1]?.toUpperCase() ?? null;
  const season = normalizedTitle.match(SEASON_RE)?.[1]?.replace(/\s+/g, "") ?? null;
  const model = normalizedTitle.match(MODEL_RE)?.[1]?.toUpperCase() ?? null;
  const audience = classifyAudience(normalizedTitle);
  const version = classifyVersion(normalizedTitle, type);
  const entity = extractEntity(normalizedTitle, { brand, season, model, type }) || null;
  const businessProfile = buildCatalogBusinessProfile({
    name: normalizedTitle,
    tipo_produto: type,
    audience: audience.value,
  });
  const warnings = [];
  if (!entity) warnings.push("time/seleção não identificado automaticamente");
  if (!season) warnings.push("temporada ausente ou não reconhecida");
  if (!brand) warnings.push("marca ausente ou não reconhecida");
  if ((type === "camisa" || type === "regata") && !model)
    warnings.push("modelo I/II/III não identificado");
  if (version.inferred) warnings.push("versão Torcedor inferida pela ausência de Player/Jogador");
  if (audience.inferred)
    warnings.push("público adulto inferido pela ausência de Feminino/Kids/Infantil");

  let confidence = 0.25;
  if (type !== "outro") confidence += 0.15;
  if (entity) confidence += 0.2;
  if (season) confidence += 0.15;
  if (brand) confidence += 0.1;
  if (model || !["camisa", "regata"].includes(type)) confidence += 0.1;
  if (!version.inferred) confidence += 0.05;
  confidence = Math.min(0.99, Number(confidence.toFixed(2)));

  const baseKey = [type, normalizeKey(entity || ""), season || "", model || "", audience.value]
    .filter(Boolean)
    .join("|");

  return {
    titleOriginal: normalizedTitle,
    type,
    entity,
    season,
    brand,
    model,
    version: version.value,
    versionInferred: version.inferred,
    audience: audience.value,
    audienceInferred: audience.inferred,
    commercialType: businessProfile.commercialType,
    price: businessProfile.price,
    uniform: businessProfile.uniform,
    specifications: businessProfile.specifications,
    patches: businessProfile.patches,
    baseKey,
    confidence,
    warnings,
  };
}

function mediumUrl(raw, size = 1000) {
  try {
    const url = new URL(raw);
    url.pathname =
      url.pathname.replace(/=w\d+(?:-h\d+)?[^/?#]*/i, "").replace(/=s\d+[^/?#]*/i, "") +
      `=w${size}-h${size}-s-no-gm`;
    return url.toString();
  } catch {
    return raw;
  }
}

function formatPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `R$ ${numeric.toFixed(2).replace(".", ",")}` : "—";
}

function buildGroupHtml(group, proposal) {
  const cards = group.images
    .map((image, index) => {
      const url = mediumUrl(image.directUrl || image.highQualityUrl || image.url || "");
      return `<figure><div class="imgwrap"><img src="${escapeHtml(url)}" alt="Imagem ${index + 1}" loading="eager"></div><figcaption>Imagem ${index + 1}</figcaption></figure>`;
    })
    .join("");
  const warningHtml = proposal.warnings.length
    ? `<div class="warnings"><strong>Avisos automáticos:</strong> ${proposal.warnings.map(escapeHtml).join(" · ")}</div>`
    : '<div class="ok">Sem aviso estrutural automático.</div>';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;padding:32px;font-family:Arial,sans-serif;background:#f5f5f5;color:#111}
  h1{font-size:30px;margin:0 0 12px}.meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 18px}
  .meta div{background:white;border:1px solid #ddd;border-radius:10px;padding:10px 12px;font-size:14px}.meta b{display:block;font-size:11px;text-transform:uppercase;color:#666;margin-bottom:4px}
  .warnings,.ok{padding:12px 14px;border-radius:10px;background:white;border:1px solid #ddd;margin-bottom:22px;font-size:13px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0;background:#fff;border:1px solid #ddd;border-radius:12px;overflow:hidden}
  .imgwrap{height:360px;display:flex;align-items:center;justify-content:center;background:#fff}.imgwrap img{max-width:100%;max-height:100%;object-fit:contain}
  figcaption{padding:10px 12px;font-size:12px;color:#555;border-top:1px solid #eee}
  </style></head><body><h1>${escapeHtml(group.title)}</h1>
  <div class="meta"><div><b>Entidade</b>${escapeHtml(proposal.entity || "—")}</div><div><b>Tipo</b>${escapeHtml(proposal.type)}</div><div><b>Modelo</b>${escapeHtml(proposal.model || "—")}</div><div><b>Versão</b>${escapeHtml(proposal.version || "—")}</div><div><b>Temporada</b>${escapeHtml(proposal.season || "—")}</div><div><b>Marca</b>${escapeHtml(proposal.brand || "—")}</div><div><b>Público</b>${escapeHtml(proposal.audience || "—")}</div><div><b>Comercial</b>${escapeHtml(proposal.commercialType || "—")}</div><div><b>Preço</b>${escapeHtml(formatPrice(proposal.price))}</div><div><b>Uniforme</b>${escapeHtml(proposal.uniform?.label || "—")}</div><div><b>Confiança</b>${proposal.confidence}</div></div>
  ${warningHtml}<div class="grid">${cards}</div></body></html>`;
}

function buildOverviewHtml(items) {
  const sections = items
    .map(({ group, proposal, screenshot }) => {
      const images = group.images
        .slice(0, 5)
        .map((image, index) => {
          const url = mediumUrl(image.directUrl || image.highQualityUrl || image.url || "", 700);
          return `<img src="${escapeHtml(url)}" alt="${index + 1}" loading="eager">`;
        })
        .join("");
      return `<section><h2>${escapeHtml(group.title)}</h2><p>${escapeHtml(proposal.entity || "—")} · ${escapeHtml(proposal.type)} · ${escapeHtml(proposal.model || "—")} · ${escapeHtml(proposal.version || "—")} · ${escapeHtml(proposal.season || "—")} · ${escapeHtml(proposal.brand || "—")} · ${escapeHtml(proposal.commercialType || "—")} · ${escapeHtml(formatPrice(proposal.price))} · ${escapeHtml(proposal.uniform?.label || "—")}</p><div class="thumbs">${images}</div><small>${escapeHtml(screenshot)}</small></section>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;padding:28px;font-family:Arial,sans-serif;background:#f0f0f0;color:#111}h1{margin:0 0 22px}
  section{background:#fff;border:1px solid #ddd;border-radius:12px;padding:18px;margin-bottom:18px;break-inside:avoid}h2{font-size:20px;margin:0 0 5px}p{margin:0 0 12px;color:#555;font-size:13px}
  .thumbs{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.thumbs img{width:100%;height:180px;object-fit:contain;border:1px solid #eee;border-radius:8px;background:white}small{display:block;margin-top:10px;color:#777}
  </style></head><body><h1>BIGofertas — Assimilação visual automática</h1>${sections}</body></html>`;
}

async function waitForImages(page, timeout = 15000) {
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout })
    .catch(() => {});
  return page.evaluate(() => ({
    total: document.images.length,
    loaded: [...document.images].filter((img) => img.complete && img.naturalWidth > 0).length,
    failed: [...document.images].filter((img) => img.complete && img.naturalWidth === 0).length,
  }));
}

async function run() {
  const options = parseArgs();
  if (!fs.existsSync(options.input))
    throw new Error(`collector.json não encontrado: ${options.input}`);
  const report = JSON.parse(fs.readFileSync(options.input, "utf8"));
  if (!Array.isArray(report.groups) || report.groups.length === 0)
    throw new Error("Nenhum grupo disponível para assimilação visual.");
  fs.mkdirSync(options.out, { recursive: true });
  const sheetsDir = path.join(options.out, "contact-sheets");
  fs.mkdirSync(sheetsDir, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "pt-BR",
  });
  const page = await context.newPage();

  const items = [];
  for (let index = 0; index < report.groups.length; index += 1) {
    const group = report.groups[index];
    const proposal = parseTitle(group.title);
    const fileBase = `${String(index + 1).padStart(3, "0")}-${slugify(group.title)}`;
    const htmlFile = path.join(sheetsDir, `${fileBase}.html`);
    const pngFile = path.join(sheetsDir, `${fileBase}.png`);
    const html = buildGroupHtml(group, proposal);
    fs.writeFileSync(htmlFile, html);
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const imageLoad = await waitForImages(page);
    await page.screenshot({ path: pngFile, fullPage: true });
    items.push({
      groupIndex: index + 1,
      group,
      proposal,
      screenshot: path.relative(options.out, pngFile).replace(/\\/g, "/"),
      html: path.relative(options.out, htmlFile).replace(/\\/g, "/"),
      imageLoad,
    });
  }

  const productsByBase = new Map();
  for (const item of items) {
    const key = item.proposal.baseKey || `UNRESOLVED|${item.groupIndex}`;
    if (!productsByBase.has(key)) {
      productsByBase.set(key, {
        baseKey: key,
        entity: item.proposal.entity,
        type: item.proposal.type,
        season: item.proposal.season,
        brand: item.proposal.brand,
        model: item.proposal.model,
        audience: item.proposal.audience,
        groups: [],
        warnings: [],
      });
    }
    const product = productsByBase.get(key);
    product.groups.push({
      groupIndex: item.groupIndex,
      title: item.group.title,
      version: item.proposal.version,
      versionInferred: item.proposal.versionInferred,
      imageCount: item.group.images.length,
      screenshot: item.screenshot,
    });
    product.warnings.push(...item.proposal.warnings);
  }

  const products = [...productsByBase.values()].map((product, index) => ({
    proposalIndex: index + 1,
    ...product,
    warnings: [...new Set(product.warnings)],
  }));
  const overviewHtml = buildOverviewHtml(items);
  const overviewHtmlPath = path.join(options.out, "overview.html");
  const overviewPngPath = path.join(options.out, "overview.png");
  fs.writeFileSync(overviewHtmlPath, overviewHtml);
  await page.setContent(overviewHtml, { waitUntil: "domcontentloaded" });
  const overviewLoad = await waitForImages(page, 20000);
  await page.screenshot({ path: overviewPngPath, fullPage: true });
  await browser.close();

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      label: report.label ?? null,
      sourceUrl: report.sourceUrl,
      resolvedUrl: report.resolvedUrl,
      pageTitle: report.pageTitle,
    },
    stats: {
      groups: items.length,
      productImages: items.reduce((sum, item) => sum + item.group.images.length, 0),
      proposedBaseProducts: products.length,
      contactSheets: items.length,
      contactSheetsWithImageFailures: items.filter((item) => item.imageLoad.failed > 0).length,
      overviewLoadedImages: overviewLoad.loaded,
      overviewFailedImages: overviewLoad.failed,
    },
    groups: items.map((item) => ({
      groupIndex: item.groupIndex,
      title: item.group.title,
      imageCount: item.group.images.length,
      proposal: item.proposal,
      screenshot: item.screenshot,
      html: item.html,
      imageLoad: item.imageLoad,
    })),
    proposedProducts: products,
  };

  fs.writeFileSync(path.join(options.out, "assimilation.json"), JSON.stringify(result, null, 2));
  fs.writeFileSync(
    path.join(options.out, "catalog-proposals.json"),
    JSON.stringify(products, null, 2),
  );
  const markdown = [
    "# BIGofertas — Assimilação automática",
    "",
    `- Grupos: ${result.stats.groups}`,
    `- Imagens de produto: ${result.stats.productImages}`,
    `- Produtos-base propostos: ${result.stats.proposedBaseProducts}`,
    `- Contact sheets: ${result.stats.contactSheets}`,
    `- Contact sheets com falha de imagem: ${result.stats.contactSheetsWithImageFailures}`,
    "",
    ...items.flatMap((item) => [
      `## ${item.groupIndex}. ${item.group.title}`,
      `- Entidade: ${item.proposal.entity || "—"}`,
      `- Tipo: ${item.proposal.type}`,
      `- Modelo: ${item.proposal.model || "—"}`,
      `- Versão: ${item.proposal.version || "—"}${item.proposal.versionInferred ? " (inferida)" : ""}`,
      `- Temporada: ${item.proposal.season || "—"}`,
      `- Marca: ${item.proposal.brand || "—"}`,
      `- Público: ${item.proposal.audience}${item.proposal.audienceInferred ? " (inferido)" : ""}`,
      `- Imagens: ${item.group.images.length}`,
      `- Confiança estrutural: ${item.proposal.confidence}`,
      `- Screenshot: ${item.screenshot}`,
      item.proposal.warnings.length
        ? `- Avisos: ${item.proposal.warnings.join("; ")}`
        : "- Avisos: nenhum",
      "",
    ]),
  ].join("\n");
  fs.writeFileSync(path.join(options.out, "assimilation.md"), `${markdown}\n`);

  console.log(
    `ASSIMILATION_FINAL groups=${result.stats.groups} productImages=${result.stats.productImages} proposedBaseProducts=${result.stats.proposedBaseProducts} contactSheets=${result.stats.contactSheets} failures=${result.stats.contactSheetsWithImageFailures}`,
  );
  for (const item of items) {
    console.log(
      `ASSIMILATED ${item.groupIndex}: ${item.group.title} -> entity=${item.proposal.entity || "-"} model=${item.proposal.model || "-"} version=${item.proposal.version || "-"} images=${item.group.images.length}`,
    );
  }
  if (result.stats.contactSheetsWithImageFailures > 0) {
    throw new Error(
      `${result.stats.contactSheetsWithImageFailures} contact sheets tiveram imagens que não carregaram.`,
    );
  }
}

run().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
