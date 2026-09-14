import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const OUTPUT = path.join(ROOT, "src/i18n/generated");
const targets = ["en", "es", "fr", "de", "it", "nl", "ja", "ko", "zh-CN", "ar"];
const outputCodes = ["en", "es", "fr", "de", "it", "nl", "ja", "ko", "zh", "ar"];

const portugueseHint = /(?:[áàâãéêíóôõúç]|\b(?:a|as|o|os|de|da|das|do|dos|em|para|por|com|sem|não|sim|seu|sua|seus|suas|meu|minha|produto|produtos|pedido|pedidos|carrinho|compra|comprar|adicionar|remover|salvar|cancelar|confirmar|buscar|selecione|selecione|escolha|endereço|telefone|senha|conta|entrega|frete|pagamento|tamanho|guia|afiliado|afiliados|comissão|saque|receita|custo|lucro|margem|categoria|campeonato|temporada|marca|time|início|detalhes|disponível|indisponível|carregando|erro|sucesso|voltar|continuar|finalizar|copiar|compartilhar|produção|envio|trocas|devoluções|privacidade|termos|perguntas|frequentes)\b)/iu;

const ignoredPropertyNames = new Set([
  "className", "class", "id", "key", "type", "role", "href", "to", "rel", "target", "name",
  "value", "variant", "side", "align", "method", "action", "scope", "kind", "slug", "path",
  "table", "schema", "column", "event", "queryKey", "storageKey", "property", "contentType",
]);

function looksTechnical(value) {
  const text = value.trim();
  if (text.length < 2 || text.length > 420) return true;
  if (/^(?:https?:|\/|\.\/|\.\.\/|@\/|[a-z0-9_.-]+\.(?:tsx?|jsx?|css|json|mjs|png|webp|svg))/.test(text)) return true;
  if (/^[a-z0-9_.:/-]+$/i.test(text) && !/\s/.test(text)) return true;
  if (/(?:bg-|text-|border-|rounded-|px-|py-|mx-|my-|flex|grid|hover:|focus:|sm:|md:|lg:|xl:|w-|h-)/.test(text)) return true;
  if (text.includes("SELECT ") || text.includes("CREATE ") || text.includes("ALTER ")) return true;
  return false;
}

function keep(value) {
  const text = value.replace(/\s+/g, " ").trim();
  return !looksTechnical(text) && portugueseHint.test(text);
}

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["i18n", "generated"].includes(entry.name)) continue;
      out.push(...(await walk(full)));
    } else if (/\.(?:ts|tsx)$/.test(entry.name) && entry.name !== "routeTree.gen.ts") {
      out.push(full);
    }
  }
  return out;
}

function extractFromFile(file, source) {
  const phrases = new Set();
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const add = (value) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (keep(normalized)) phrases.add(normalized);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxText(node)) add(node.getText(sf));
    if (ts.isStringLiteralLike(node)) {
      const parent = node.parent;
      if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return;
      if (ts.isJsxAttribute(parent)) {
        const prop = parent.name.getText(sf);
        if (ignoredPropertyNames.has(prop) || prop.startsWith("data-")) return;
      }
      if (ts.isPropertyAssignment(parent) && (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))) {
        const prop = parent.name.text;
        if (ignoredPropertyNames.has(prop)) return;
      }
      add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return phrases;
}

function protect(text) {
  return text
    .replaceAll("DropBox", "__DROPBOX__")
    .replaceAll("bigofertas.net", "__DOMAIN__")
    .replace(/P\d{6}/g, (code) => `__CODE_${code}__`);
}
function restore(text) {
  return text
    .replaceAll("__DROPBOX__", "DropBox")
    .replaceAll("__DOMAIN__", "bigofertas.net")
    .replace(/__CODE_(P\d{6})__/g, "$1");
}

async function translateBatch(lines, target) {
  const payload = lines.map(([index, text]) => `ZX${String(index).padStart(4, "0")}ZX ${protect(text)}`).join("\n");
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "pt");
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", payload);
  const response = await fetch(url, { headers: { "user-agent": "DropBox-Stage6-i18n-builder/1.0" } });
  if (!response.ok) throw new Error(`translate ${target} failed: ${response.status}`);
  const json = await response.json();
  const translated = (json[0] ?? []).map((part) => part?.[0] ?? "").join("");
  const found = new Map();
  const pattern = /ZX(\d{4})ZX\s*([\s\S]*?)(?=\n?ZX\d{4}ZX|$)/g;
  let match;
  while ((match = pattern.exec(translated))) found.set(Number(match[1]), restore(match[2].trim()));
  return found;
}

await fs.mkdir(OUTPUT, { recursive: true });
const phrases = new Set();
for (const file of await walk(SRC)) {
  const source = await fs.readFile(file, "utf8");
  for (const phrase of extractFromFile(file, source)) phrases.add(phrase);
}
const list = [...phrases].sort((a, b) => a.localeCompare(b, "pt-BR"));
console.log(`STAGE6_TRANSLATION_SOURCE phrases=${list.length}`);

for (let localeIndex = 0; localeIndex < targets.length; localeIndex += 1) {
  const target = targets[localeIndex];
  const outputCode = outputCodes[localeIndex];
  const translated = {};
  for (let start = 0; start < list.length; start += 24) {
    const batch = list.slice(start, start + 24).map((text, offset) => [offset, text]);
    let result;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        result = await translateBatch(batch, target);
        if (result.size === batch.length) break;
        throw new Error(`expected ${batch.length}, got ${result.size}`);
      } catch (error) {
        if (attempt === 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      }
    }
    for (const [index, source] of batch) translated[source] = result.get(index) ?? source;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  await fs.writeFile(path.join(OUTPUT, `${outputCode}.json`), JSON.stringify(translated, null, 2) + "\n");
  console.log(`STAGE6_TRANSLATION_LOCALE locale=${outputCode} entries=${Object.keys(translated).length}`);
}
