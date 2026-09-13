import fs from "node:fs";
import { chromium } from "playwright";

const BASE = "https://bigofertas.net";
const SHA = "f16b3f04083756f64b10b0bae4cb78660c69bc79";
const TITLES = ["LANÇAMENTOS", "MONTE SEU PEDIDO", "ENCONTRE SEU TIME", "COMPRE POR LIGA", "PERGUNTAS FREQUENTES"];
const VIEWPORTS = [["desktop-1440",1440,1100],["tablet-768",768,1024],["mobile-390",390,844]];
const OUT = "qa-final-f16b";
fs.mkdirSync(OUT, { recursive: true });

const canonical = (v) => String(v ?? "").replace(/\u00a0/g," ").replace(/\s+/g," ").trim().toLocaleUpperCase("pt-BR");
const slug = (v) => canonical(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const report = { sha: SHA, startedAt: new Date().toISOString(), headings: {}, reducedMotion: {}, routes: {}, runtime: [], failures: [] };
const fail = (message, details = null) => report.failures.push({ message, ...(details === null ? {} : { details }) });

function watch(page, label) {
  page.on("pageerror", (error) => { report.runtime.push({label,type:"pageerror",message:error.message}); fail(`Runtime error em ${label}`, error.message); });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const message = msg.text();
    report.runtime.push({label,type:"console.error",message});
    if (/\b(?:Uncaught|TypeError|ReferenceError|SyntaxError|RangeError)\b/i.test(message)) fail(`Console runtime error em ${label}`, message);
  });
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function findRoot(page, expected) {
  const roots = page.locator("[data-slide-up-reveal]");
  const matches = [];
  for (let i=0;i<await roots.count();i+=1) {
    const text = await roots.nth(i).locator(".sr-only").first().textContent().catch(()=>"");
    if (canonical(text) === expected) matches.push(i);
  }
  return { roots, matches };
}

async function metric(root, expected) {
  return root.evaluate((node, expectedUpper) => {
    const canon = (v) => String(v ?? "").replace(/\u00a0/g," ").replace(/\s+/g," ").trim().toLocaleUpperCase("pt-BR");
    const wrappers = [...node.querySelectorAll("[data-slide-character]")];
    const chars = wrappers.map((w)=>w.firstElementChild).filter((el)=>el instanceof HTMLElement);
    const words = [...node.querySelectorAll("[data-slide-word]")];
    const clipping = [];
    const rows = chars.map((el,index)=>{
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      let parent = el.parentElement;
      const clippedBy = [];
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const ps = getComputedStyle(parent);
        if (["hidden","clip"].includes(ps.overflowX) || ["hidden","clip"].includes(ps.overflowY)) {
          const pr = parent.getBoundingClientRect();
          const x = ["hidden","clip"].includes(ps.overflowX) && (rect.left < pr.left - 1 || rect.right > pr.right + 1);
          const y = ["hidden","clip"].includes(ps.overflowY) && (rect.top < pr.top - 1 || rect.bottom > pr.bottom + 1);
          if (x || y) clippedBy.push({tag:parent.tagName,className:String(parent.className||"").slice(0,140),overflowX:ps.overflowX,overflowY:ps.overflowY,x,y});
        }
        parent = parent.parentElement;
      }
      if (clippedBy.length) clipping.push({index,char:el.textContent,clippedBy});
      return {char:el.textContent,charUpper:canon(el.textContent),opacity:Number.parseFloat(style.opacity),transform:style.transform,transitionProperty:style.transitionProperty,transitionDuration:style.transitionDuration,transitionDelay:style.transitionDelay,fontStyle:style.fontStyle,rect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height}};
    });
    const rs = getComputedStyle(node);
    const visualSpaces = words.reduce((sum,word)=>{ const last=word.lastElementChild; return sum + (last && !last.matches("[data-slide-character]") && last.textContent?.includes("\u00a0") ? 1 : 0); },0);
    return {
      expected: expectedUpper,
      sourceText: node.querySelector(".sr-only")?.textContent ?? "",
      canonicalText: canon(node.querySelector(".sr-only")?.textContent ?? ""),
      charCount: wrappers.length,
      visualSpaces,
      wordCount: words.length,
      rootOverflowX: rs.overflowX,
      rootOverflowY: rs.overflowY,
      first: rows[0] ?? null,
      last: rows.at(-1) ?? null,
      cedilla: rows.find((row)=>row.charUpper === "Ç") ?? null,
      rows,
      distinctDelays: new Set(rows.map((row)=>row.transitionDelay)).size,
      clipping,
      horizontalScroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      viewportWidth: window.innerWidth,
    };
  }, expected);
}

function geometryChecks(result, expected, viewport, phase) {
  const expectedChars = Array.from(expected.replace(/ /g,"")).length;
  const expectedSpaces = (expected.match(/ /g)||[]).length;
  if (result.canonicalText !== expected) fail(`${expected}: texto divergente ${viewport}/${phase}`, result.sourceText);
  if (result.charCount !== expectedChars) fail(`${expected}: caracteres duplicados/faltando ${viewport}/${phase}`, {actual:result.charCount,expected:expectedChars});
  if (result.visualSpaces !== expectedSpaces) fail(`${expected}: espaços divergentes ${viewport}/${phase}`, {actual:result.visualSpaces,expected:expectedSpaces});
  if (result.clipping.length) fail(`${expected}: clipping ${viewport}/${phase}`, result.clipping);
  if (result.horizontalScroll > 1) fail(`${expected}: scroll horizontal ${viewport}/${phase}`, result.horizontalScroll);
  if (result.rootOverflowX !== "visible" || result.rootOverflowY !== "visible") fail(`${expected}: root overflow incorreto ${viewport}/${phase}`, {x:result.rootOverflowX,y:result.rootOverflowY});
  if (!result.first || result.first.rect.width <= 0 || !result.last || result.last.rect.width <= 0) fail(`${expected}: primeira/última letra inválida ${viewport}/${phase}`);
  if (expected.includes("Ç") && (!result.cedilla || result.cedilla.rect.width <= 0 || result.cedilla.rect.height <= 0)) fail(`${expected}: Ç inválido ${viewport}/${phase}`);
  if (result.first && (result.first.rect.left < -1 || result.first.rect.right > result.viewportWidth + 1)) fail(`${expected}: primeira letra fora do viewport ${viewport}/${phase}`, result.first.rect);
  if (result.last && (result.last.rect.left < -1 || result.last.rect.right > result.viewportWidth + 1)) fail(`${expected}: última letra fora do viewport ${viewport}/${phase}`, result.last.rect);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const [name,width,height] of VIEWPORTS) {
    const context = await browser.newContext({ viewport:{width,height}, locale:"pt-BR" });
    const page = await context.newPage();
    watch(page, `home-${name}`);
    const response = await page.goto(`${BASE}/?qa=final-${SHA.slice(0,10)}-${width}`, { waitUntil:"domcontentloaded", timeout:30000 });
    if (!response?.ok()) fail(`Homepage HTTP inválido ${name}`, response?.status() ?? null);
    await settle(page);
    const initialScroll = await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
    if (initialScroll > 1) fail(`Homepage scroll horizontal inicial ${name}`, initialScroll);
    report.headings[name] = {};

    for (const expected of TITLES) {
      const {roots,matches} = await findRoot(page, expected);
      if (matches.length !== 1) { fail(`${expected}: deve existir uma única animação em ${name}`, matches); report.headings[name][expected]={matches}; continue; }
      const root = roots.nth(matches[0]);
      const before = await metric(root, expected);
      await root.evaluate((el)=>el.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"}));
      await page.waitForTimeout(100);
      const during = await metric(root, expected);
      geometryChecks(during, expected, name, "during");
      if (during.charCount > 1 && during.distinctDelays < 2) fail(`${expected}: stagger por letra ausente ${name}`, during.distinctDelays);
      if (!during.rows.every((row)=>row.transitionProperty.includes("transform") && row.transitionProperty.includes("opacity"))) fail(`${expected}: transição por letra ausente durante animação ${name}`);
      await page.screenshot({path:`${OUT}/${name}-${slug(expected)}-during.png`});
      await page.waitForTimeout(1800);
      const after = await metric(root, expected);
      geometryChecks(after, expected, name, "after");
      const important = [after.first,after.last,after.cedilla].filter(Boolean);
      if (!important.every((row)=>row.opacity >= 0.99 && (row.transform === "none" || row.transform === "matrix(1, 0, 0, 1, 0, 0)"))) fail(`${expected}: animação não terminou limpa ${name}`, important);
      if (!after.rows.every((row)=>row.transitionProperty === "none")) fail(`${expected}: transição residual após conclusão ${name}`, after.rows.slice(0,4));
      await page.screenshot({path:`${OUT}/${name}-${slug(expected)}-after.png`});
      report.headings[name][expected] = {matches,before,during,after};
    }
    const finalScroll = await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
    if (finalScroll > 1) fail(`Homepage scroll horizontal final ${name}`, finalScroll);
    await page.screenshot({path:`${OUT}/${name}-home-full.png`,fullPage:true});
    await context.close();
  }

  const reduced = await browser.newContext({ viewport:{width:390,height:844}, locale:"pt-BR", reducedMotion:"reduce" });
  const rp = await reduced.newPage();
  watch(rp,"home-reduced-motion");
  const rr = await rp.goto(`${BASE}/?qa=final-reduced-${SHA.slice(0,10)}`, {waitUntil:"domcontentloaded",timeout:30000});
  if (!rr?.ok()) fail("Homepage reduced-motion HTTP inválido", rr?.status() ?? null);
  await settle(rp);
  for (const expected of TITLES) {
    const {roots,matches}=await findRoot(rp,expected);
    if (matches.length !== 1) { fail(`${expected}: reveal reduced-motion não é único`,matches); continue; }
    const root=roots.nth(matches[0]);
    await root.evaluate((el)=>el.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"}));
    await rp.waitForTimeout(80);
    const result=await metric(root,expected);
    geometryChecks(result,expected,"mobile-390","reduced");
    const ok=result.rows.every((row)=>row.opacity>=0.99 && (row.transform==="none" || row.transform==="matrix(1, 0, 0, 1, 0, 0)") && row.transitionProperty==="none" && (row.transitionDuration==="0s" || row.transitionDuration==="0ms"));
    if (!ok) fail(`${expected}: reduced-motion ainda possui movimento/transição`,result.rows.slice(0,6));
    report.reducedMotion[expected]={ok,result};
  }
  await rp.screenshot({path:`${OUT}/mobile-390-reduced-motion.png`,fullPage:true});
  await reduced.close();

  const rc=await browser.newContext({viewport:{width:390,height:844},locale:"pt-BR"});
  for (const path of ["/","/products","/login","/cadastro","/cart","/admin"]) {
    const page=await rc.newPage(); watch(page,`route-${path}`);
    const response=await page.goto(`${BASE}${path}?qa=final-${SHA.slice(0,8)}`,{waitUntil:"domcontentloaded",timeout:30000});
    await settle(page);
    const text=await page.locator("body").innerText().catch(()=>"");
    const horizontalScroll=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth);
    const item={status:response?.status()??null,finalUrl:page.url(),bodyTextLength:text.trim().length,horizontalScroll}; report.routes[path]=item;
    if(!response || response.status()>=400) fail(`${path}: HTTP inválido`,item);
    if(item.bodyTextLength<20) fail(`${path}: página vazia`,item);
    if(horizontalScroll>1) fail(`${path}: scroll horizontal 390px`,horizontalScroll);
    if(path==="/admin" && !/\/login(?:\?|$)/.test(page.url())) fail("/admin: visitante não redirecionado ao login",item);
    await page.screenshot({path:`${OUT}/route-${slug(path)||"home"}.png`}); await page.close();
  }
  await rc.close();
} finally { await browser.close(); }

report.finishedAt=new Date().toISOString();
fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log("FINAL_PRODUCTION_QA");
console.log(JSON.stringify({sha:SHA,failures:report.failures,runtime:report.runtime,routes:report.routes},null,2));
if(report.failures.length) process.exit(1);
console.log("Final production browser QA passed.");
