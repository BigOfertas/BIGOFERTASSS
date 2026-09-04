import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const adminRoute = read("src/routes/admin.tsx");
const dashboard = read("src/components/admin/AdminDashboard.tsx");
const dashboardLib = read("src/lib/admin-dashboard.ts");
const liquidGlass = read("src/glass-legacy.css");
const liquidGlassComponent = read("src/components/ui/liquid-glass-card.tsx");

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check(
  "admin possui visão geral, pedidos e produtos",
  /"dashboard" \| "orders" \| "products"/.test(adminRoute) &&
    /<AdminDashboard/.test(adminRoute) &&
    /<OrderAdmin\s*\/>/.test(adminRoute) &&
    /<ProductAdmin\s*\/>/.test(adminRoute),
);

check(
  "admin usa shell operacional e identidade visual compartilhada",
  /lg:grid-cols-\[268px_minmax\(0,1fr\)\]/.test(adminRoute) &&
    /glass-panel/.test(adminRoute) &&
    /LiquidGlassCard/.test(adminRoute) &&
    /active=\{active\}/.test(adminRoute) &&
    /Visão geral/.test(dashboard) &&
    !/bg-gradient-to-br/.test(dashboard),
);

check(
  "metricas vem apenas de dados reais existentes",
  /fetchAdminOrders/.test(dashboardLib) &&
    /fetchAdminCatalog/.test(dashboardLib) &&
    !/Math\.random|mock|fake|fixture/i.test(dashboardLib) &&
    !/Math\.random|mockOrders|fakeOrders/i.test(dashboard),
);

check(
  "painel mostra operacao real sem inventar integracoes",
  /aguardando pagamento/i.test(dashboard) &&
    /Em produção/.test(dashboard) &&
    /Reembolsos/.test(dashboard) &&
    /Produtos ativos/.test(dashboard) &&
    /Produção sob encomenda/.test(dashboard) &&
    !/saldo disponível|cartão de crédito|receita garantida|lucro/i.test(dashboard),
);

check(
  "painel possui estados de carregamento erro e vazio",
  /DashboardSkeleton/.test(dashboard) &&
    /Não foi possível carregar o painel/.test(dashboard) &&
    /Ainda não há pedidos/.test(dashboard),
);

check(
  "animacoes respeitam reducao de movimento",
  /motion-reduce:transition-none/.test(dashboard) &&
    /prefers-reduced-motion:\s*reduce/.test(liquidGlass) &&
    /transition:\s*none\s*!important/.test(liquidGlass) &&
    /transform:\s*none\s*!important/.test(liquidGlass) &&
    /liquid-glass-card--interactive/.test(liquidGlassComponent),
);

let syntaxErrors = 0;
for (const file of [
  "src/routes/admin.tsx",
  "src/components/admin/AdminDashboard.tsx",
  "src/lib/admin-dashboard.ts",
  "src/components/ui/liquid-glass-card.tsx",
]) {
  const source = read(file);
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
  syntaxErrors += errors.length;

  for (const error of errors) {
    console.error(
      `SYNTAX FAIL - ${file}: ${ts.flattenDiagnosticMessageText(error.messageText, "\n")}`,
    );
  }
}

check("arquivos do painel sem erro sintatico", syntaxErrors === 0);

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

if (failed) process.exit(1);
console.log(`\n${checks.length}/${checks.length} validacoes do painel aprovadas.`);
