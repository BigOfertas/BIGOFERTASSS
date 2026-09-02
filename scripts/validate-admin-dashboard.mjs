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

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check(
  "admin possui dashboard, pedidos e produtos",
  /"dashboard" \| "orders" \| "products"/.test(adminRoute) &&
    /<AdminDashboard/.test(adminRoute) &&
    /<OrderAdmin\s*\/>/.test(adminRoute) &&
    /<ProductAdmin\s*\/>/.test(adminRoute),
);

check(
  "dashboard usa identidade verde e shell inspirado na referencia",
  /emerald-700/.test(adminRoute) &&
    /rounded-\[30px\]/.test(adminRoute) &&
    /Pulso operacional/.test(dashboard) &&
    /bg-gradient-to-br from-emerald/.test(dashboard),
);

check(
  "metricas vem apenas de dados reais existentes",
  /fetchAdminOrders/.test(dashboardLib) &&
    /fetchAdminCatalog/.test(dashboardLib) &&
    !/Math\.random|mock|fake|fixture/i.test(dashboardLib) &&
    !/Math\.random|mockOrders|fakeOrders/i.test(dashboard),
);

check(
  "dashboard mostra operacao real sem inventar integracoes",
  /Aguardando pagamento/.test(dashboard) &&
    /Em produção/.test(dashboard) &&
    /Reembolsos/.test(dashboard) &&
    /Produtos ativos/.test(dashboard) &&
    /Produção sob encomenda/.test(dashboard) &&
    !/saldo disponível|cartão de crédito|receita garantida|lucro/i.test(dashboard),
);

check(
  "dashboard possui estados de loading erro e vazio",
  /DashboardSkeleton/.test(dashboard) &&
    /Não foi possível carregar o dashboard/.test(dashboard) &&
    /Ainda não há pedidos reais/.test(dashboard),
);

check(
  "animacoes respeitam reducao de movimento",
  /motion-reduce:transition-none/.test(dashboard),
);

let syntaxErrors = 0;
for (const file of [
  "src/routes/admin.tsx",
  "src/components/admin/AdminDashboard.tsx",
  "src/lib/admin-dashboard.ts",
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

check("arquivos do dashboard sem erro sintatico", syntaxErrors === 0);

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

if (failed) process.exit(1);
console.log(`\n${checks.length}/${checks.length} validacoes do dashboard aprovadas.`);
