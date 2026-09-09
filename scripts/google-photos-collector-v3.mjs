import fs from 'node:fs';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const titleRe = /\b(CAMISA|CONJUNTO|KIT|SHORTS?|CORTA[ -]?VENTO|WINDBREAKER|REGATA|PLAYER|JOGADOR|TORCEDOR|FEMININ[AO]|KIDS?|INFANTIL|RET[RÔO]|TREINO|VIAGEM|GOLEIRO|BASQUETE|NBA)\b/i;
const mediaHostRe = /(^|\.)(googleusercontent\.com|usercontent\.google\.com|ggpht\.com)$/i;

function parseArgs() {
  const out = { url: '', label: '', out: '.artifacts/google-photos-collector', expected: 1, maxScrolls: 250 };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--url') out.url = a[++i];
    else if (a[i] === '--label') out.label = a[++i];
    else if (a[i] === '--out') out.out = a[++i];
    else if (a[i] === '--expected-min-images') out.expected = Number(a[++i] || 1);
    else if (a[i] === '--max-scrolls') out.maxScrolls = Number(a[++i] || 250);
  }
  if (!/^https:\/\/(photos\.google\.com|photos\.app\.goo\.gl)\//i.test(out.url)) throw new Error('URL publica do Google Photos invalida.');
  return out;
}

function isMediaUrl(raw) {
  try { const u = new URL(raw); return u.protocol === 'https:' && mediaHostRe.test(u.hostname); } catch { return false; }
}
function key(raw) {
  if (!isMediaUrl(raw)) return null;
  const u = new URL(raw);
  let p = u.pathname;
  p = p.replace(/=w\d+(?:-h\d+)?[^/?#]*/i, '').replace(/=s\d+[^/?#]*/i, '');
  return `${u.hostname.toLowerCase()}${p}`;
}
function high(raw, size = 4096) {
  if (!isMediaUrl(raw)) return raw;
  const u = new URL(raw);
  let p = u.pathname.replace(/=w\d+(?:-h\d+)?[^/?#]*/i, '').replace(/=s\d+[^/?#]*/i, '');
  u.pathname = `${p}=w${size}-h${size}-s-no-gm`;
  return u.toString();
}
function looksTitle(t) {
  t = clean(t);
  return t.length >= 5 && t.length <= 180 && titleRe.test(t) && (/\b\d{2}\s*\/\s*\d{2}\b/.test(t) || t === t.toUpperCase());
}

async function findScrollRoot(page) {
  return page.evaluate(() => {
    const all = [document.scrollingElement, ...document.querySelectorAll('*')].filter(Boolean);
    let best = document.scrollingElement;
    let score = -1;
    for (const e of all) {
      const cs = getComputedStyle(e);
      const dy = e.scrollHeight - e.clientHeight;
      if (dy < 300 || !/(auto|scroll|overlay)/.test(cs.overflowY) && e !== document.scrollingElement) continue;
      const s = dy * Math.max(1, e.clientWidth);
      if (s > score) { best = e; score = s; }
    }
    if (!best.dataset.bigCollectorId) best.dataset.bigCollectorId = `big-${Math.random().toString(36).slice(2)}`;
    return { id: best.dataset.bigCollectorId, tag: best.tagName, cls: best.className || '', h: best.scrollHeight, ch: best.clientHeight };
  });
}

async function scan(page, rootId) {
  return page.evaluate((rootId) => {
    const root = document.querySelector(`[data-big-collector-id="${rootId}"]`) || document.scrollingElement;
    const rootRect = root === document.scrollingElement ? { top: 0, left: 0 } : root.getBoundingClientRect();
    const sy = root.scrollTop || window.scrollY || 0;
    const pos = (r) => ({ top: Math.round(r.top - rootRect.top + sy), left: Math.round(r.left - rootRect.left), width: Math.round(r.width), height: Math.round(r.height) });
    const urlRe = /https:\/\/[^\s"'()<>]+/g;
    const mediaRe = /(?:googleusercontent\.com|usercontent\.google\.com|ggpht\.com)/i;
    const urls = [];
    const urlSeen = new Set();
    const add = (url, source, el, extra = {}) => {
      if (!url || !mediaRe.test(url) || urlSeen.has(url)) return;
      urlSeen.add(url);
      const r = el?.getBoundingClientRect?.() || { top: 0, left: 0, width: 0, height: 0 };
      urls.push({ url, source, ...pos(r), ...extra });
    };
    const nodes = [];
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      for (const attr of el.attributes || []) {
        if (!mediaRe.test(attr.value)) continue;
        for (const m of attr.value.match(urlRe) || []) add(m.replace(/&amp;/g, '&'), `attr:${attr.name}`, el);
      }
      for (const pseudo of [null, '::before', '::after']) {
        let bg = '';
        try { bg = getComputedStyle(el, pseudo).backgroundImage || ''; } catch {}
        if (mediaRe.test(bg)) for (const m of bg.match(urlRe) || []) add(m.replace(/["')]+$/, ''), `css${pseudo || ''}`, el);
      }
      const role = el.getAttribute('role') || '';
      const aria = el.getAttribute('aria-label') || '';
      if ((role === 'button' || el.tagName === 'A' || el.tagName === 'BUTTON') && r.width > 90 && r.height > 90) {
        nodes.push({ tag: el.tagName, role, aria, text: (el.innerText || '').trim().slice(0,120), ...pos(r), attrs: [...el.attributes].slice(0,12).reduce((o,a)=>(o[a.name]=a.value.slice(0,240),o),{}) });
      }
    }
    const texts = [];
    const seenText = new Set();
    for (const el of document.querySelectorAll('h1,h2,h3,h4,[role="heading"],div,span,p')) {
      if (el.children.length > 5) continue;
      const text = (el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
      if (text.length < 5 || text.length > 180) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 10 || r.height > 240) continue;
      const p = pos(r); const k = `${text}\0${Math.round(p.top/4)}\0${Math.round(p.left/8)}`;
      if (seenText.has(k)) continue; seenText.add(k); texts.push({ text, ...p });
    }
    const perf = performance.getEntriesByType('resource').map(e=>e.name).filter(u=>mediaRe.test(u));
    return { scrollTop: sy, scrollHeight: root.scrollHeight, clientHeight: root.clientHeight, urls, texts, nodes, perf };
  }, rootId);
}

async function run() {
  const opt = parseArgs();
  fs.mkdirSync(opt.out, { recursive: true });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, locale: 'pt-BR' });
  const page = await context.newPage();
  const network = [];
  const seenNetwork = new Set();
  const addNetwork = (url, type, contentType = '') => {
    if (!isMediaUrl(url) || seenNetwork.has(url)) return;
    seenNetwork.add(url); network.push({ url, type, contentType, order: network.length });
  };
  page.on('request', req => addNetwork(req.url(), `request:${req.resourceType()}`));
  page.on('response', async res => {
    const u = res.url(); if (!isMediaUrl(u)) return;
    let ct=''; try { ct=(await res.allHeaders())['content-type']||''; } catch {}
    addNetwork(u, 'response', ct);
  });
  await page.goto(opt.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  for (const n of ['Aceitar tudo','Aceitar','I agree','Accept all','Entendi','Continuar']) { try { const b=page.getByRole('button',{name:n,exact:false}).first(); if(await b.isVisible({timeout:150})) await b.click(); } catch {} }
  const root = await findScrollRoot(page);
  const domUrls = new Map(); const titles = new Map(); const nodeObs = []; const perfUrls = new Set();
  let idle=0, prevSig=''; let rounds=0;
  for (let i=0;i<opt.maxScrolls;i++) {
    rounds=i+1;
    const s=await scan(page,root.id);
    for(const u of s.urls){ const k=key(u.url)||u.url; if(!domUrls.has(k)) domUrls.set(k,{...u,mediaKey:k,firstRound:rounds}); }
    for(const u of s.perf) perfUrls.add(u);
    for(const t of s.texts){ if(!looksTitle(t.text)) continue; const k=`${clean(t.text)}\0${Math.round(t.top/4)}`; if(!titles.has(k)) titles.set(k,{...t,text:clean(t.text)}); }
    for(const n of s.nodes) if(nodeObs.length<5000) nodeObs.push({...n,round:rounds,scrollTop:s.scrollTop});
    const sig=`${s.scrollTop}|${s.scrollHeight}|${domUrls.size}|${network.length}|${titles.size}|${perfUrls.size}`;
    idle=sig===prevSig?idle+1:0; prevSig=sig;
    console.log(`round=${rounds} y=${s.scrollTop}/${s.scrollHeight} dom=${domUrls.size} net=${network.length} perf=${perfUrls.size} titles=${titles.size} idle=${idle}`);
    const bottom=s.scrollTop+s.clientHeight>=s.scrollHeight-16;
    if(bottom&&idle>=6) break;
    await page.evaluate(({id})=>{ const r=document.querySelector(`[data-big-collector-id="${id}"]`)||document.scrollingElement; const step=Math.max(350,Math.floor(r.clientHeight*0.72)); r.scrollTop=Math.min(r.scrollHeight-r.clientHeight,r.scrollTop+step); r.dispatchEvent(new Event('scroll',{bubbles:true})); },{id:root.id});
    await page.waitForTimeout(850);
  }
  await page.screenshot({ path:path.join(opt.out,'page-final.png'), fullPage:false });
  const all = new Map();
  for(const u of network){const k=key(u.url); if(k&&!all.has(k)) all.set(k,{mediaKey:k,directUrl:u.url,highQualityUrl:high(u.url),source:'network',order:u.order});}
  for(const u of perfUrls){const k=key(u); if(k&&!all.has(k)) all.set(k,{mediaKey:k,directUrl:u,highQualityUrl:high(u),source:'performance',order:all.size});}
  for(const u of domUrls.values()){if(!all.has(u.mediaKey)) all.set(u.mediaKey,{mediaKey:u.mediaKey,directUrl:u.url,highQualityUrl:high(u.url),source:u.source,order:all.size,top:u.top,left:u.left,width:u.width,height:u.height}); else Object.assign(all.get(u.mediaKey),{top:u.top,left:u.left,width:u.width,height:u.height,domSource:u.source});}
  const titleList=[...titles.values()].sort((a,b)=>a.top-b.top||a.left-b.left).filter((t,i,a)=>i===0||t.text!==a[i-1].text||Math.abs(t.top-a[i-1].top)>20);
  const images=[...all.values()];
  const report={schemaVersion:3,label:opt.label,sourceUrl:opt.url,resolvedUrl:page.url(),pageTitle:await page.title(),root,stats:{images:images.length,networkUrls:network.length,domUrls:domUrls.size,performanceUrls:perfUrls.size,titles:titleList.length,rounds},titleCandidates:titleList,images,network,nodeObservations:nodeObs.slice(0,2500)};
  fs.writeFileSync(path.join(opt.out,'collector.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(opt.out,'direct-image-urls.txt'),images.map(x=>x.directUrl).join('\n')+'\n');
  fs.writeFileSync(path.join(opt.out,'high-quality-image-urls.txt'),images.map(x=>x.highQualityUrl).join('\n')+'\n');
  await browser.close();
  console.log(`COLLECTOR_V3 images=${images.length} titles=${titleList.length} network=${network.length} dom=${domUrls.size} perf=${perfUrls.size}`);
  if(images.length<opt.expected) throw new Error(`Coleta incompleta: ${images.length} imagens; minimo esperado ${opt.expected}.`);
}
run().catch(e=>{console.error(e?.stack||e);process.exit(1);});
