import fs from 'node:fs';
import path from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const titleRe = /\b(CAMISA|CONJUNTO|KIT|SHORTS?|CORTA[ -]?VENTO|WINDBREAKER|REGATA|PLAYER|JOGADOR|TORCEDOR|FEMININ[AO]|KIDS?|INFANTIL|RET[RÔO]|TREINO|VIAGEM|GOLEIRO|BASQUETE|NBA)\b/i;
const mediaHostRe = /(^|\.)(googleusercontent\.com|usercontent\.google\.com|ggpht\.com)$/i;

function parseArgs() {
  const out = {
    url: '',
    label: '',
    out: '.artifacts/google-photos-collector',
    expected: 1,
    maxScrolls: 350,
  };
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--url') out.url = args[++index];
    else if (args[index] === '--label') out.label = args[++index];
    else if (args[index] === '--out') out.out = args[++index];
    else if (args[index] === '--expected-min-images') out.expected = Number(args[++index] || 1);
    else if (args[index] === '--max-scrolls') out.maxScrolls = Number(args[++index] || 350);
  }
  if (!/^https:\/\/(photos\.google\.com|photos\.app\.goo\.gl)\//i.test(out.url)) {
    throw new Error('URL publica do Google Photos invalida.');
  }
  if (!Number.isFinite(out.expected) || out.expected < 1) throw new Error('expected-min-images invalido.');
  if (!Number.isFinite(out.maxScrolls) || out.maxScrolls < 1) throw new Error('max-scrolls invalido.');
  return out;
}

function isMediaUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && mediaHostRe.test(url.hostname);
  } catch {
    return false;
  }
}

function mediaKey(raw) {
  if (!isMediaUrl(raw)) return null;
  const url = new URL(raw);
  const pathname = url.pathname
    .replace(/=w\d+(?:-h\d+)?[^/?#]*/i, '')
    .replace(/=s\d+[^/?#]*/i, '');
  return `${url.hostname.toLowerCase()}${pathname}`;
}

function highQualityUrl(raw, size = 4096) {
  if (!isMediaUrl(raw)) return raw;
  const url = new URL(raw);
  const pathname = url.pathname
    .replace(/=w\d+(?:-h\d+)?[^/?#]*/i, '')
    .replace(/=s\d+[^/?#]*/i, '');
  url.pathname = `${pathname}=w${size}-h${size}-s-no-gm`;
  return url.toString();
}

function looksLikeCatalogTitle(raw) {
  const text = clean(raw);
  return (
    text.length >= 5 &&
    text.length <= 180 &&
    titleRe.test(text) &&
    (/\b\d{2}\s*\/\s*\d{2}\b/.test(text) || text === text.toUpperCase())
  );
}

function dedupeTitles(titles) {
  const sorted = [...titles].sort((a, b) => a.top - b.top || a.left - b.left);
  const result = [];
  for (const title of sorted) {
    const previous = result.at(-1);
    if (previous && previous.text === title.text && Math.abs(previous.top - title.top) <= 96) continue;
    result.push(title);
  }
  return result;
}

function groupProductImages(images, titles) {
  const sortedImages = [...images].sort((a, b) => a.top - b.top || a.left - b.left);
  const groups = titles.map((title, index) => ({ index: index + 1, title: title.text, top: title.top, images: [] }));
  const ungrouped = [];
  for (const image of sortedImages) {
    let chosen = -1;
    for (let index = 0; index < titles.length; index += 1) {
      if (titles[index].top <= image.top + 20) chosen = index;
      else break;
    }
    if (chosen < 0) ungrouped.push(image);
    else groups[chosen].images.push(image);
  }
  return { groups: groups.filter((group) => group.images.length > 0), ungrouped };
}

async function findScrollRoot(page) {
  return page.evaluate(() => {
    const candidates = [document.scrollingElement, ...document.querySelectorAll('*')].filter(Boolean);
    let best = document.scrollingElement;
    let bestScore = -1;
    for (const element of candidates) {
      const style = getComputedStyle(element);
      const delta = element.scrollHeight - element.clientHeight;
      if (delta < 300) continue;
      if (element !== document.scrollingElement && !/(auto|scroll|overlay)/.test(style.overflowY)) continue;
      const score = delta * Math.max(1, element.clientWidth);
      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    }
    if (!best.dataset.bigCollectorId) best.dataset.bigCollectorId = `big-${Math.random().toString(36).slice(2)}`;
    return {
      id: best.dataset.bigCollectorId,
      tag: best.tagName,
      className: best.className || '',
      scrollHeight: best.scrollHeight,
      clientHeight: best.clientHeight,
    };
  });
}

async function scan(page, rootId) {
  return page.evaluate((id) => {
    const root = document.querySelector(`[data-big-collector-id="${id}"]`) || document.scrollingElement;
    const rootRect = root === document.scrollingElement ? { top: 0, left: 0 } : root.getBoundingClientRect();
    const scrollTop = root.scrollTop || window.scrollY || 0;
    const position = (rect) => ({
      top: Math.round(rect.top - rootRect.top + scrollTop),
      left: Math.round(rect.left - rootRect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
    const urlRe = /https:\/\/[^\s"'()<>]+/g;
    const mediaRe = /(?:googleusercontent\.com|usercontent\.google\.com|ggpht\.com)/i;
    const urls = [];
    const seenUrls = new Set();
    const addUrl = (url, source, element) => {
      if (!url || !mediaRe.test(url) || seenUrls.has(url)) return;
      seenUrls.add(url);
      const rect = element?.getBoundingClientRect?.() || { top: 0, left: 0, width: 0, height: 0 };
      urls.push({ url, source, ...position(rect) });
    };

    for (const element of document.querySelectorAll('*')) {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      for (const attribute of element.attributes || []) {
        if (!mediaRe.test(attribute.value)) continue;
        for (const match of attribute.value.match(urlRe) || []) addUrl(match.replace(/&amp;/g, '&'), `attr:${attribute.name}`, element);
      }
      for (const pseudo of [null, '::before', '::after']) {
        let background = '';
        try {
          background = getComputedStyle(element, pseudo).backgroundImage || '';
        } catch {
          background = '';
        }
        if (!mediaRe.test(background)) continue;
        for (const match of background.match(urlRe) || []) addUrl(match.replace(/["')]+$/, ''), `css${pseudo || ''}`, element);
      }
    }

    const texts = [];
    const seenTexts = new Set();
    for (const element of document.querySelectorAll('h1,h2,h3,h4,[role="heading"],div,span,p')) {
      if (element.children.length > 5) continue;
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 5 || text.length > 180) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10 || rect.height > 240) continue;
      const pos = position(rect);
      const key = `${text}\u0000${Math.round(pos.top / 4)}\u0000${Math.round(pos.left / 8)}`;
      if (seenTexts.has(key)) continue;
      seenTexts.add(key);
      texts.push({ text, ...pos });
    }

    const performanceUrls = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => mediaRe.test(url));

    return {
      scrollTop,
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
      urls,
      texts,
      performanceUrls,
    };
  }, rootId);
}

async function run() {
  const options = parseArgs();
  fs.mkdirSync(options.out, { recursive: true });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, locale: 'pt-BR' });
  const page = await context.newPage();

  const networkUrls = [];
  const seenNetworkUrls = new Set();
  const addNetworkUrl = (url, resourceType) => {
    if (!isMediaUrl(url) || seenNetworkUrls.has(url)) return;
    seenNetworkUrls.add(url);
    networkUrls.push({ url, resourceType, order: networkUrls.length });
  };
  page.on('request', (request) => addNetworkUrl(request.url(), request.resourceType()));

  await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  for (const label of ['Aceitar tudo', 'Aceitar', 'I agree', 'Accept all', 'Entendi', 'Continuar']) {
    try {
      const button = page.getByRole('button', { name: label, exact: false }).first();
      if (await button.isVisible({ timeout: 150 })) await button.click();
    } catch {
      // Overlay ausente.
    }
  }

  const scrollRoot = await findScrollRoot(page);
  const domUrls = new Map();
  const titleObservations = new Map();
  const performanceUrls = new Set();
  let idleRounds = 0;
  let previousSignature = '';
  let rounds = 0;

  for (let index = 0; index < options.maxScrolls; index += 1) {
    rounds = index + 1;
    const observation = await scan(page, scrollRoot.id);
    for (const item of observation.urls) {
      const key = mediaKey(item.url) || item.url;
      if (!domUrls.has(key)) domUrls.set(key, { ...item, mediaKey: key, firstRound: rounds });
    }
    for (const url of observation.performanceUrls) performanceUrls.add(url);
    for (const item of observation.texts) {
      if (!looksLikeCatalogTitle(item.text)) continue;
      const text = clean(item.text);
      const key = `${text}\u0000${Math.round(item.top / 4)}`;
      if (!titleObservations.has(key)) titleObservations.set(key, { ...item, text });
    }

    const signature = `${observation.scrollTop}|${observation.scrollHeight}|${domUrls.size}|${networkUrls.length}|${titleObservations.size}|${performanceUrls.size}`;
    idleRounds = signature === previousSignature ? idleRounds + 1 : 0;
    previousSignature = signature;
    console.log(`round=${rounds} y=${observation.scrollTop}/${observation.scrollHeight} dom=${domUrls.size} net=${networkUrls.length} perf=${performanceUrls.size} titles=${titleObservations.size} idle=${idleRounds}`);

    const atBottom = observation.scrollTop + observation.clientHeight >= observation.scrollHeight - 16;
    if (atBottom && idleRounds >= 6) break;
    await page.evaluate(({ id }) => {
      const root = document.querySelector(`[data-big-collector-id="${id}"]`) || document.scrollingElement;
      const step = Math.max(350, Math.floor(root.clientHeight * 0.72));
      root.scrollTop = Math.min(root.scrollHeight - root.clientHeight, root.scrollTop + step);
      root.dispatchEvent(new Event('scroll', { bubbles: true }));
    }, { id: scrollRoot.id });
    await page.waitForTimeout(850);
  }

  await page.screenshot({ path: path.join(options.out, 'page-final.png'), fullPage: false });

  const allMedia = new Map();
  for (const item of networkUrls) {
    const key = mediaKey(item.url);
    if (key && !allMedia.has(key)) {
      allMedia.set(key, { mediaKey: key, directUrl: item.url, highQualityUrl: highQualityUrl(item.url), source: 'network', order: item.order });
    }
  }
  for (const url of performanceUrls) {
    const key = mediaKey(url);
    if (key && !allMedia.has(key)) {
      allMedia.set(key, { mediaKey: key, directUrl: url, highQualityUrl: highQualityUrl(url), source: 'performance', order: allMedia.size });
    }
  }
  for (const item of domUrls.values()) {
    if (!allMedia.has(item.mediaKey)) {
      allMedia.set(item.mediaKey, {
        mediaKey: item.mediaKey,
        directUrl: item.url,
        highQualityUrl: highQualityUrl(item.url),
        source: item.source,
        order: allMedia.size,
      });
    }
    Object.assign(allMedia.get(item.mediaKey), {
      top: item.top,
      left: item.left,
      width: item.width,
      height: item.height,
      domSource: item.source,
    });
  }

  const titles = dedupeTitles([...titleObservations.values()]);
  const firstTitleTop = titles[0]?.top ?? Number.POSITIVE_INFINITY;
  const productImages = [...allMedia.values()]
    .filter((item) => Number.isFinite(item.top) && item.top >= firstTitleTop && item.width >= 120 && item.height >= 120)
    .sort((a, b) => a.top - b.top || a.left - b.left)
    .map((item, index) => ({ ...item, index: index + 1 }));

  const { groups, ungrouped } = groupProductImages(productImages, titles);
  const report = {
    schemaVersion: 4,
    collector: 'BIGofertas Google Photos Catalog Collector',
    label: options.label || null,
    sourceUrl: options.url,
    resolvedUrl: page.url(),
    pageTitle: await page.title(),
    completedAt: new Date().toISOString(),
    scrollRoot,
    stats: {
      productImages: productImages.length,
      mediaObserved: allMedia.size,
      networkUrls: networkUrls.length,
      domUrls: domUrls.size,
      performanceUrls: performanceUrls.size,
      titles: titles.length,
      groups: groups.length,
      ungrouped: ungrouped.length,
      rounds,
    },
    titleCandidates: titles,
    groups,
    ungrouped,
    images: productImages,
    allMedia: [...allMedia.values()],
  };

  fs.writeFileSync(path.join(options.out, 'collector.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(options.out, 'direct-image-urls.txt'), `${productImages.map((item) => item.directUrl).join('\n')}\n`);
  fs.writeFileSync(path.join(options.out, 'high-quality-image-urls.txt'), `${productImages.map((item) => item.highQualityUrl).join('\n')}\n`);
  fs.writeFileSync(
    path.join(options.out, 'groups.json'),
    JSON.stringify(groups.map((group) => ({ title: group.title, images: group.images.map((image) => image.highQualityUrl) })), null, 2),
  );

  await browser.close();
  console.log(`COLLECTOR_FINAL productImages=${productImages.length} titles=${titles.length} groups=${groups.length} ungrouped=${ungrouped.length} mediaObserved=${allMedia.size}`);
  for (const group of groups) console.log(`GROUP ${group.index}: ${group.title} -> ${group.images.length} imagens`);

  if (productImages.length < options.expected) {
    throw new Error(`Coleta incompleta: ${productImages.length} imagens de produto; minimo esperado ${options.expected}.`);
  }
  if (ungrouped.length > 0) throw new Error(`Coleta ambigua: ${ungrouped.length} imagens ficaram sem titulo.`);
}

run().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
