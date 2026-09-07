import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const migrationPath = "supabase/migrations/20260902040000_phase_10_definitive_order_core.sql";
const migration = read(migrationPath);
const ordersLib = read("src/lib/orders.ts");
const customerOrders = read("src/components/account/CustomerOrders.tsx");
const customerDetail = read("src/routes/conta/pedidos/$orderNumber.tsx");
const orderDetailContent = read("src/components/orders/OrderDetailContent.tsx");
const orderTimeline = read("src/components/orders/OrderTimeline.tsx");
const productionNotice = read("src/components/orders/ProductionNotice.tsx");
const refundDialog = read("src/components/orders/RefundRequestDialog.tsx");
const adminOrders = read("src/components/admin/OrderAdmin.tsx");
const adminRoute = read("src/routes/admin.tsx");
const accountDashboard = read("src/components/account/AccountDashboard.tsx");
const productRoute = read("src/routes/product/$id.tsx");
const cartRoute = read("src/routes/cart.tsx");
const cartLib = read("src/lib/cart.ts");
const styles = read("src/styles.css");
const generatedTypes = read("src/integrations/supabase/types.ts");

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check(
  "schema cria pedidos, itens, timeline, reembolso e outbox minimo",
  ["orders", "order_items", "order_timeline", "refund_requests", "notification_events"].every(
    (table) => new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\(`).test(migration),
  ),
);
check(
  "status do pedido permanece simples",
  /CREATE TYPE public\.order_status AS ENUM[\s\S]*'pending_payment'[\s\S]*'paid'[\s\S]*'in_production'[\s\S]*'shipped'[\s\S]*'delivered'[\s\S]*'canceled'[\s\S]*'refunded'/.test(
    migration,
  ) && !/dispute|ticket|department|agent_assignment/i.test(migration),
);
check(
  "numero humano usa sequencia e formato BIG-AAAA-NNNNNN",
  /CREATE SEQUENCE IF NOT EXISTS public\.order_public_number_seq/.test(migration) &&
    /'BIG-'[\s\S]*to_char\(CURRENT_DATE, 'YYYY'\)[\s\S]*lpad\(nextval\('public\.order_public_number_seq'\)::text, 6, '0'\)/.test(
      migration,
    ) &&
    /\^BIG-\[0-9\]\{4\}-\[0-9\]\{6,\}\$/.test(migration),
);
check(
  "snapshots preservam produto, variante, SKU, opcoes, preco e endereco",
  [
    "product_name",
    "product_sku",
    "variant_sku",
    "selected_options",
    "unit_price",
    "address_recipient_name",
    "address_postal_code",
    "address_street",
    "address_city",
    "address_state",
  ].every((column) => migration.includes(column)) &&
    /protect_order_snapshot_before_update/.test(migration) &&
    /block_order_item_update_or_delete/.test(migration),
);
check(
  "criacao de pedido e interna, idempotente e sem permissao ao navegador",
  /CREATE OR REPLACE FUNCTION public\.create_order_core/.test(migration) &&
    /orders_user_idempotency_unique/.test(migration) &&
    /GRANT EXECUTE ON FUNCTION public\.create_order_core[\s\S]*TO service_role/.test(migration) &&
    !/GRANT EXECUTE ON FUNCTION public\.create_order_core[^;]*TO authenticated/.test(migration),
);
check(
  "RLS limita leitura ao cliente do pedido ou ao owner",
  /ALTER TABLE public\.orders ENABLE ROW LEVEL SECURITY/.test(migration) &&
    /CREATE POLICY "orders_select_own_or_owner"[\s\S]*user_id = auth\.uid\(\)[\s\S]*has_role\('owner'::public\.app_role\)/.test(
      migration,
    ) &&
    /order_items_select_own_or_owner/.test(migration) &&
    /order_timeline_select_own_or_owner/.test(migration) &&
    /refund_requests_select_own_or_owner/.test(migration),
);
check(
  "tabelas sensiveis recusam escrita direta de authenticated",
  ["orders", "order_items", "order_timeline", "refund_requests"].every((table) =>
    new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM anon, authenticated`).test(migration),
  ) &&
    !/GRANT (INSERT|UPDATE|DELETE)[^;]*public\.(orders|order_items|order_timeline|refund_requests)[^;]*authenticated/i.test(
      migration,
    ),
);
check(
  "pagamento futuro possui confirmacao protegida e idempotente",
  /CREATE OR REPLACE FUNCTION public\.record_order_payment/.test(migration) &&
    /payment_status public\.order_payment_status/.test(migration) &&
    /event_name[\s\S]*'order\.paid'/.test(migration) &&
    /GRANT EXECUTE ON FUNCTION public\.record_order_payment[^;]*TO service_role/.test(migration),
);
check(
  "frete futuro possui snapshot sem cotacao inventada",
  [
    "shipping_provider",
    "shipping_service",
    "shipping_quote_reference",
    "shipping_base_amount",
    "shipping_additional_amount",
    "shipping_transit_business_days",
    "shipping_quoted_at",
  ].every((column) => migration.includes(column)) &&
    !/SuperFrete|PAC fict[ií]cio|SEDEX fict[ií]cio|prazo simulado/i.test(migration),
);
check(
  "timeline e transicoes owner seguem apenas o fluxo normal",
  /CREATE OR REPLACE FUNCTION public\.owner_transition_order/.test(migration) &&
    /pending_payment[\s\S]*canceled[\s\S]*paid[\s\S]*in_production[\s\S]*shipped[\s\S]*delivered/.test(
      migration,
    ) &&
    /Transicao de status nao permitida/.test(migration) &&
    /OrderTimeline entries/.test(orderDetailContent),
);
check(
  "reembolso e simples, integral e resolvido manualmente pelo owner",
  /CREATE OR REPLACE FUNCTION public\.request_my_order_refund/.test(migration) &&
    /CREATE OR REPLACE FUNCTION public\.owner_resolve_refund_request/.test(migration) &&
    /'refunded'::public\.refund_request_status/.test(migration) &&
    /'canceled'::public\.refund_request_status/.test(migration) &&
    /entrará em contato/.test(refundDialog) &&
    /Nenhuma transferência financeira será executada automaticamente/.test(adminOrders) &&
    !/partial_refund|refund_amount|refunded_amount|wallet|ledger/i.test(migration),
);
check(
  "cliente possui historico, detalhe real e empty state sem mocks",
  /fetchMyOrders/.test(customerOrders) &&
    /(Seus pedidos aparecerão aqui|Seu primeiro pedido aparecerá aqui)/.test(customerOrders) &&
    /fetchOrderDetail\(orderNumber\)/.test(customerDetail) &&
    /<CustomerOrders\s*\/>/.test(accountDashboard) &&
    /order_items/.test(ordersLib),
);
check(
  "admin possui busca, filtros, paginacao, detalhe e resolucao",
  /admin_list_orders/.test(migration) &&
    /Buscar pedidos/.test(adminOrders) &&
    /Todos os status/.test(adminOrders) &&
    /Página \{page\} de \{totalPages\}/.test(adminOrders) &&
    /OrderDetailContent/.test(adminOrders) &&
    /resolveRefundRequest/.test(adminOrders) &&
    /<OrderAdmin\s*\/>/.test(adminRoute),
);
check(
  "prazo de producao de 5 dias uteis aparece no banco e na UX",
  /production_business_days smallint NOT NULL DEFAULT 5/.test(migration) &&
    /production_business_days = 5/.test(migration) &&
    /Produção em até 5 dias úteis antes do envio/.test(productionNotice) &&
    /ProductionNotice/.test(cartRoute) &&
    /ProductionNotice/.test(orderDetailContent) &&
    /Produção em até 5 dias úteis antes do envio/.test(productRoute),
);
check(
  "modelo sob encomenda nao e bloqueado por estoque legado",
  /'made_to_order', true/.test(migration) &&
    !/v\.stock_quantity/.test(
      migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.validate_cart_items")),
    ) &&
    !/stock_quantity|sem estoque|Em estoque|Esgotado/.test(productRoute) &&
    /availableStock: null/.test(cartLib),
);
check(
  "fase 10 nao implementa reserva, baixa ou lock de inventario",
  !/CREATE TABLE[^;]*(stock_reservation|inventory_lock)|reserved_quantity|reserve_stock|consume_stock|release_stock/i.test(
    migration,
  ) &&
    !/UPDATE\s+public\.product_variants|DELETE\s+FROM\s+public\.product_variants|SET\s+stock_quantity/i.test(
      migration,
    ),
);
check(
  "outbox de email e minimo, idempotente e sem dados pessoais no payload",
  /idempotency_key text NOT NULL UNIQUE/.test(migration) &&
    /'account\.confirmed'[\s\S]*'order\.paid'[\s\S]*'order\.refunded'[\s\S]*'order\.delivered'/.test(
      migration,
    ) &&
    !/jsonb_build_object\([^)]*(cpf|phone|address)/i.test(migration),
);
check(
  "tipos Supabase incluem todas as estruturas da fase",
  ["orders:", "order_items:", "order_timeline:", "refund_requests:", "notification_events:"].every(
    (token) => generatedTypes.includes(token),
  ) &&
    /order_status:/.test(generatedTypes) &&
    /refund_request_status:/.test(generatedTypes),
);
check(
  "modais internos sao usados para reembolso e confirmacoes",
  /<Dialog/.test(refundDialog) &&
    /<ConfirmDialog/.test(adminOrders) &&
    /backdrop-blur/.test(read("src/components/ui/dialog.tsx")),
);
check(
  "timeline possui animacao e prefers-reduced-motion",
  /order-timeline-entry/.test(orderTimeline) &&
    /@keyframes order-timeline-in/.test(styles) &&
    /@media \(prefers-reduced-motion: reduce\)/.test(styles),
);

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

const popupMatches = [];
const fakeOrderMatches = [];
let syntaxErrors = 0;

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (/window\.(alert|confirm|prompt)\s*\(/.test(source)) {
    popupMatches.push(path.relative(root, file));
  }
  if (/FAKE_ORDERS|mockOrders|pedido fake|cliente fake/i.test(source)) {
    fakeOrderMatches.push(path.relative(root, file));
  }

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

check("nenhum popup nativo existe no frontend", popupMatches.length === 0);
check("nenhum pedido ou cliente falso foi embutido", fakeOrderMatches.length === 0);
check(`${sourceFiles.length} arquivos TS/TSX sem erro sintatico`, syntaxErrors === 0);

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

if (popupMatches.length) console.error("Popups nativos:", popupMatches.join(", "));
if (fakeOrderMatches.length) console.error("Dados falsos:", fakeOrderMatches.join(", "));

if (failed) process.exit(1);
console.log(`\n${checks.length}/${checks.length} validacoes aprovadas.`);
