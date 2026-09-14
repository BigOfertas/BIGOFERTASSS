import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const OUTPUT = path.join(ROOT, "src/i18n/generated");
const locales = [
  ["en", "en"],
  ["es", "es"],
  ["fr", "fr"],
  ["de", "de"],
  ["it", "it"],
  ["nl", "nl"],
  ["ja", "ja"],
  ["ko", "ko"],
  ["zh", "zh-CN"],
  ["ar", "ar"],
];
const selectedLocale = process.env.STAGE6_TARGET_LOCALE?.trim() || null;
const localePairs = selectedLocale
  ? locales.filter(([outputCode]) => outputCode === selectedLocale)
  : locales;

if (selectedLocale && localePairs.length === 0) {
  throw new Error(`Unsupported STAGE6_TARGET_LOCALE=${selectedLocale}`);
}

const portugueseHint = /(?:[áàâãéêíóôõúç]|\b(?:a|as|o|os|de|da|das|do|dos|em|para|por|com|sem|não|sim|seu|sua|seus|suas|meu|minha|produto|produtos|pedido|pedidos|carrinho|compra|comprar|adicionar|remover|salvar|cancelar|confirmar|buscar|selecione|escolha|endereço|telefone|senha|conta|entrega|frete|pagamento|tamanho|guia|afiliado|afiliados|comissão|saque|receita|custo|lucro|margem|categoria|campeonato|temporada|marca|time|início|detalhes|detalhe|disponível|disponíveis|indisponível|carregando|erro|sucesso|voltar|continuar|finalizar|copiar|compartilhar|compartilhamento|produção|envio|trocas|devoluções|privacidade|termos|perguntas|frequentes|idioma|tema|claro|escuro|fale|falar|ajuda|dúvida|duvida|encontrei|olha|dispositivo|torcedor|jogador|feminina|retro|retrô|infantil|corta|vento|calção|calcao|short|modelo|versão|versao|versões|versoes|camisa|regata|calça|calca|casaco|itens|caracteres)\b)/iu;

const ignoredPropertyNames = new Set([
  "className",
  "class",
  "id",
  "key",
  "type",
  "role",
  "href",
  "to",
  "rel",
  "target",
  "name",
  "value",
  "variant",
  "side",
  "align",
  "method",
  "action",
  "scope",
  "kind",
  "slug",
  "path",
  "table",
  "schema",
  "column",
  "event",
  "queryKey",
  "storageKey",
  "property",
  "contentType",
]);

function looksTechnical(value) {
  const text = value.trim();
  if (text.length < 2 || text.length > 420) return true;
  if (/^(?:https?:|\/|\.\/|\.\.\/|@\/|[a-z0-9_.-]+\.(?:tsx?|jsx?|css|json|mjs|png|webp|svg))/.test(text)) {
    return true;
  }
  if (/^[a-z0-9_.:/-]+$/i.test(text) && !/\s/.test(text)) return true;
  if (/(?:bg-|text-|border-|rounded-|px-|py-|mx-|my-|flex|grid|hover:|focus:|sm:|md:|lg:|xl:|w-|h-)/.test(text)) {
    return true;
  }
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
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const add = (value) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (keep(normalized)) phrases.add(normalized);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxText(node)) add(node.getText(sf));
    if (ts.isTemplateExpression(node)) {
      add(node.head.text);
      for (const span of node.templateSpans) add(span.literal.text);
    }
    if (ts.isStringLiteralLike(node)) {
      const parent = node.parent;
      if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return;
      if (ts.isJsxAttribute(parent)) {
        const prop = parent.name.getText(sf);
        if (ignoredPropertyNames.has(prop) || prop.startsWith("data-")) return;
      }
      if (
        ts.isPropertyAssignment(parent) &&
        (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))
      ) {
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

async function requestTranslation(text, target) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "pt");
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);
  const response = await fetch(url, {
    headers: { "user-agent": "DropBox-Stage6-i18n-builder/1.0" },
  });
  if (!response.ok) throw new Error(`translate ${target} failed: ${response.status}`);
  const json = await response.json();
  return (json[0] ?? []).map((part) => part?.[0] ?? "").join("");
}

async function translateBatch(lines, target) {
  const payload = lines
    .map(([index, text]) => `ZX${String(index).padStart(4, "0")}ZX ${protect(text)}`)
    .join("\n");
  const translated = await requestTranslation(payload, target);
  const found = new Map();
  const pattern = /ZX(\d{4})ZX\s*([\s\S]*?)(?=\n?ZX\d{4}ZX|$)/g;
  let match;
  while ((match = pattern.exec(translated))) {
    found.set(Number(match[1]), restore(match[2].trim()));
  }
  return found;
}

async function translateSingle(text, target) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return restore((await requestTranslation(protect(text), target)).trim());
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }
  return text;
}

async function translateReliable(lines, target) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await translateBatch(lines, target);
      if (result.size === lines.length) return result;
    } catch (error) {
      if (attempt === 3 && lines.length === 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }

  if (lines.length === 1) {
    const [[index, text]] = lines;
    return new Map([[index, await translateSingle(text, target)]]);
  }

  const midpoint = Math.ceil(lines.length / 2);
  const left = await translateReliable(lines.slice(0, midpoint), target);
  const right = await translateReliable(lines.slice(midpoint), target);
  return new Map([...left, ...right]);
}

await fs.mkdir(OUTPUT, { recursive: true });
const phrases = new Set();
for (const file of await walk(SRC)) {
  const source = await fs.readFile(file, "utf8");
  for (const phrase of extractFromFile(file, source)) phrases.add(phrase);
}
const list = [...phrases].sort((a, b) => a.localeCompare(b, "pt-BR"));
console.log(`STAGE6_TRANSLATION_SOURCE phrases=${list.length}`);

const BATCH_SIZE = 36;
for (const [outputCode, target] of localePairs) {
  const translated = {};
  for (let start = 0; start < list.length; start += BATCH_SIZE) {
    const batch = list.slice(start, start + BATCH_SIZE).map((text, offset) => [offset, text]);
    const result = await translateReliable(batch, target);
    for (const [index, source] of batch) translated[source] = result.get(index) ?? source;
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
  await fs.writeFile(
    path.join(OUTPUT, `${outputCode}.json`),
    JSON.stringify(translated, null, 2) + "\n",
  );
  console.log(`STAGE6_TRANSLATION_LOCALE locale=${outputCode} entries=${Object.keys(translated).length}`);
}
