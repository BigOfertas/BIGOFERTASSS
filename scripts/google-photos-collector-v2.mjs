import fs from "node:fs";
import path from "node:path";

const DEFAULT_OUT = ".artifacts/google-photos-collector";
const IMG_HOST = /(^|\.)googleusercontent\.com$/i;

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(message) {
  throw new Error(message);
}

export function validateAlbumUrl(raw) {
  const url = new URL(clean(raw));
  if (url.protocol !== "https:" || !["photos.google.com", "photos.app.goo.gl"].includes(url.hostname)) {
    fail("A URL precisa ser um album publico HTTPS do Google Photos.");
  }
  return url.toString();
}

export function mediaKey(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !IMG_HOST.test(url.hostname)) return null;
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/=[^/=]+(?:-[^/=]+)*$/, "")}`;
  } catch {
    return null;
  }
}

export function highQualityUrl(raw, size = 4096) {
  const key = mediaKey(raw);
  if (!key) return raw;
  const url = new URL(raw);
  url.search = "";
  url.pathname = `${url.pathname.replace(/=[^/=]+(?:-[^/=]+)*$/, "")}=w${size}-h${size}-s-no-gm`;
  return url.toString();
}

export function looksLikeTitle(value) {
  const text = clean(value);
  if (text.length < 5 || text.length > 180) return false;
  return /\b(CAMISA|CONJUNTO|KIT|SHORTS?|CORTA[ -]?VENTO|WINDBREAKER|REGATA|PLAYER|JOGADOR|TORCEDOR|FEMININ[AO]|KIDS?|INFANTIL|RET[RÔO]|TREINO|VIAGEM|GOLEIRO|BASQUETE|NBA)\b/i.test(text)
    && (/\b\d{2}\s*\/\s*\d{2}\b/.test(text) || text === text.toUpperCase());
}

function parseArgs(argv) {
  const opt = { url: "", label: "", out: DEFAULT_OUT, min: 1, maxScrolls: 350, idle: 10, wait: 800 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url") opt.url = argv[++i] ?? "";
    else if (arg === "--label") opt.label = argv[++i] ?? "";
    else if (arg === "--out") opt.out = argv[++i] ?? DEFAULT_OUT;
    else if (arg === "--expected-min-images") opt.min = Number(argv[++i] ?? 1);
    else if (arg === "--max-scrolls") opt.maxScrolls = Number(argv[++i] ?? 350);
    else if (arg === "--idle-rounds") opt.idle = Number(argv[++i] ?? 10);
    else if (arg === "--settle-ms") opt.wait = Number(argv[++i] ?? 800);
    else if (arg === "--help" || arg === "-h") {
      console.log("node scripts/google-photos-collector-v2.mjs --url <album> [--label <texto>] [--expected-min-images N]");
      process.exit(0);
    } else fail(`Opcao desconhecida: ${arg}`);
  }
  if (!opt.url) fail("Informe --url.");
  opt.url = validateAlbumUrl(opt.url);
  if (![opt.min, opt.maxScrolls, opt.idle, opt.wait].every(Number.isFinite)) fail("Opcao numerica invalida.");
  opt.out = path.resolve(opt.out);
  return opt;
}

async function scan(page) {
  return page.evaluate(() => {
    const imageHost = /(^|\.)googleusercontent\.com$/i;
    const keyOf = (raw) => {
      try {
        const u = new URL(raw);
        if (!imageHost.test(u.hostname)) return null;
        return `${u.hostname.toLowerCase()}${u.pathname.replace(/=[^/=]+(?:-[^/=]+)*$/, "")}`;
      } catch { return null; }
    };
    const chooseRoot = () => {
      const roots = [document.scrollingElement, ...document.querySelectorAll("main,section,div,c-wiz")].filter(Boolean);
      let best = document.scrollingElement || document.documentElement;
      let bestScore = -1;
      for (const el of roots) {
        const delta = el.scrollHeight - el.clientHeight;
        if (el.clientHeight < 250 || delta < 80) continue;
        const overflow = getComputedStyle(el).overflowY;
        const scrollable = /auto|scroll|overlay/.test(overflow);
        const score = delta + (scrollable ? 1e7 : 0) + el.clientHeight;
        if (score > bestScore) { best = el; bestScore = score; }
      }
      return best;
    };
    const root = chooseRoot();
    const docRoot = root === document.scrollingElement || root === document.documentElement || root === document.body;
    const rr = docRoot ? { top: 0, left: 0, bottom: innerHeight } : root.getBoundingClientRect();
    const scrollTop = docRoot ? scrollY : root.scrollTop;
    const scrollLeft = docRoot ? scrollX : root.scrollLeft;
    const viewportH = docRoot ? innerHeight : root.clientHeight;
    const visible = (r) => r.bottom >= rr.top - viewportH && r.top <= rr.bottom + viewportH;
    const topOf = (r) => Math.round(r.top - rr.top + scrollTop);
    const leftOf = (r) => Math.round(r.left - rr.left + scrollLeft);
    const images = [];
    const seen = new Set();
    for (const img of document.querySelectorAll("img")) {
      const r = img.getBoundingClientRect();
      if (r.width < 100 || r.height < 100 || !visible(r)) continue;
      const urls = [img.currentSrc || img.src, ...(img.getAttribute("srcset") || "").split(",").map(x => x.trim().split(/\s+/)[0])];
      for (const url of urls) {
        const key = keyOf(url);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        images.push({ key, url, top: topOf(r), left: leftOf(r), width: Math.round(r.width), height: Math.round(r.height), alt: (img.alt || "").trim() });
      }
    }
    const texts = [];
    const tSeen = new Set();
    for (const el of document.querySelectorAll("h1,h2,h3,h4,[role='heading'],div,span,p")) {
      if (el.children.length > 4) continue;
      const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 5 || text.length > 180) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 10 || r.height > 220 || !visible(r)) continue;
      const item = { text, top: topOf(r), left: leftOf(r), width: Math.round(r.width), height: Math.round(r.height) };
      const k = `${text}\u0000${Math.round(item.top/4)}\u0000${Math.round(item.left/8)}`;
      if (!tSeen.has(k)) { tSeen.add(k); texts.push(item); }
    }
    return {
      images, texts,
      scrollTop: Math.round(scrollTop),
      scrollHeight: Math.round(root.scrollHeight),
      viewportH: Math.round(viewportH),
      atBottom: scrollTop + viewportH >= root.scrollHeight - 12,
      rootTag: docRoot ? "document" : `${root.tagName.toLowerCase()}${root.id ? `#${root.id}` : ""}`,
      pageTitle: document.title,
    };
  });
}

async function scrollTo(page, y) {
  await page.evaluate((target) => {
    const roots = [document.scrollingElement, ...document.querySelectorAll("main,section,div,c-wiz")].filter(Boolean);
    let best = document.scrollingElement || document.documentElement;
    let bestScore = -1;
    for (const el of roots) {
      const delta = el.scrollHeight - el.clientHeight;
      if (el.clientHeight < 250 || delta < 80) continue;
      const scrollable = /auto|scroll|overlay/.test(getComputedStyle(el).overflowY);
      const score = delta + (scrollable ? 1e7 : 0) + el.clientHeight;
      if (score > bestScore) { best = el; bestScore = score; }
    }
    const docRoot = best === document.scrollingElement || best === document.documentElement || best === document.body;
    if (docRoot) window.scrollTo(0, target); else best.scrollTo(0, target);
  }, y);
}

function bestDirect(image, network) {
  const urls = new Set([image.url, ...(network.get(image.key) || [])]);
  return [...urls].sort((a, b) => {
    const size = (u) => Math.max(0, ...[...u.matchAll(/(?:^|[-=])(?:w|h)(\d{2,5})(?=$|-)/g)].map(m => Number(m[1])));
    return size(b) - size(a) || b.length - a.length;
  })[0];
}

function groupByTitles(images, titles) {
  const groups = [];
  const map = new Map();
  for (const image of images) {
    const title = titles.filter(t => t.top <= image.top + 20).at(-1);
    if (!title) continue;
    const k = `${title.text}\u0000${title.top}`;
    if (!map.has(k)) { const g = { title: title.text, top: title.top, images: [] }; map.set(k, g); groups.push(g); }
    map.get(k).images.push(image);
  }
  return groups;
}

async function run(opt) {
  fs.mkdirSync(opt.out, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, locale: "pt-BR" });
  const page = await context.newPage();
  const network = new Map();
  page.on("response", (r) => {
    const k = mediaKey(r.url());
    if (!k) return;
    if (!network.has(k)) network.set(k, new Set());
    network.get(k).add(r.url());
  });
  const imageMap = new Map();
  const titleMap = new Map();
  const rawTextMap = new Map();
  let rounds = 0, idle = 0, lastCount = 0, lastHeight = 0, lastScan = null;
  try {
    await page.goto(opt.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(1800);
    await scrollTo(page, 0);
    await sleep(400);
    while (rounds < opt.maxScrolls) {
      rounds += 1;
      const s = await scan(page); lastScan = s;
      for (const img of s.images) {
        const prev = imageMap.get(img.key);
        if (!prev || img.top < prev.top || (img.top === prev.top && img.left < prev.left)) imageMap.set(img.key, img);
      }
      for (const t of s.texts) {
        rawTextMap.set(`${t.text}\u0000${Math.round(t.top/4)}\u0000${Math.round(t.left/8)}`, t);
        if (looksLikeTitle(t.text)) titleMap.set(`${t.text}\u0000${Math.round(t.top/4)}`, t);
      }
      const changed = imageMap.size > lastCount || s.scrollHeight > lastHeight + 4;
      idle = changed ? 0 : idle + 1;
      lastCount = imageMap.size; lastHeight = Math.max(lastHeight, s.scrollHeight);
      console.log(`round=${rounds} root=${s.rootTag} y=${s.scrollTop}/${s.scrollHeight} images=${imageMap.size} titles=${titleMap.size} idle=${idle} bottom=${s.atBottom}`);
      if (s.atBottom && idle >= opt.idle) break;
      const step = Math.max(600, Math.floor(s.viewportH * 0.78));
      await scrollTo(page, Math.min(s.scrollTop + step, Math.max(0, s.scrollHeight - s.viewportH)));
      await sleep(opt.wait);
    }
    if (lastScan) { await scrollTo(page, lastScan.scrollHeight); await sleep(opt.wait); }
    const tail = await scan(page);
    for (const img of tail.images) if (!imageMap.has(img.key)) imageMap.set(img.key, img);
    for (const t of tail.texts) if (looksLikeTitle(t.text)) titleMap.set(`${t.text}\u0000${Math.round(t.top/4)}`, t);

    const images = [...imageMap.values()].sort((a,b) => a.top-b.top || a.left-b.left).map((img, i) => {
      const directUrl = bestDirect(img, network);
      return { index: i+1, mediaKey: img.key, directUrl, highQualityUrl: highQualityUrl(directUrl), top: img.top, left: img.left, width: img.width, height: img.height, alt: img.alt || null };
    });
    const titles = [...titleMap.values()].sort((a,b) => a.top-b.top || a.left-b.left);
    const groups = groupByTitles(images, titles);
    const groupedKeys = new Set(groups.flatMap(g => g.images.map(i => i.mediaKey)));
    const ungrouped = images.filter(i => !groupedKeys.has(i.mediaKey));
    const report = {
      schemaVersion: 2, collector: "BIGofertas Google Photos Collector", label: clean(opt.label) || null,
      sourceUrl: opt.url, resolvedUrl: page.url(), pageTitle: await page.title(), completedAt: new Date().toISOString(),
      stats: { images: images.length, titleCandidates: titles.length, groups: groups.length, ungrouped: ungrouped.length, scrollRounds: rounds, scrollRoot: tail.rootTag, scrollHeight: tail.scrollHeight },
      warnings: [], titleCandidates: titles, groups, ungrouped, images,
    };
    if (!titles.length) report.warnings.push("Nenhum titulo foi reconhecido automaticamente; os prints devem ser usados como gabarito.");
    if (ungrouped.length) report.warnings.push(`${ungrouped.length} imagens sem agrupamento automatico.`);
    fs.writeFileSync(path.join(opt.out, "collector.json"), JSON.stringify(report, null, 2) + "\n");
    fs.writeFileSync(path.join(opt.out, "direct-image-urls.txt"), images.map(i => i.directUrl).join("\n") + "\n");
    fs.writeFileSync(path.join(opt.out, "high-quality-image-urls.txt"), images.map(i => i.highQualityUrl).join("\n") + "\n");
    fs.writeFileSync(path.join(opt.out, "page-text-observations.json"), JSON.stringify([...rawTextMap.values()].sort((a,b)=>a.top-b.top||a.left-b.left), null, 2) + "\n");
    await page.screenshot({ path: path.join(opt.out, "page-final.png"), fullPage: false });
    if (images.length < opt.min) fail(`Coleta incompleta: ${images.length} imagens; minimo esperado ${opt.min}.`);
    console.log(`GOOGLE_PHOTOS_COLLECTOR_OK images=${images.length} titles=${titles.length} groups=${groups.length}`);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === new URL(`file://${path.resolve(process.argv[1] || "")}`).href) {
  run(parseArgs(process.argv.slice(2))).catch((e) => { console.error(e.stack || e.message || String(e)); process.exit(1); });
}
