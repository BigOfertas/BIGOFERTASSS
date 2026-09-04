import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const core = read(
  "supabase/migrations/20260904041000_affiliate_referral_backend.sql",
);
const hardening = read(
  "supabase/migrations/20260904042500_affiliate_backend_hardening.sql",
);
const admin = read(
  "supabase/migrations/20260904044000_affiliate_admin_queries.sql",
);
const readiness = read(
  "supabase/migrations/20260904050000_affiliate_program_readiness.sql",
);
const readinessHardening = read(
  "supabase/migrations/20260904050500_affiliate_program_readiness_hardening.sql",
);
const processor = read("supabase/functions/notifications-process/index.ts");
const auth = read("src/lib/auth.tsx");
const referralClient = read("src/lib/affiliate-referral.ts");
const registerPage = read("src/routes/cadastro.tsx");
const accountPanel = read("src/components/account/AffiliateAccountPanel.tsx");
const adminPanel = read("src/components/admin/AffiliateAdmin.tsx");
const adminRoute = read("src/routes/admin.tsx");

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS - ${label}`);
    return;
  }
  failed += 1;
  console.error(`FAIL - ${label}`);
}

check(
  "modelo de afiliado nasce de indicacao de conta, nao de produto",
  core.includes("affiliate_referral_code") &&
    core.includes("affiliate_referrals") &&
    !core.includes("affiliate_product") &&
    !core.includes("affiliate_click"),
);

check(
  "vinculo do indicado e unico e imutavel por conta",
  /CREATE TABLE public\.affiliate_referrals[\s\S]*referred_user_id uuid PRIMARY KEY/.test(
    core,
  ) &&
    core.includes("ON CONFLICT (referred_user_id) DO NOTHING") &&
    !core.includes("UPDATE public.affiliate_referrals SET affiliate_id"),
);

check(
  "cadastro captura codigo somente no nascimento da conta",
  /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)[\s\S]*NEW\.raw_user_meta_data ->> 'affiliate_referral_code'[\s\S]*INSERT INTO public\.affiliate_referrals/.test(
    core,
  ),
);

check(
  "codigo invalido nao impede cadastro normal",
  core.includes("IF matched_affiliate_id IS NOT NULL THEN") &&
    !core.includes("RAISE EXCEPTION 'Codigo de afiliado"),
);

check(
  "frontend envia codigo de indicacao no metadata do novo usuario",
  auth.includes("affiliate_referral_code: normalizedReferralCode") &&
    registerPage.includes("referralValidation === \"invalid\" ? null : referralCode"),
);

check(
  "referencia dura somente a sessao do navegador e nao inventa janela de atribuicao",
  referralClient.includes("window.sessionStorage") &&
    !referralClient.includes("window.localStorage") &&
    referralClient.includes('url.searchParams.set("ref", normalized)'),
);

check(
  "cadastro valida indicacao sem bloquear conta por indisponibilidade temporaria",
  registerPage.includes('ReferralValidation = "idle" | "checking" | "valid" | "invalid" | "unavailable"') &&
    registerPage.includes('setReferralValidation("unavailable")') &&
    registerPage.includes("o servidor fará a verificação final"),
);

check(
  "programa nasce desligado",
  core.includes("enabled boolean NOT NULL DEFAULT false"),
);

check(
  "ativacao exige as cinco regras comerciais explicitas",
  readiness.includes("affiliate_program_enabled_requires_rules") &&
    readiness.includes("commission_rate_bps IS NOT NULL") &&
    readiness.includes("commission_base_mode IS NOT NULL") &&
    readiness.includes("hold_days IS NOT NULL") &&
    readiness.includes("minimum_withdrawal IS NOT NULL") &&
    readiness.includes("withdrawal_method IS NOT NULL"),
);

check(
  "rascunho de regras nunca ativa o programa por acidente",
  readiness.includes("owner_save_affiliate_program_draft") &&
    /owner_save_affiliate_program_draft[\s\S]*enabled = false/.test(readiness),
);

check(
  "comissao guarda snapshot financeiro e uma unica linha por pedido",
  /order_id uuid NOT NULL UNIQUE REFERENCES public\.orders/.test(core) &&
    core.includes("commission_base_amount") &&
    core.includes("commission_rate_bps") &&
    core.includes("commission_amount"),
);

check(
  "pedido sem cliente indicado nao gera comissao",
  /FROM public\.affiliate_referrals[\s\S]*WHERE referred_user_id = order_row\.user_id[\s\S]*IF referral_row\.referred_user_id IS NULL THEN RETURN NULL/.test(
    core,
  ),
);

check(
  "pedido pago de cliente indicado aciona criacao de comissao",
  core.includes("capture_affiliate_commission_after_payment") &&
    core.includes("AFTER UPDATE OF payment_status ON public.orders") &&
    core.includes("create_affiliate_commission_for_paid_order(NEW.id)"),
);

check(
  "falha do modulo de afiliados nao desfaz pagamento confirmado",
  /capture_affiliate_commission_after_payment[\s\S]*EXCEPTION WHEN OTHERS[\s\S]*RAISE WARNING/.test(
    core,
  ),
);

check(
  "reembolso antes da liberacao cancela somente comissao pendente",
  readiness.includes("cancel_pending_affiliate_commission_after_refund") &&
    readiness.includes("WHERE order_id = NEW.id AND status = 'pending'"),
);

check(
  "reembolso depois da liberacao vira revisao neutra sem desconto inventado",
  readiness.includes("affiliate_refund_reviews") &&
    readiness.includes("c.status = 'available'") &&
    !readiness.includes("commission_amount = -") &&
    !readiness.includes("available_balance = available_balance -"),
);

check(
  "liberacao respeita prazo e ignora pedido reembolsado",
  core.includes("c.available_at <= now()") &&
    core.includes("o.status = 'refunded'::public.order_status"),
);

check(
  "liberacao global e restrita ao service role",
  hardening.includes("FROM authenticated") &&
    hardening.includes("TO service_role") &&
    hardening.includes("release_due_affiliate_commissions(uuid)"),
);

check(
  "saldo para saque desconta saques solicitados e pagos",
  readiness.includes("status IN ('requested','paid')") &&
    readiness.includes("greatest(available_total - reserved_total, 0)"),
);

check(
  "saque usa forma configuravel sem inventar PIX ou banco",
  readiness.includes("withdrawal_method text") &&
    readiness.includes("destination_method") &&
    !readiness.includes("pix_key") &&
    !readiness.includes("bank_account"),
);

check(
  "RLS protege tabelas principais e fila de reembolso",
  [
    "affiliate_program_settings",
    "affiliates",
    "affiliate_referrals",
    "affiliate_commissions",
    "affiliate_withdrawals",
  ].every((table) =>
    core.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`),
  ) && readiness.includes("ALTER TABLE public.affiliate_refund_reviews ENABLE ROW LEVEL SECURITY"),
);

check(
  "cliente acessa somente dados do proprio afiliado e e-mail indicado fica mascarado",
  core.includes("masked_email") &&
    /list_my_affiliate_referrals[\s\S]*JOIN public\.affiliates AS a ON a\.id = r\.affiliate_id AND a\.user_id = auth\.uid\(\)/.test(core) &&
    /list_my_affiliate_commissions[\s\S]*WHERE a\.user_id = auth\.uid\(\)/.test(core) &&
    /list_my_affiliate_withdrawals[\s\S]*WHERE a\.user_id = auth\.uid\(\)/.test(core),
);

check(
  "escrita financeira direta do cliente permanece revogada",
  core.includes("REVOKE ALL ON TABLE public.affiliate_commissions FROM PUBLIC, anon, authenticated") &&
    core.includes("REVOKE ALL ON TABLE public.affiliate_withdrawals FROM PUBLIC, anon, authenticated"),
);

check(
  "owner tem resumo, afiliados, clientes indicados, pedidos, comissoes e saques",
  admin.includes("owner_get_affiliate_overview") &&
    admin.includes("owner_list_affiliates") &&
    admin.includes("owner_list_affiliate_commissions") &&
    admin.includes("owner_list_affiliate_withdrawals") &&
    readiness.includes("owner_list_affiliate_referrals") &&
    readiness.includes("owner_list_affiliate_referred_orders"),
);

check(
  "RPCs administrativas verificam papel owner",
  (admin.match(/public\.has_role\('owner'::public\.app_role\)/g) ?? []).length >= 4 &&
    (readiness.match(/public\.has_role\('owner'::public\.app_role\)/g) ?? []).length >= 6,
);

check(
  "agregacao de indicados nao usa SUM DISTINCT de dinheiro",
  readinessHardening.includes("order_totals AS") &&
    readinessHardening.includes("commission_totals AS") &&
    !readinessHardening.includes("sum(DISTINCT"),
);

check(
  "painel do cliente descreve cadastro e pedidos do indicado, nao produtos",
  accountPanel.includes("criar uma conta") &&
    accountPanel.includes("pedidos") &&
    accountPanel.includes("Clientes indicados") &&
    !accountPanel.includes("Indique produtos") &&
    !accountPanel.includes("indicar os produtos"),
);

check(
  "painel do cliente usa dados reais de indicados, comissoes e saques",
  accountPanel.includes("fetchMyAffiliateDashboard") &&
    accountPanel.includes("fetchMyAffiliateReferrals") &&
    accountPanel.includes("fetchMyAffiliateCommissions") &&
    accountPanel.includes("fetchMyAffiliateWithdrawals"),
);

check(
  "painel administrativo exibe as cinco regras e bloqueia ativacao incompleta",
  adminPanel.includes("Comissão (%)") &&
    adminPanel.includes("Base de cálculo") &&
    adminPanel.includes("Liberação (dias)") &&
    adminPanel.includes("Saque mínimo (R$)") &&
    adminPanel.includes("Forma de pagamento") &&
    adminPanel.includes("disabled={actionMutation.isPending || !editorRulesComplete}"),
);

check(
  "administracao inclui afiliados na navegacao principal",
  adminRoute.includes('id: "affiliates"') &&
    adminRoute.includes("<AffiliateAdmin />"),
);

check(
  "processador gera link de cadastro a partir do codigo de indicacao",
  processor.includes('optionalPayloadText(event, "affiliate_link")') &&
    processor.includes('payloadText(event, "referral_code")') &&
    processor.includes('new URL("/cadastro"') &&
    processor.includes('url.searchParams.set("ref", referralCode)'),
);

check(
  "emails de afiliado apontam para a secao correta da conta",
  processor.includes("/conta?secao=afiliados"),
);

check(
  "cron de emails tambem libera comissoes vencidas",
  processor.includes("releaseDueAffiliateCommissions") &&
    processor.includes('payload?.code === "PGRST202"') &&
    processor.indexOf("await releaseDueAffiliateCommissions()") <
      processor.indexOf("const events = await claimEvents(20)"),
);

console.log(`\n${passed}/${passed + failed} validacoes aprovadas.`);
if (failed > 0) process.exit(1);
