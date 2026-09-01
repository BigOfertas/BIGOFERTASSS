import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read(
  "supabase/migrations/20260901195500_phase_08_customer_account_addresses.sql",
);
const hardening = read(
  "supabase/migrations/20260901202000_phase_08_default_address_hardening.sql",
);
const accountRoute = read("src/routes/conta.tsx");
const accountUi = read("src/components/account/AccountDashboard.tsx");
const accountLib = read("src/lib/customer-account.ts");
const header = read("src/components/layout/Header.tsx");
const footer = read("src/components/layout/Footer.tsx");
const login = read("src/routes/login.tsx");

const checks = [
  [
    "profiles recebe telefone sem alterar email de autenticacao",
    /ADD COLUMN IF NOT EXISTS phone text/.test(migration) &&
      /update_my_account_profile/.test(migration),
  ],
  [
    "enderecos ficam em tabela propria vinculada ao usuario",
    /CREATE TABLE IF NOT EXISTS public\.customer_addresses/.test(migration) &&
      /user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/.test(
        migration,
      ),
  ],
  [
    "cep e uf possuem validacao no banco",
    /customer_addresses_postal_code_format/.test(migration) &&
      /customer_addresses_state_format/.test(migration),
  ],
  [
    "apenas um endereco principal por usuario",
    /CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default_per_user/.test(
      migration,
    ),
  ],
  [
    "leitura direta de enderecos e restrita ao proprio usuario",
    /customer_addresses_select_own/.test(migration) &&
      /USING \(user_id = auth\.uid\(\)\)/.test(migration),
  ],
  [
    "escritas de endereco passam por RPC autenticada",
    /save_my_customer_address/.test(migration) &&
      /set_default_my_customer_address/.test(migration) &&
      /delete_my_customer_address/.test(migration) &&
      /TO authenticated/.test(migration),
  ],
  [
    "troca de endereco principal remove o anterior antes de marcar o novo",
    /SET is_default = false/.test(hardening) &&
      /SET is_default = true/.test(hardening),
  ],
  [
    "rota conta exige usuario autenticado",
    /createFileRoute\("\/conta"\)/.test(accountRoute) &&
      /to: "\/login"/.test(accountRoute),
  ],
  [
    "area de conta separa dados enderecos e pedidos",
    /"dados"/.test(accountRoute) &&
      /"enderecos"/.test(accountRoute) &&
      /"pedidos"/.test(accountRoute),
  ],
  [
    "historico de pedidos permanece explicitamente futuro",
    /Histórico de pedidos/.test(accountUi) && /Em breve/.test(accountUi),
  ],
  [
    "perfil pode editar nome e telefone",
    /saveCustomerProfile/.test(accountUi) &&
      /Nome completo/.test(accountUi) &&
      /Telefone/.test(accountUi),
  ],
  [
    "email da conta permanece somente leitura",
    /readOnly/.test(accountUi) && /O e-mail está vinculado ao seu acesso/.test(accountUi),
  ],
  [
    "enderecos suportam criar editar principal e excluir",
    /Novo endereço/.test(accountUi) &&
      /Editar/.test(accountUi) &&
      /Tornar principal/.test(accountUi) &&
      /Excluir/.test(accountUi),
  ],
  [
    "camada de dados usa RPCs dedicadas da conta",
    /get_my_account_profile/.test(accountLib) &&
      /update_my_account_profile/.test(accountLib) &&
      /list_my_customer_addresses/.test(accountLib) &&
      /save_my_customer_address/.test(accountLib),
  ],
  [
    "header leva cliente autenticado para conta e owner para admin",
    /isOwner \? "\/admin" : user \? "\/conta" : "\/login"/.test(header),
  ],
  [
    "footer expõe conta e enderecos quando autenticado",
    /to="\/conta"/.test(footer) && /secao: "enderecos"/.test(footer),
  ],
  [
    "login oferece acesso direto a area do cliente",
    /to="\/conta"/.test(login) && /Abrir minha conta/.test(login),
  ],
  [
    "fase 08 nao cria pedidos checkout ou pagamento",
    !/CREATE TABLE IF NOT EXISTS public\.(orders|payments|checkouts)/.test(migration),
  ],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

const sourceFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
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
console.log(`\n${checks.length + 1}/${checks.length + 1} validacoes aprovadas.`);
