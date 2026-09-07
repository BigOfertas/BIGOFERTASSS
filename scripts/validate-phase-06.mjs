import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const cartLib = read("src/lib/cart.ts");
const cartValidation = read("src/lib/cart-validation.ts");
const cartContext = read("src/context/CartContext.tsx");
const cartRoute = read("src/routes/cart.tsx");
const productRoute = read("src/routes/product/$id.tsx");
const types = read("src/integrations/supabase/types.ts");
const migration = read(
  "supabase/migrations/20260901031000_phase_06_definitive_cart_validation.sql",
);
const env = read(".env");

const checks = [
  ["storage do carrinho tem versao explicita", /CART_STORAGE_VERSION = 2/.test(cartLib)],
  [
    "linha do carrinho usa produto e variante",
    /createCartLineId\(productId, variantId/.test(cartLib),
  ],
  [
    "carrinho armazena variante",
    /variantId: string \| null/.test(cartLib) && /sku: string \| null/.test(cartLib),
  ],
  [
    "carrinho armazena opcoes selecionadas",
    /selectedOptions: CartOptionSnapshot\[\]/.test(cartLib),
  ],
  [
    "opcoes incluem tamanho estilo cor e outros",
    /"size" \| "style" \| "color" \| "other"/.test(cartLib),
  ],
  [
    "carrinho limita quantidade",
    /MAX_CART_LINE_QUANTITY = 99/.test(cartLib) && /clampCartQuantity/.test(cartLib),
  ],
  [
    "carrinho migra formato legado",
    /migrateLegacyCartItem/.test(cartLib) && /Array\.isArray\(parsed\)/.test(cartLib),
  ],
  ["carrinho rejeita JSON corrompido", /catch \{\s*return \[\];\s*\}/m.test(cartLib)],
  [
    "produto ficticio legado continua bloqueado",
    /KNOWN_FICTITIOUS_PRODUCT_NAME/.test(cartLib) && /placehold\.co/.test(cartLib),
  ],
  [
    "linhas duplicadas da mesma variante sao consolidadas",
    /normalizeCartItems/.test(cartLib) && /current\.quantity \+ item\.quantity/.test(cartLib),
  ],
  [
    "produto adiciona variante real ao carrinho",
    /variantId: selectedVariant\.id/.test(productRoute) &&
      /sku: selectedVariant\.sku/.test(productRoute),
  ],
  [
    "produto adiciona opcoes ao carrinho",
    /selectedOptions/.test(productRoute) && /optionName: option\.name/.test(productRoute),
  ],
  [
    "bloqueio antigo de carrinho com variantes foi removido",
    !/carrinho com varia[cç][oõ]es ainda n[aã]o est[aá] dispon[ií]vel/i.test(productRoute),
  ],
  [
    "cart remove e altera por lineId",
    /removeFromCart\(item\.lineId\)/.test(cartRoute) &&
      /updateQuantity\(item\.lineId/.test(cartRoute),
  ],
  ["cart mostra opcoes da variante", /item\.selectedOptions\.map/.test(cartRoute)],
  ["cart mostra SKU", /SKU: \{item\.sku\}/.test(cartRoute)],
  [
    "cart mostra valores como estimados",
    /Subtotal estimado/.test(cartRoute) && /TOTAL ESTIMADO/.test(cartRoute),
  ],
  ["cart continua sem frete ficticio", /Frete/.test(cartRoute) && /A calcular/.test(cartRoute)],
  [
    "checkout continua desabilitado nesta fase",
    /Finaliza[cç][aã]o de compra indispon[ií]vel/.test(cartRoute) && /disabled/.test(cartRoute),
  ],
  [
    "cart valida no backend em lote",
    /validateCartItems/.test(cartContext) && /validate_cart_items/.test(cartValidation),
  ],
  [
    "validacao e paginada em lotes de 100",
    /offset \+= 100/.test(cartValidation) && /slice\(offset, offset \+ 100\)/.test(cartValidation),
  ],
  [
    "RPC de carrinho e somente leitura",
    /LANGUAGE sql/.test(migration) &&
      /STABLE/.test(migration) &&
      /SECURITY INVOKER/.test(migration),
  ],
  [
    "RPC nao decrementa estoque",
    !/UPDATE\s+public\.product_variants/i.test(migration) &&
      !/INSERT\s+INTO\s+public\.product_variants/i.test(migration),
  ],
  ["RPC confere produto ativo", /p\.status = 'active'/.test(migration)],
  ["RPC confere variante ativa", /candidate\.status = 'active'/.test(migration)],
  [
    "RPC devolve estoque atual",
    /'available_stock'/.test(migration) && /v\.stock_quantity/.test(migration),
  ],
  [
    "RPC devolve preco efetivo atual",
    /'unit_price'/.test(migration) && /promotional_price_override/.test(migration),
  ],
  [
    "RPC sinaliza carrinho legado que exige escolha",
    /'needs_review'/.test(migration) && /po\.is_required = true/.test(migration),
  ],
  [
    "tipos Supabase incluem RPC da fase 06",
    /validate_cart_items:\s*\{/.test(types) && /p_items: Json/.test(types),
  ],
  [
    "Fase 06 nao conecta o Supabase novo",
    /VITE_SUPABASE_URL=/.test(env) && /VITE_SUPABASE_PUBLISHABLE_KEY=/.test(env),
  ],
  ["Fase 06 nao cria pedidos", !/CREATE TABLE[^;]*\borders\b/i.test(migration)],
  ["Fase 06 nao implementa frete real", !/shipping|freight|frete_api|correios/i.test(migration)],
  ["Fase 06 nao implementa pagamento", !/infinitepay|payment|pagamento/i.test(migration)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

// Execute real unit checks against the pure cart storage/normalization helpers.
const transpiled = ts.transpileModule(cartLib, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
  fileName: "cart.ts",
}).outputText;
const tempFile = path.join(os.tmpdir(), `bigofertas-cart-${Date.now()}.mjs`);
fs.writeFileSync(tempFile, transpiled);
const cart = await import(`${pathToFileURL(tempFile).href}?v=${Date.now()}`);
fs.unlinkSync(tempFile);

const legacy = cart.decodeStoredCart(
  JSON.stringify([
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Produto legado",
      price: 59.9,
      image_url: null,
      quantity: 2,
    },
  ]),
);
const legacyOk =
  legacy.length === 1 &&
  legacy[0].status === "needs_review" &&
  legacy[0].variantId === null &&
  legacy[0].quantity === 2;
console.log(`${legacyOk ? "PASS" : "FAIL"} - migracao legado funciona em execucao`);
if (!legacyOk) failed += 1;

const corruptOk = cart.decodeStoredCart("{nao-e-json").length === 0;
console.log(`${corruptOk ? "PASS" : "FAIL"} - JSON corrompido nao derruba o carrinho`);
if (!corruptOk) failed += 1;

const a = cart.createCartItem(
  {
    productId: "11111111-1111-4111-8111-111111111111",
    productSlug: "camisa",
    variantId: "22222222-2222-4222-8222-222222222222",
    sku: "CAM-P",
    name: "Camisa",
    variantName: "P",
    unitPrice: 99.9,
    imageUrl: null,
    availableStock: 3,
    selectedOptions: [],
  },
  9,
);
const clampOk = a.quantity === 3;
console.log(`${clampOk ? "PASS" : "FAIL"} - quantidade respeita estoque em execucao`);
if (!clampOk) failed += 1;

const b = cart.createCartItem(
  {
    productId: a.productId,
    productSlug: "camisa",
    variantId: "33333333-3333-4333-8333-333333333333",
    sku: "CAM-M",
    name: "Camisa",
    variantName: "M",
    unitPrice: 99.9,
    imageUrl: null,
    availableStock: 8,
    selectedOptions: [],
  },
  1,
);
const variantsSeparateOk = a.lineId !== b.lineId;
console.log(
  `${variantsSeparateOk ? "PASS" : "FAIL"} - variantes diferentes geram linhas diferentes`,
);
if (!variantsSeparateOk) failed += 1;

const merged = cart.normalizeCartItems([
  { ...a, quantity: 1 },
  { ...a, quantity: 2 },
]);
const mergeOk = merged.length === 1 && merged[0].quantity === 3;
console.log(`${mergeOk ? "PASS" : "FAIL"} - mesma variante consolida quantidade`);
if (!mergeOk) failed += 1;

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(full);
  }
}
walk(path.join(root, "src"));
walk(path.join(root, "supabase", "functions"));

let syntaxErrors = 0;
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
    reportDiagnostics: true,
    fileName: file,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length) {
    syntaxErrors += errors.length;
    console.error(`SYNTAX FAIL - ${path.relative(root, file)}`);
    for (const error of errors) {
      console.error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
    }
  }
}
console.log(
  `${syntaxErrors === 0 ? "PASS" : "FAIL"} - ${sourceFiles.length} TS/TSX sem erro sintatico`,
);
if (syntaxErrors) failed += 1;

if (failed) process.exit(1);
console.log(`\n${checks.length + 6}/${checks.length + 6} validacoes aprovadas.`);
