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
const hardening = read("supabase/migrations/20260901202000_phase_08_default_address_hardening.sql");
const identityMigration = read(
  "supabase/migrations/20260902022000_phase_08_required_customer_identity.sql",
);
const accountRoute = read("src/routes/conta.tsx");
const accountUi = read("src/components/account/AccountDashboard.tsx");
const accountLib = read("src/lib/customer-account.ts");
const brasil = read("src/lib/brasil.ts");
const auth = read("src/lib/auth.tsx");
const cadastro = read("src/routes/cadastro.tsx");
const login = read("src/routes/login.tsx");
const header = read("src/components/layout/Header.tsx");
const footer = read("src/components/layout/Footer.tsx");
const confirmDialog = read("src/components/ui/confirm-dialog.tsx");
const alertDialog = read("src/components/ui/alert-dialog.tsx");
const adminUi = read("src/components/admin/ProductAdmin.tsx");

const checks = [
  [
    "profiles recebe telefone e cpf",
    /ADD COLUMN IF NOT EXISTS phone text/.test(migration) &&
      /ADD COLUMN IF NOT EXISTS cpf text/.test(identityMigration),
  ],
  [
    "cpf possui validacao de digitos verificadores no banco",
    /is_valid_brazilian_cpf/.test(identityMigration) &&
      /substring\(digits from 10/.test(identityMigration) &&
      /substring\(digits from 11/.test(identityMigration),
  ],
  [
    "cpf preenchido e unico por conta",
    /profiles_cpf_unique/.test(identityMigration) &&
      /WHERE cpf IS NOT NULL/.test(identityMigration),
  ],
  [
    "telefone brasileiro exige comprimento e ddd existente",
    /is_valid_brazilian_phone/.test(identityMigration) &&
      /length\(regexp_replace/.test(identityMigration) &&
      /is_valid_brazilian_ddd/.test(identityMigration),
  ],
  [
    "lista de ddds contempla os codigos nacionais brasileiros esperados",
    /"11"/.test(brasil) &&
      /"24"/.test(brasil) &&
      /"38"/.test(brasil) &&
      /"55"/.test(brasil) &&
      /"69"/.test(brasil) &&
      /"79"/.test(brasil) &&
      /"89"/.test(brasil) &&
      /"99"/.test(brasil) &&
      !/"20"/.test(brasil) &&
      !/"90"/.test(brasil),
  ],
  [
    "frontend valida cpf e ddd antes de salvar",
    /isValidBrazilianCpf/.test(accountUi) &&
      /isValidBrazilianPhone/.test(accountUi) &&
      /isValidBrazilianCpf/.test(cadastro) &&
      /isValidBrazilianPhone/.test(cadastro),
  ],
  [
    "cadastro exige nome email telefone cpf e senha",
    /Nome completo/.test(cadastro) &&
      /Telefone/.test(cadastro) &&
      /CPF/.test(cadastro) &&
      /required/.test(cadastro) &&
      /Confirmar senha/.test(cadastro),
  ],
  [
    "novo usuario leva telefone e cpf para o perfil",
    /raw_user_meta_data ->> 'phone'/.test(identityMigration) &&
      /raw_user_meta_data ->> 'cpf'/.test(identityMigration) &&
      /phone: onlyDigits\(phone, 11\)/.test(auth) &&
      /cpf: onlyDigits\(cpf, 11\)/.test(auth),
  ],
  [
    "rpc de identidade exige nome telefone e cpf validos",
    /update_my_customer_identity/.test(identityMigration) &&
      /Informe seu nome completo/.test(identityMigration) &&
      /Telefone invalido ou DDD inexistente/.test(identityMigration) &&
      /CPF invalido/.test(identityMigration),
  ],
  [
    "area da conta trata nome telefone e cpf como obrigatorios",
    /Nome, telefone e CPF são obrigatórios/.test(accountUi) &&
      /profileComplete/.test(accountUi) &&
      /Preencha corretamente todos os campos obrigatórios/.test(accountUi),
  ],
  [
    "enderecos ficam em tabela propria vinculada ao usuario",
    /CREATE TABLE IF NOT EXISTS public\.customer_addresses/.test(migration) &&
      /user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/.test(migration),
  ],
  [
    "cep e uf possuem validacao no banco",
    /customer_addresses_postal_code_format/.test(migration) &&
      /customer_addresses_state_format/.test(migration),
  ],
  [
    "complemento permanece opcional e demais dados de endereco obrigatorios",
    /complement text,/.test(migration) &&
      /postal_code text NOT NULL/.test(migration) &&
      /street text NOT NULL/.test(migration) &&
      /number text NOT NULL/.test(migration) &&
      /Complemento/.test(accountUi) &&
      /\(opcional\)/.test(accountUi),
  ],
  [
    "apenas um endereco principal por usuario",
    /CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default_per_user/.test(migration),
  ],
  [
    "troca de endereco principal remove o anterior antes de marcar o novo",
    /SET is_default = false/.test(hardening) && /SET is_default = true/.test(hardening),
  ],
  [
    "enderecos sao protegidos pelo proprio usuario",
    /customer_addresses_select_own/.test(migration) &&
      /USING \(user_id = auth\.uid\(\)\)/.test(migration),
  ],
  [
    "rota conta exige usuario autenticado",
    /createFileRoute\("\/conta"\)/.test(accountRoute) && /to: "\/login"/.test(accountRoute),
  ],
  [
    "area de conta separa dados enderecos e pedidos",
    /"dados"/.test(accountRoute) &&
      /"enderecos"/.test(accountRoute) &&
      /"pedidos"/.test(accountRoute),
  ],
  [
    "historico de pedidos permanece integrado a navegacao da conta",
    /Histórico de pedidos/.test(accountUi) &&
      (/Em breve/.test(accountUi) || /<CustomerOrders\s*\/>/.test(accountUi)),
  ],
  [
    "cep pode preencher endereco automaticamente",
    /lookupBrazilianPostalCode/.test(accountUi) && /viacep\.com\.br\/ws\//.test(accountLib),
  ],
  [
    "falha de cep nao bloqueia preenchimento manual",
    /CEP não encontrado\. Você pode preencher o endereço manualmente\./.test(accountUi) &&
      /Consulta de CEP indisponível agora\. Preencha manualmente\./.test(accountUi),
  ],
  [
    "edicao de endereco evita recarregar todo o painel",
    /refreshAddresses/.test(accountUi) && /await refreshAddresses\(\)/.test(accountUi),
  ],
  [
    "loading da conta usa skeleton",
    /function AccountSkeleton/.test(accountUi) && /animate-pulse/.test(accountUi),
  ],
  [
    "navegacao da conta funciona bem no mobile e desktop",
    /overflow-x-auto/.test(accountUi) && /lg:sticky lg:top-28/.test(accountUi),
  ],
  [
    "feedback de sucesso e acessivel",
    /aria-live="polite"/.test(accountUi) && /fixed bottom-4/.test(accountUi),
  ],
  [
    "confirmacoes importantes usam componente interno",
    /<ConfirmDialog/.test(accountUi) &&
      /<ConfirmDialog/.test(adminUi) &&
      /Confirmar/.test(confirmDialog),
  ],
  [
    "modal de confirmacao usa fundo borrado e card central",
    /backdrop-blur-\[6px\]/.test(alertDialog) &&
      /left-\[50%\]/.test(alertDialog) &&
      /top-\[50%\]/.test(alertDialog) &&
      /rounded-2xl/.test(confirmDialog),
  ],
  [
    "arquivamento administrativo nao usa popup nativo",
    /Arquivar produto\?/.test(adminUi) &&
      /archiveTarget/.test(adminUi) &&
      !/window\.confirm/.test(adminUi),
  ],
  [
    "email de confirmacao retorna para a conta publicada",
    /emailRedirectTo/.test(auth) && /new URL\("\/conta", window\.location\.origin\)/.test(auth),
  ],
  [
    "cadastro permite reenviar confirmacao",
    /resendSignUpConfirmation/.test(cadastro) && /Reenviar e-mail de confirmação/.test(cadastro),
  ],
  [
    "login permite visualizar senha e mostra progresso",
    /showPassword/.test(login) && /Mostrar senha/.test(login) && /Entrando\.\.\./.test(login),
  ],
  [
    "header leva cliente autenticado para conta e owner para admin",
    /isOwner \? "\/admin" : user \? "\/conta" : "\/login"/.test(header),
  ],
  [
    "footer expoe conta e enderecos quando autenticado",
    /to="\/conta"/.test(footer) && /secao: "enderecos"/.test(footer),
  ],
  [
    "fase 08 nao cria pedidos checkout ou pagamento",
    !/CREATE TABLE IF NOT EXISTS public\.(orders|payments|checkouts)/.test(migration) &&
      !/CREATE TABLE IF NOT EXISTS public\.(orders|payments|checkouts)/.test(identityMigration),
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

const nativeDialogViolations = [];
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (/\bwindow\.(confirm|alert|prompt)\s*\(/.test(source)) {
    nativeDialogViolations.push(path.relative(root, file));
  }
}

console.log(
  `${nativeDialogViolations.length === 0 ? "PASS" : "FAIL"} - frontend sem confirm/alert/prompt nativo do navegador`,
);
if (nativeDialogViolations.length) {
  failed += 1;
  for (const file of nativeDialogViolations) console.error(`NATIVE DIALOG - ${file}`);
}

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
console.log(`\n${checks.length + 2}/${checks.length + 2} validacoes aprovadas.`);
