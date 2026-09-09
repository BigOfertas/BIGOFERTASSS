import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULTS = Object.freeze({
  out: ".artifacts/google-photos-collector",
  maxScrolls: 350,
  idleRounds: 10,
  settleMs: 900,
  minWidth: 120,
  minHeight: 120,
  expectedMinImages: 1,
});

const GOOGLE_PHOTOS_HOSTS = new Set(["photos.google.com", "photos.app.goo.gl"]);
const GOOGLE_IMAGE_HOST_RE = /(^|\.)googleusercontent\.com$/i;
const UI_TEXT = new Set([
  "google photos",
  "photos",
  "sign in",
  "login",
  "share",
  "more options",
  "back",
  "join",
  "save",
  "add photos",
  "download",
  "favorite",
  "info",
  "slideshow",
  "archive",
  "delete",
  "print store",
]);

function fail(message, code = 1) {
  console.error(`ERRO: ${message}`);
  process.exit(code);
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numberOption(value, fallback, min, max) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    fail(`Valor numerico invalido: ${value}. Esperado entre ${min} e ${max}.`);
  }
  return Math.floor(parsed);
}

export function validateGooglePhotosUrl(raw) {
  let url;
  try {
    url = new URL(cleanText(raw));
  } catch {
    throw new Error("URL do Google Photos invalida.");
  }
  if (url.protocol !== "https:") throw new Error("A URL precisa usar HTTPS.");
  if (!GOOGLE_PHOTOS_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("A URL precisa ser de photos.google.com ou photos.app.goo.gl.");
  }
  return url.toString();
}

export function isGoogleImageUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && GOOGLE_IMAGE_HOST_RE.test(url.hostname);
  } catch {
    return false;
  }
}

export function mediaKeyFromUrl(raw) {
  if (!isGoogleImageUrl(raw)) return null;
  const url = new URL(raw);
  const strippedPath = url.pathname.replace(/=[^/=]+(?:-[^/=]+)*$/, "");
  return `${url.hostname.toLowerCase()}${strippedPath}`;
}

export function highQualityGoogleImageUrl(raw, size = 4096) {
  if (!isGoogleImageUrl(raw)) return raw;
  const url = new URL(raw);
  url.search = "";
  const base = url.pathname.replace(/=[^/=]+(?:-[^/=]+)*$/, "");
  url.pathname = `${base}=w${size}-h${size}-s-no-gm`;
  return url.toString();
}

export function looksLikeCatalogTitle(raw) {
  const text = cleanText(raw);
  if (text.length < 5 || text.length > 180) return false;
  if (UI_TEXT.has(text.toLowerCase())) return false;
  const letters = [...text].filter((char) => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(char));
  const uppercase = letters.filter((char) => char === char.toUpperCase()).length;
  const upperRatio = letters.length ? uppercase / letters.length : 0;
  const keyword = /\b(CAMISA|CONJUNTO|KIT|SHORTS?|CORTA[ -]?VENTO|WINDBREAKER|REGATA|PLAYER|JOGADOR|TORCEDOR|FEMININ[AO]|KIDS?|INFANTIL|RET[RÔO]|TREINO|VIAGEM|GOLEIRO|BASQUETE|NBA)\b/i.test(text);
  const season = /\b\d{2}\s*\/\s*\d{2}\b/.test(text);
  return keyword && (season || upperRatio >= 0.62);
}

function parseArgs(argv) {
  const options = { ...DEFAULTS, url: null, label: null, debug: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--url") options.url = argv[++index];
    else if (arg === "--out") options.out = argv[++index];
    else if (arg === "--label") options.label = argv[++index];
    else if (arg === "--max-scrolls") options.maxScrolls = numberOption(argv[++index], DEFAULTS.maxScrolls, 1, 2000);
    else if (arg === "--idle-rounds") options.idleRounds = numberOption(argv[++index], DEFAULTS.idleRounds, 2, 100);
    else if (arg === "--settle-ms") options.settleMs = numberOption(argv[++index], DEFAULTS.settleMs, 100, 10000);
    else if (arg === "--expected-min-images") options.expectedMinImages = numberOption(argv[++index], DEFAULTS.expectedMinImages, 1, 100000);
    else if (arg === "--min-width") options.minWidth = numberOption(argv[++index], DEFAULTS.minWidth, 1, 5000);
    else if (arg === "--min-height") options.minHeight = numberOption(argv[++index], DEFAULTS.minHeight, 1, 5000);
    else if (arg === "--no-debug") options.debug = false;
    else if (arg === "--help" || arg === "-h") {
      console.log(`\nUso:\n  node scripts/google-photos-collector.mjs --url <album-publico> [opcoes]\n\nOpcoes:\n  --out <pasta>                 Pasta de artefatos\n  --label <nome>                Rotulo amigavel do lote\n  --expected-min-images <n>     Falha se coletar menos que n imagens\n  --max-scrolls <n>             Limite de ciclos de rolagem\n  --idle-rounds <n>             Rodadas sem novidades antes de encerrar\n  --settle-ms <ms>              Espera entre rolagens\n  --min-width <px>              Largura minima de imagem de catalogo\n  --min-height <px>             Altura minima de imagem de catalogo\n  --no-debug                    Nao salva snapshot textual/HTML\n`);
      process.exit(0);
    } else {
      fail(`Opcao desconhecida: ${arg}`);
    }
  }
  if (!options.url) fail("Informe --url com o album publico do Google Photos.");
  try {
    options.url = validateGooglePhotosUrl(options.url);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  options.out = path.resolve(cleanText(options.out) || DEFAULTS.out);
  options.label = cleanText(options.label) || null;
  return options;
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch {
    fail("Playwright nao encontrado. Instale com `npm install --no-save playwright` antes de executar o coletor.");
  }
}

async function dismissCommonOverlays(page) {
  const labels = ["Aceitar tudo", "Aceitar", "I agree", "Accept all", "Got it", "Entendi", "Continuar"];
  for (const label of labels) {
    try {
      const locator = page.getByRole("button", { name: label, exact: false }).first();
      if (await locator.isVisible({ timeout: 250 })) {
        await locator.click({ timeout: 1000 });
        await sleep(350);
      }
    } catch {
      // Overlay absent or inaccessible: continue.
    }
  }
}

function mergeObservation(map, observation) {
  const existing = map.get(observation.mediaKey);
  if (!existing) {
    map.set(observation.mediaKey, {
      ...observation,
      observedUrls: new Set([observation.url]),
      observations: 1,
    });
    return true;
  }
  existing.observedUrls.add(observation.url);
  existing.observations += 1;
  if (
    observation.top < existing.top ||
    (observation.top === existing.top && observation.left < existing.left)
  ) {
    existing.top = observation.top;
    existing.left = observation.left;
    existing.width = observation.width;
    existing.height = observation.height;
    existing.alt = observation.alt || existing.alt;
    existing.url = observation.url;
  }
  return false;
}

function mergeTitle(map, title) {
  const key = `${title.text}\u0000${Math.round(title.top / 4)}`;
  if (map.has(key)) return false;
  map.set(key, title);
  return true;
}

async function scanVisiblePage(page, options) {
  return page.evaluate(({ minWidth, minHeight }) => {
    const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const imageHost = /(^|\.)googleusercontent\.com$/i;
    const mediaKey = (raw) => {
      try {
        const url = new URL(raw);
        if (url.protocol !== "https:" || !imageHost.test(url.hostname)) return null;
        const strippedPath = url.pathname.replace(/=[^/=]+(?:-[^/=]+)*$/, "");
        return `${url.hostname.toLowerCase()}${strippedPath}`;
      } catch {
        return null;
      }
    };
    const candidates = [];
    const seen = new Set();
    const pushImage = (url, rect, alt = "", source = "img") => {
      const key = mediaKey(url);
      if (!key || seen.has(key)) return;
      if (rect.width < minWidth || rect.height < minHeight) return;
      if (rect.bottom < -window.innerHeight || rect.top > window.innerHeight * 2) return;
      seen.add(key);
      candidates.push({
        mediaKey: key,
        url,
        alt: clean(alt),
        source,
        top: Math.round(rect.top + window.scrollY),
        left: Math.round(rect.left + window.scrollX),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    for (const img of document.querySelectorAll("img")) {
      const rect = img.getBoundingClientRect();
      const src = img.currentSrc || img.src;
      if (src) pushImage(src, rect, img.alt, "img");
      const srcset = img.getAttribute("srcset") || "";
      for (const item of srcset.split(",")) {
        const url = item.trim().split(/\s+/)[0];
        if (url) pushImage(url, rect, img.alt, "srcset");
      }
    }

    for (const element of document.querySelectorAll("[style*='background']")) {
      const rect = element.getBoundingClientRect();
      if (rect.width < minWidth || rect.height < minHeight) continue;
      const background = getComputedStyle(element).backgroundImage;
      const match = background.match(/url\(["']?(https:\/\/[^"')]+)["']?\)/i);
      if (match) pushImage(match[1], rect, element.getAttribute("aria-label") || "", "background");
    }

    const texts = [];
    const textSeen = new Set();
    const selectors = "h1,h2,h3,h4,[role='heading'],div,span,p";
    for (const element of document.querySelectorAll(selectors)) {
      if (element.children.length > 4) continue;
      const text = clean(element.innerText || element.textContent);
      if (text.length < 5 || text.length > 180) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10 || rect.height > 240) continue;
      if (rect.bottom < -window.innerHeight || rect.top > window.innerHeight * 2) continue;
      const top = Math.round(rect.top + window.scrollY);
      const left = Math.round(rect.left + window.scrollX);
      const key = `${text}\u0000${Math.round(top / 4)}\u0000${Math.round(left / 8)}`;
      if (textSeen.has(key)) continue;
      textSeen.add(key);
      texts.push({ text, top, left, width: Math.round(rect.width), height: Math.round(rect.height) });
    }

    return {
      images: candidates,
      texts,
      scrollY: Math.round(window.scrollY),
      scrollHeight: Math.round(document.documentElement.scrollHeight),
      viewportHeight: Math.round(window.innerHeight),
      atBottom: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12,
      title: document.title,
      bodyText: clean(document.body?.innerText || "").slice(0, 100000),
    };
  }, { minWidth: options.minWidth, minHeight: options.minHeight });
}

function titleCandidateFromObservation(observation) {
  if (!looksLikeCatalogTitle(observation.text)) return null;
  return {
    text: cleanText(observation.text),
    top: observation.top,
    left: observation.left,
    width: observation.width,
    height: observation.height,
  };
}

function bestObservedUrl(image, networkUrls) {
  const candidates = new Set(image.observedUrls);
  for (const url of networkUrls ?? []) candidates.add(url);
  const scored = [...candidates]
    .filter(isGoogleImageUrl)
    .map((url) => {
      const sizeMatches = [...url.matchAll(/(?:^|[-=])(?:w|h)(\d{2,5})(?=$|-)/g)].map((match) => Number(match[1]));
      const score = sizeMatches.length ? Math.max(...sizeMatches) : 0;
      return { url, score };
    })
    .sort((a, b) => b.score - a.score || b.url.length - a.url.length);
  return scored[0]?.url || image.url;
}

export function groupImagesByTitles(images, titles) {
  const sortedImages = [...images].sort((a, b) => a.top - b.top || a.left - b.left || a.mediaKey.localeCompare(b.mediaKey));
  const sortedTitles = [...titles].sort((a, b) => a.top - b.top || a.left - b.left);
  const groups = [];
  const ungrouped = [];
  const groupMap = new Map();

  for (const image of sortedImages) {
    let chosen = null;
    for (const title of sortedTitles) {
      if (title.top <= image.top + 20) chosen = title;
      else break;
    }
    if (!chosen) {
      ungrouped.push(image);
      continue;
    }
    const key = `${chosen.text}\u0000${chosen.top}`;
    if (!groupMap.has(key)) {
      const group = { title: chosen.text, top: chosen.top, images: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key).images.push(image);
  }

  return { groups, ungrouped };
}

function serializeImage(image, index, networkByKey) {
  const observed = bestObservedUrl(image, networkByKey.get(image.mediaKey));
  return {
    index,
    mediaKey: image.mediaKey,
    directUrl: observed,
    highQualityUrl: highQualityGoogleImageUrl(observed),
    observedUrls: [...image.observedUrls].sort(),
    top: image.top,
    left: image.left,
    width: image.width,
    height: image.height,
    alt: image.alt || null,
    source: image.source,
    observations: image.observations,
  };
}

async function collect(options) {
  fs.mkdirSync(options.out, { recursive: true });
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    locale: "pt-BR",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const networkByKey = new Map();
  page.on("response", (response) => {
    const url = response.url();
    const key = mediaKeyFromUrl(url);
    if (!key) return;
    const contentType = String(response.headers()["content-type"] || "");
    if (contentType && !contentType.startsWith("image/")) return;
    if (!networkByKey.has(key)) networkByKey.set(key, new Set());
    networkByKey.get(key).add(url);
  });

  const images = new Map();
  const titles = new Map();
  const rawTexts = new Map();
  const warnings = [];
  const startedAt = new Date().toISOString();

  try {
    await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(1800);
    await dismissCommonOverlays(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);

    let idle = 0;
    let rounds = 0;
    let lastScrollHeight = 0;
    let lastImageCount = 0;
    let finalScan = null;

    while (rounds < options.maxScrolls) {
      rounds += 1;
      const scan = await scanVisiblePage(page, options);
      finalScan = scan;
      let added = 0;

      for (const image of scan.images) {
        if (mergeObservation(images, image)) added += 1;
      }
      for (const text of scan.texts) {
        const rawKey = `${text.text}\u0000${Math.round(text.top / 4)}\u0000${Math.round(text.left / 8)}`;
        if (!rawTexts.has(rawKey)) rawTexts.set(rawKey, text);
        const candidate = titleCandidateFromObservation(text);
        if (candidate) mergeTitle(titles, candidate);
      }

      const countChanged = images.size > lastImageCount;
      const heightChanged = scan.scrollHeight > lastScrollHeight + 4;
      if (added > 0 || countChanged || heightChanged) idle = 0;
      else idle += 1;
      lastImageCount = images.size;
      lastScrollHeight = Math.max(lastScrollHeight, scan.scrollHeight);

      console.log(
        `round=${rounds} scrollY=${scan.scrollY} height=${scan.scrollHeight} images=${images.size} titles=${titles.size} idle=${idle} bottom=${scan.atBottom}`,
      );

      if (scan.atBottom && idle >= options.idleRounds) break;

      const step = Math.max(600, Math.floor(scan.viewportHeight * 0.78));
      const target = Math.min(scan.scrollY + step, Math.max(0, scan.scrollHeight - scan.viewportHeight));
      if (target <= scan.scrollY + 2 && scan.atBottom) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      } else {
        await page.evaluate((nextY) => window.scrollTo({ top: nextY, behavior: "instant" }), target);
      }
      await sleep(options.settleMs);
    }

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(Math.max(900, options.settleMs));
    const tailScan = await scanVisiblePage(page, options);
    finalScan = tailScan;
    for (const image of tailScan.images) mergeObservation(images, image);
    for (const text of tailScan.texts) {
      const rawKey = `${text.text}\u0000${Math.round(text.top / 4)}\u0000${Math.round(text.left / 8)}`;
      if (!rawTexts.has(rawKey)) rawTexts.set(rawKey, text);
      const candidate = titleCandidateFromObservation(text);
      if (candidate) mergeTitle(titles, candidate);
    }

    const serializedImages = [...images.values()]
      .sort((a, b) => a.top - b.top || a.left - b.left || a.mediaKey.localeCompare(b.mediaKey))
      .map((image, index) => serializeImage(image, index + 1, networkByKey));

    const titleList = [...titles.values()].sort((a, b) => a.top - b.top || a.left - b.left);
    const groupingInput = serializedImages.map((image) => ({ ...image, observedUrls: new Set(image.observedUrls) }));
    const { groups, ungrouped } = groupImagesByTitles(groupingInput, titleList);

    if (serializedImages.length < options.expectedMinImages) {
      throw new Error(
        `Coleta incompleta: ${serializedImages.length} imagens encontradas; minimo esperado ${options.expectedMinImages}.`,
      );
    }
    if (titleList.length === 0) warnings.push("Nenhum titulo de produto reconhecido automaticamente; use os prints como gabarito de agrupamento.");
    if (ungrouped.length > 0) warnings.push(`${ungrouped.length} imagens ficaram sem titulo automatico associado.`);
    if (rounds >= options.maxScrolls) warnings.push("O limite maximo de rolagens foi atingido antes do criterio normal de estabilidade.");

    const report = {
      schemaVersion: 1,
      collector: "BIGofertas Google Photos Collector",
      label: options.label,
      sourceUrl: options.url,
      resolvedUrl: page.url(),
      pageTitle: cleanText(await page.title()),
      startedAt,
      completedAt: new Date().toISOString(),
      settings: {
        maxScrolls: options.maxScrolls,
        idleRounds: options.idleRounds,
        settleMs: options.settleMs,
        expectedMinImages: options.expectedMinImages,
        minWidth: options.minWidth,
        minHeight: options.minHeight,
      },
      stats: {
        images: serializedImages.length,
        titleCandidates: titleList.length,
        groups: groups.length,
        ungrouped: ungrouped.length,
        networkMediaKeys: networkByKey.size,
        scrollRounds: rounds,
        finalScrollHeight: finalScan?.scrollHeight ?? null,
      },
      warnings,
      titleCandidates: titleList,
      groups: groups.map((group) => ({
        title: group.title,
        top: group.top,
        images: group.images.map((image) => {
          const { observedUrls: _observedUrls, ...rest } = image;
          return rest;
        }),
      })),
      ungrouped: ungrouped.map((image) => {
        const { observedUrls: _observedUrls, ...rest } = image;
        return rest;
      }),
      images: serializedImages,
    };

    const jsonPath = path.join(options.out, "collector.json");
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const urlsPath = path.join(options.out, "direct-image-urls.txt");
    fs.writeFileSync(urlsPath, `${serializedImages.map((image) => image.directUrl).join("\n")}\n`, "utf8");
    const highQualityPath = path.join(options.out, "high-quality-image-urls.txt");
    fs.writeFileSync(highQualityPath, `${serializedImages.map((image) => image.highQualityUrl).join("\n")}\n`, "utf8");

    if (options.debug) {
      const rawTextPath = path.join(options.out, "page-text-observations.json");
      fs.writeFileSync(rawTextPath, `${JSON.stringify([...rawTexts.values()].sort((a, b) => a.top - b.top || a.left - b.left), null, 2)}\n`, "utf8");
      fs.writeFileSync(path.join(options.out, "page-final.html"), await page.content(), "utf8");
      await page.screenshot({ path: path.join(options.out, "page-final.png"), fullPage: false });
    }

    console.log(`GOOGLE_PHOTOS_COLLECTOR_OK images=${serializedImages.length} titles=${titleList.length} groups=${groups.length}`);
    console.log(`Relatorio: ${jsonPath}`);
    return report;
  } finally {
    await browser.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await collect(options);
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
